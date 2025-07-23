import "dotenv/config";
import { AppDataSource } from "./data-source";
import express from "express";
import TelegramBot, {
  InlineKeyboardButton,
  InputMedia,
  SendMessageOptions,
} from "node-telegram-bot-api";
import { db, Avatar } from "./avatarDB";
import OpenAI from "openai";
import { Video } from "./entity/Video";
import { analyzeVideoScript, combineScriptAndInsertions } from "./insertionAI";
import { heygen } from "./HeyGen";
import { Insertion } from "./entity/Insertion";
import { genVideo } from "./videoGen";
import { getDuration } from "./getDuration";
import axios from "axios";
import { retranscribe } from "./retranscribe";
import fs from "fs";
import path from "path";
import { addOverlay } from "./addOverlay";
import { generateSubtitles } from "./generateSubtitles";
import { addSubtitles } from "./addSubtitles";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

enum Waiter {
  None = "none",
  Script = "script",
  Avatar = 'avatar',
  Voice = 'voice',
  Name = 'name'
}
let waiter: Waiter = Waiter.None;
let avId: string | null = null;
let voiceId: string | null = null;

const Btn = (text: string, data: string): InlineKeyboardButton[] => [
  {
    text,
    callback_data: data,
  },
];

const Keyboard = (buttons: InlineKeyboardButton[][]): SendMessageOptions => ({
  reply_markup: {
    inline_keyboard: buttons,
  },
});

