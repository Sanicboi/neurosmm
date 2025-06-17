import TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import sendAvatars from "../helpers/sendAvatars";
import { Avatar } from "../entity/Avatar";
import sendVoices from "../helpers/sendVoices";
import { Video } from "../entity/Video";
import { Voice } from "../entity/Voice";
import { Image } from "../entity/Image";
import axios, { AxiosResponse } from "axios";
import path from "path";
import { heygen } from "../HeyGen";
import { insertVideos } from "../insertionAI";
import { Segment } from "../entity/Segment";

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

      user.waitingFor = "images";
      await manager.save(user);

      video.height = height;
      video.width = width;
      await manager.save(video);
      await bot.sendMessage(user.id, "Разрешение выбрано!");
      await bot.sendMessage(
        user.id,
        "Теперь пришлите мне картинки для вставок. ВАЖНО - все картинки должны быть квадратными!"
      );
    }


    if (q.data === "segments") {
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

      user.waitingFor = "segments";
      await manager.save(user);
      await bot.sendMessage(
        user.id,
        "Пришлите мне готовые сегменты. ВАЖНО! Все видео должны быть в формате .mp4",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Дальше",
                  callback_data: "script",
                },
              ],
            ],
          },
        }
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
      await bot.sendMessage(user.id, 'Пришлите мне промпт с описанием скрипта видео, а также каждого сегмента. ВАЖНО! В ТОМ ЖЕ ПОРЯДКЕ, ЧТО И ДО ЭТОГО!!!')
    }
  });

  bot.on("photo", async (msg) => {
    if (!msg.photo) return;
    if (!msg.from) return;
    const user = await manager.findOne(User, {
      where: {
        id: msg.from.id,
      },
      relations: {
        videos: true,
      },
    });

    if (!user || user.waitingFor !== "images") return;
    const video = user.videos.find((el) => el.active);
    if (!video) return;

    const [photo] = msg.photo.sort(
      (a, b) => b.height * b.width - a.height * a.width
    );

    const url = await bot.getFileLink(photo.file_id);
    const buffer: AxiosResponse<Buffer> = await axios.get(url, {
      responseType: "arraybuffer",
    });

    const image = new Image();
    image.basename = path.basename(url);
    image.data = buffer.data;
    image.video = video;
    await manager.save(image);

    await bot.sendMessage(
      user.id,
      'Фото добавлено! Пришлите мне еще или нажмите "Дальше"',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Дальше",
                callback_data: "segments",
              },
            ],
          ],
        },
      }
    );
  });

  bot.on("video", async (msg) => {
    if (!msg.video || !msg.from) return;
    const user = await manager.findOne(User, {
      where: {
        id: msg.from.id,
      },
      relations: {
        videos: {
          segments: true
        }
      },
    });
    if (!user) return;
    const video = user.videos.find((el) => el.active);
    if (!video) return;
    if (user.waitingFor !== 'segments') return;
    const segment = new Segment();
    segment.video = video;
    segment.index = video.segments.length;
    const url = await bot.getFileLink(msg.video.file_id);
    segment.data = (
      await axios.get(url, {
        responseType: "arraybuffer",
      })
    ).data;
    await manager.save(segment);
    await bot.sendMessage(user.id, "Сегмент добавлен!", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Дальше",
              callback_data: "script",
            },
          ],
        ],
      },
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

    const res = await insertVideos(video.segments.sort((a, b) => a.id - b.id), msg.text);
    for (let i = 0; i < res.length; i++) {
      const current = res[i];
      if (current.type === "ai") {
        const segment = new Segment();
        segment.video = video;
        segment.index = i;
        await manager.save(segment);
        await heygen.generateVideo({
          dimension: {
            height: video.height,
            width: video.width,
          },
          callback_id: String(segment.id),
          video_inputs: [
            {
              character: {
                type: video.avatar.type,
                avatar_id: video.avatar.heygenId,
                talking_photo_id: video.avatar.heygenId,
              },
              voice: {
                type: "text",
                input_text: msg.text,
                voice_id: video.voice.heygenId,
                speed: 1.1,
              },
            },
          ],
        });
      } else {
        current.insertion.index = i;
        await manager.save(current);
      }
    }
    await bot.sendMessage(user.id, "Генерирую видео...");
  });
};
