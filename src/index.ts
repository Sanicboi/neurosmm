import "dotenv/config";
import { AppDataSource } from "./data-source";
import { User } from "./entity/User";
import express from "express";
import TelegramBot, {
  InlineKeyboardButton,
  InputMedia,
} from "node-telegram-bot-api";
import { Video } from "./entity/Video";
import OpenAI from "openai";
import { Avatar } from "./entity/Avatar";
import { Voice } from "./entity/Voice";
import axios from "axios";
import { Subtitles } from "./entity/Subtitles";
import path from "path";
import { heygen } from "./HeyGen";
import editing from "./routers/editing";
import { generateKey } from "crypto";
import generation from "./routers/generation";
import settings from "./routers/settings";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
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
      ) => {
        if (req.body.event_type === "avatar_video.success") {
          const video = await manager.findOne(Video, {
            where: {
              id: Number(req.body.event_data.callback_id),
            },
            relations: {
              user: true
            },
          });
          if (!video) return;
          video.file = (await axios.get(req.body.event_data.url, {
            responseType: 'arraybuffer'
          })).data;
          video.basename = `${req.body.event_data.video_id}.mp4`;
          await manager.save(video);
          await bot.sendVideo(
            video.user.id,
            req.body.event_data.url,
            {
              caption: "Видео готово",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Приступить к монтажу",
                      callback_data: `edit-${video.id}`,
                    },
                  ],
                ],
              },
            }
          );
          res.status(200).end();
        }
      }
    );

    await bot.setMyCommands([
      {
        command: "generate",
        description: "Сгенерировать видео",
      },
      {
        command: "settings",
        description: "Настройки",
      },
      {
        command: "archive",
        description: "Архив генерации",
      },
    ]);

    bot.onText(/\/start/, async (msg) => {
      if (!msg.from) return;
      let user = await manager.findOne(User, {
        where: {
          id: msg.from.id,
        },
        relations: {
          avatars: true,
        },
      });

      if (!user) {
        user = new User();
        user.id = msg.from.id;
        user.avatars = [];
        await manager.save(user);
        const defaultVoices: string[] = [
          "77adf54adb1d46ce9c70d0b50ce7bc54",
          "50ab8f40f8a34d66aa4338729900c1b0",
        ];
        const defaultAvatars: string[] = [
          "850eac64aa844fc0a35453acf230ad4b",
          "253446ebca244c20b767944190d15609",
        ];
        await bot.sendMessage(user.id, "Собираю нужные материалы...");
        const voices = await heygen.getVoices();
        for (const voice of defaultVoices) {
          const inHeygen = voices.find((el) => el.voice_id === voice)!;
          const v = new Voice();
          v.heygenId = inHeygen.voice_id;
          v.name = inHeygen.name;
          v.user = user;
          await manager.save(v);
        }

        for (const a of defaultAvatars) {
          const avatar = new Avatar();
          const inHeygen = await heygen.getAvatar(a);
          avatar.heygenId = inHeygen.id;
          avatar.imageUrl = inHeygen.preview_image_url;
          avatar.name = inHeygen.name;
          avatar.user = user;
          avatar.type = inHeygen.type;
          await manager.save(avatar);
          user.avatars.push(avatar);
        }

        const s = new Subtitles();
        s.color = "000000FF";
        s.fontFamily = "Helvetica";
        s.name = "По умолчанию";
        s.user = user;
        await manager.save(s);
      }

      await bot.sendMessage(user.id, 'Чем я могу помочь?');
    });


    await editing(bot);
    await generation(bot);
    await settings(bot);

    app.listen(5000);
  })
  .catch((error) => console.log(error));