AppDataSource.initialize()
  .then(async () => {
    const manager = AppDataSource.manager;
    const app = express();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, {
      polling: true,
    });

    app.use(express.json());
    app.post(
      "/webhook",
      async (
        req: express.Request<
          any,
          any,
          {
            event_type: "avatar_video.success";
            event_data: {
              video_id: string;
              url: string;
              callback_id: string;
            };
          }
        >,
        res
      ): Promise<any> => {
        if (req.body.event_type === "avatar_video.success") {
          const video = await manager.findOne(Video, {
            where: {
              id: +req.body.event_data.callback_id,
            },
          });
          if (!video) return res.status(200).end();
          video.buffer = (
            await axios.get(req.body.event_data.url, {
              responseType: "arraybuffer",
            })
          ).data;
          await manager.save(video);

          await bot.sendVideo(+video.chatId, video.buffer, {}, {
          contentType: 'video/mp4',
          filename: 'video.mp4'
        });
          await bot.sendMessage(
            +video.chatId,
            "Видео готово",
            Keyboard([Btn("Монтировать", `edit-${video.id}`)])
          );
        }
      }
    );

    await bot.setMyCommands([
      {
        command: "/start",
        description: "Информация",
      },
      {
        command: "generate",
        description: "Сгенерировать видео",
      },
      {
        command: "archive",
        description: "Архив генерации",
      },
      {
        command: 'add',
        description: 'Добавить аватар'
      }
    ]);

    bot.onText(/\/generate/, async (msg) => {
      await manager
        .createQueryBuilder(Video, "video")
        .delete()
        .where("video.finished = true")
        .execute();

      const video = new Video();
      await manager.save(video);
      const avatars = await db.getAll();
      await bot.sendMessage(
        msg.chat.id,
        "Выберите аватар",
        Keyboard(avatars.map((el) => Btn(el.name, `generate-avatar-${el.id}`)))
      );
    });

    bot.on("callback_query", async (q) => {
      if (q.data?.startsWith("generate-avatar-")) {
        const id = q.data.split("-")[2];
        waiter = Waiter.Script;
        avId = id;
        await bot.sendMessage(q.from.id, "Пришлите скрипт");
      }

      if (q.data?.startsWith("edit-")) {
        const id = +q.data.split("-")[1];
        const video = await manager.findOne(Video, {
          where: {
            id: id,
          },
          relations: {
            insertions: true,
          },
        });

        if (!video) return;
        await bot.sendMessage(q.from.id, "Ретранскрибирую видео...");
        const words = await retranscribe(video.buffer);
        await bot.sendMessage(
          q.from.id,
          "Определяю, куда вставлять вставки..."
        );
        const locations = await combineScriptAndInsertions(
          video.insertions,
          words
        );
        await bot.sendMessage(q.from.id, "Вставляю вставки...");
        let name: string = "video.mp4";
        fs.writeFileSync(path.join(process.cwd(), "video", name), video.buffer);
        for (const l of locations) {
          const insertion = video.insertions.find((el) => el.id === l.id);
          if (!insertion) continue;
          let insPath = path.join(
            process.cwd(),
            "video",
            `${insertion.id}.mp4`
          );
          fs.writeFileSync(insPath, insertion.buffer);
          let outName = `video-${insertion.id}.mp4`;
          await addOverlay(
            path.join(process.cwd(), "video", name),
            insPath,
            path.join(process.cwd(), "video", outName),
            l.start,
            l.end
          );
          fs.rmSync(path.join(process.cwd(), "video", name));
          fs.rmSync(insPath);
          name = outName;
        }

        await bot.sendMessage(q.from.id, 'Вставки добавлены. Добавляю субтитры...');
        let videoPath = path.join(process.cwd(), 'video', name)
        let outPath = path.join(process.cwd(), 'video', 'final.mp4');
        let assPath = path.join(process.cwd(), 'video', 'subtitles.ass');
        generateSubtitles(words, assPath);
        addSubtitles(videoPath, assPath, outPath);
        fs.rmSync(videoPath);
        fs.rmSync(assPath);
        const buf = fs.readFileSync(outPath);
        fs.rmSync(outPath);
        video.buffer = buf;
        video.finished = true;
        await manager.save(video);
        await bot.sendMessage(q.from.id, 'Видео готово!');
        await bot.sendVideo(q.from.id, buf, {
          caption: 'Ваше видео'
        }, {
          contentType: 'video/mp4',
          filename: 'video.mp4'
        })
      }
    });

    bot.onText(/./, async (msg) => {
      if (waiter === Waiter.Script) {
        waiter = Waiter.None;
        if (!avId)
          return await bot.sendMessage(msg.chat.id, "Сначала выберите аватар!");
        const avatar = db.getOne(avId);
        if (!avatar)
          return await bot.sendMessage(msg.chat.id, "Сначала выберите аватар!");
        await bot.sendMessage(msg.chat.id, "Анализирую скрипт...");
        const analysis = await analyzeVideoScript(msg.text!);
        await bot.sendMessage(
          msg.chat.id,
          `Анализ:\nРечь ИИ-Аватара:${
            analysis.script
          }\n\nПромпты для вставок:\n${analysis.insertions.join("\n")}`
        );

        const video = new Video();
        video.voiceId = avatar.voiceId;
        video.avatarId = avatar.id;
        video.chatId = String(msg.chat.id);
        await manager.save(video);
        await bot.sendMessage(msg.chat.id, "Генерирую вставки...");

        for (const i of analysis.insertions) {
          const insertion = new Insertion();
          insertion.video = video;
          insertion.buffer = await genVideo(i);
          insertion.duration = await getDuration(insertion.buffer);
          insertion.prompt = i;
          await manager.save(insertion);
          await bot.sendVideo(msg.chat.id, insertion.buffer, {
            caption: "Вставка готова",
          }, {
          contentType: 'video/mp4',
          filename: 'video.mp4'
        });
        }

        await bot.sendMessage(
          msg.chat.id,
          "Все вставки готовы. Начинаю генерировать хейген..."
        );
        await heygen.generateVideo({
          dimension: {
            height: 1080,
            width: 720,
          },
          video_inputs: [
            {
              character: {
                type: avatar.type,
                avatar_id: avatar.id,
                talking_photo_id: avatar.id,
                avatar_style: "normal",
              },
              voice: {
                type: "text",
                input_text: analysis.script,
                voice_id: avatar.voiceId,
                speed: 1.0,
              },
            },
          ],
          caption: false,
          callback_id: String(video.id),
        });
      } else if (waiter === Waiter.Avatar) {
        avId = msg.text!;
        waiter = Waiter.Voice;
        await bot.sendMessage(msg.chat.id, 'Теперь пришлите мне ID голоса из хейгена')
      } else if (waiter === Waiter.Voice) {
        voiceId = msg.text!;
        waiter = Waiter.Name;
        await bot.sendMessage(msg.chat.id, 'Теперь пришлите мне имя для этого аватара');
      } else if (waiter === Waiter.Name) {
        waiter = Waiter.None;
        await bot.sendMessage(msg.chat.id, 'Проверяю данные...');
        try {
          const avatar = await Avatar.build(avId!, voiceId!, msg.text!);
          avId = null;
          voiceId = null;
          db.add(avatar);
          await bot.sendMessage(msg.chat.id, 'Аватар добавлен!');
        } catch (err) {
          console.error(err);
          await bot.sendMessage(msg.chat.id, 'Неверный айди голоса или аватара! Попробуйте добавить снова')
        }
      }
    });

    bot.onText(/\/archive/, async (msg) => {
      const videos = await manager.findBy(Video, {
        finished: true
      });
      for (const video of videos) {
        await bot.sendVideo(msg.chat.id, video.buffer, {
          caption: `Видео #${video.id}`
        }, {
          contentType: 'video/mp4',
          filename: 'video.mp4'
        });
      }
    });

    bot.onText(/\/add/, async (msg) => {
      waiter = Waiter.Avatar;
      await bot.sendMessage(msg.chat.id, 'Пришлите мне ID аватара из хейген');
    })

    app.listen(5000);
  })
  .catch((error) => console.log(error));
