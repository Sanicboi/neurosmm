import TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import sendAvatars from "../helpers/sendAvatars";
import { Avatar } from "../entity/Avatar";
import sendVoices from "../helpers/sendVoices";
import { Video } from "../entity/Video";
import { Voice } from "../entity/Voice";
import { Insertion } from "../entity/Insertion";
import axios, { AxiosResponse } from "axios";
import path from "path";
import { heygen } from "../HeyGen";
import { getScript } from "../insertionAI";

const manager = AppDataSource.manager;

export default async (bot: TelegramBot) => {
  bot.onText(/\/generate/, async (msg) => {
    if (!msg.from) return;
    let user = await manager.findOne(User, {
      where: {
        id: msg.from.id,
      },
      relations: {
        avatars: true,
        videos: true,
      },
    });

    if (!user) return;
    for (const video of user.videos) {
      if (video.active) {
        await manager.remove(video);
      }
    }

    const video = new Video();
    video.active = true;
    video.user = user;
    await manager.save(video);

    await sendAvatars(bot, user, "genavatar-");
  });

  bot.on("callback_query", async (q) => {
    if (q.data?.startsWith("genavatar-")) {
      const avatar = await manager.findOneBy(Avatar, {
        id: +q.data.substring(10),
      });
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          voices: true,
          videos: true,
        },
      });
      if (!avatar) return;
      if (!user) return;
      const video = user.videos.find((el) => el.active);
      if (!video) return;
      video.avatar = avatar;
      await manager.save(video);

      await bot.sendMessage(q.from.id, `Аватар "${avatar.name}" выбран!`);
      await sendVoices(bot, user, "genvoice-", false);
    }

    if (q.data?.startsWith("genvoice-")) {
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          videos: true,
        },
      });
      const voice = await manager.findOneBy(Voice, {
        id: +q.data.substring(9),
      });
      if (!voice) return;
      if (!user) return;
      const video = user.videos.find((el) => el.active);
      if (!video) return;
      video.voice = voice;
      await manager.save(video);
      await bot.sendMessage(q.from.id, `Голос ${voice.name} выбран!`);
      await bot.sendMessage(q.from.id, "Выберите формат генерации", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "720x1280",
                callback_data: `res-720-1280`,
              },
            ],
            [
              {
                text: "Назад",
                callback_data: "select-voice",
              },
            ],
          ],
        },
      });
    }

    if (q.data?.startsWith("res-")) {
      const split = q.data.split("-");
      const [, width, height] = split.map((el) => Number(el));
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          videos: true,
        },
      });
      if (!user) return;
      const video = user.videos.find((el) => el.active);
      if (!video) return;

      user.waitingFor = "insertions";
      await manager.save(user);

      video.height = height;
      video.width = width;
      await manager.save(video);
      await bot.sendMessage(user.id, "Разрешение выбрано!");
      await bot.sendMessage(
        user.id,
        "Теперь пришлите мне видео-вставки ВАЖНО: нужно присылать в таком же порядке, как вы хотите видеть их в видео."
      );
    }


    if (q.data === 'script') {
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          videos: true,
        },
      });
      if (!user) return;
      const video = user.videos.find((el) => el.active);
      if (!video) return;
      user.waitingFor = 'script';
      await manager.save(user);
      await bot.sendMessage(user.id, 'Пришлите мне промпт с описанием скрипта видео, а также каждой вставки. ВАЖНО! В ТОМ ЖЕ ПОРЯДКЕ, ЧТО И ДО ЭТОГО!!!')
    }
  });

  bot.on("video", async (msg) => {
    if (!msg.video || !msg.from) return;
    const user = await manager.findOne(User, {
      where: {
        id: msg.from.id,
      },
      relations: {
        videos: {
          insertions: true
        }
      },
    });
    if (!user) return;
    const video = user.videos.find((el) => el.active);
    if (!video) return;
    if (user.waitingFor !== 'insertions') return;

    const url = await bot.getFileLink(msg.video.file_id);


    const insertion = new Insertion();
    insertion.data = (await axios.get(url, {
      responseType: 'arraybuffer'
    })).data;
    insertion.basename = path.basename(url);
    insertion.video = video;
    insertion.index = video.insertions.length;
    await manager.save(insertion);

    await bot.sendMessage(user.id, 'Вставка добавлена', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Дальше',
              callback_data: 'script'
            }
          ]
        ]
      }
    });
  });

  bot.onText(/./, async (msg) => {
    if (!msg.from || !msg.text) return;
    if (msg.text?.startsWith("/")) return;
    const user = await manager.findOne(User, {
      where: {
        id: msg.from.id,
      },
      relations: {
        videos: {
          avatar: true,
          voice: true,
        },
      },
    });

    if (!user || user.waitingFor !== "script") return;
    const video = user.videos.find((el) => el.active);
    if (!video) return;

    video.prompt = msg.text;
    await manager.save(video);

    const script = await getScript(video.prompt);
    await heygen.generateVideo({
          dimension: {
            height: video.height,
            width: video.width,
          },
          callback_id: String(video.id),
          video_inputs: [
            {
              character: {
                type: video.avatar.type,
                avatar_id: video.avatar.heygenId,
                talking_photo_id: video.avatar.heygenId,
              },
              voice: {
                type: "text",
                input_text: script,
                voice_id: video.voice.heygenId,
                speed: 1.1,
              },
            },
          ],
        });
    await bot.sendMessage(user.id, "Генерирую видео...");
  });
};
