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
import { analyzeVideoScript, findPosition } from "./insertionAI";
import { heygen } from "./HeyGen";
import { Insertion } from "./entity/Insertion";
import { genVideo } from "./videoGen";
import { getDuration } from "./getDuration";
import axios from "axios";
import { retranscribe } from "./retranscribe";
import fs from "fs";
import path from "path";
import { addOverlays } from "./addOverlay";
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
  Name = 'name',
  Background = 'background',
  Prompt = 'prompt'
}
let waiter: Waiter = Waiter.None;
let avId: string | null = null;
let voiceId: string | null = null;
let photoUrl: string | null = null;
let currentInsertions: {
    prompt: string;
    startWord: string;
    endWord: string;
}[] = [];
let currentScript: string = '';
let currentIndex: number = 0;

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
        console.log("Received webhook")
        if (!req.body) return res.status(400).end();
        if (req.body.event_type === "avatar_video.success") {
          console.log("Is correct type")
          const video = await manager.findOne(Video, {
            where: {
              id: +req.body.event_data.callback_id,
            },
          });
          if (!video) return res.status(200).end();
          console.log("Video found!");
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
          
        } else {
          console.log(req.body);
        }
        res.status(200).end()
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
      },
      {
        command: 'preview',
        description: 'Превью аватаров'
      }
    ]);

    bot.onText(/\/generate/, async (msg) => {
      await manager
        .createQueryBuilder(Video, "video")
        .delete()
        .where("video.finished = false")
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
        avId = id;
        waiter = Waiter.Background;
        await bot.sendMessage(q.from.id, "Пришлите картинку заднего фона. Она должна быть 720*1080");
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
        await bot.sendMessage(q.from.id, "Вставляю вставки...");
        let videoPath: string = path.join(process.cwd(), "video", "video.mp4");
        let outputPath: string = path.join(process.cwd(), 'video', 'insertions.mp4');
        fs.writeFileSync(videoPath, video.buffer);
        let insertions: {
          from: number,
          to: number,
          path: string
        }[] = []
        for (const insertion of video.insertions) {
          const location = await findPosition(words, {
            endWord: insertion.endWord,
            startWord: insertion.startWord,
          });
          console.log(`${location.start}--${location.end}`);

          let insPath = path.join(
            process.cwd(),
            "video",
            `${insertion.id}.mp4`
          );
          fs.writeFileSync(insPath, insertion.buffer);
          insertions.push({
            from: location.start,
            to: Math.min(location.end, location.start + insertion.duration),
            path: insPath
          });
        }

        await addOverlays(videoPath, insertions, outputPath);
        fs.rmSync(videoPath);
        for (const ins of insertions) {
          fs.rmSync(ins.path);
        }

        await bot.sendMessage(q.from.id, 'Вставки добавлены. Добавляю субтитры...');
        let outPath = path.join(process.cwd(), 'video', 'final.mp4');
        let assPath = path.join(process.cwd(), 'video', 'subtitles.ass');
        generateSubtitles(words, assPath);
        await addSubtitles(outputPath, assPath, outPath);
        fs.rmSync(outputPath);
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

      if (q.data?.startsWith('change-')) {
        const idx = +q.data.split(' ')[1];
        if (idx >= currentInsertions.length) return;
        waiter = Waiter.Prompt;
        currentIndex = idx;
        await bot.sendMessage(q.from.id, 'Пришлите мне новый промпт для этой вставки')
      }


      if (q.data === 'finish') {
        
        const video = await manager.findOne(Video, {
          where: {
            finished: false,
          }
        });
        if (!video) return;
        await bot.sendMessage(q.from.id, "Генерирую вставки...");
        for (const i of currentInsertions) {
          const insertion = new Insertion();
          insertion.video = video;
          insertion.buffer = await genVideo(i.prompt);
          insertion.duration = await getDuration(insertion.buffer);
          insertion.startWord = i.startWord;
          insertion.endWord = i.endWord;
          await manager.save(insertion);
          await bot.sendVideo(q.from.id, insertion.buffer, {
            caption: "Вставка готова",
          }, {
          contentType: 'video/mp4',
          filename: 'video.mp4'
        });
        }

        await bot.sendMessage(
          q.from.id,
          "Все вставки готовы. Начинаю генерировать хейген..."
        );
        const avatar = db.getOne(video.avatarId);
        if (!avatar) return;
        console.log("Found")
        try {
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
                input_text: currentScript,
                voice_id: avatar.voiceId,
                speed: 1.0,
              },
              background: {
                fit: 'cover',
                type: 'image',
                url: photoUrl!
              }
            },
          ],
          caption: false,
          callback_id: String(video.id),
        });
        } catch (error) {
          console.error(error);
        }

        console.log("Sent request");
      }
    });

    bot.on('photo', async (msg) => {
      if (!msg.photo) return;
      if (waiter !== Waiter.Background) return;
      let photo: TelegramBot.PhotoSize | null = null;
      for (const p of msg.photo) {
        if (p.height === 1080 && p.width === 720) {
          photo = p;
          break;
        }
      }
      if (!photo) return await bot.sendMessage(msg.chat.id, 'Фото неверного размера!');
      photoUrl = await bot.getFileLink(photo.file_id);
      waiter = Waiter.Script;
      await bot.sendMessage(msg.chat.id, 'Пришлите скрипт');
    })

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
        currentInsertions = analysis.insertions;
        currentScript = analysis.script;

        await bot.sendMessage(
          msg.chat.id,
          `Анализ:\nРечь ИИ-Аватара:${
            analysis.script
          }\n\nПромпты для вставок:\n${analysis.insertions.map(el => el.prompt).join("\n\n")}`,
          Keyboard([
            Btn('Начать генерацию', 'finish')
          ])
        );

        const video = await manager.findOne(Video, {
          where: {
            finished: false
          }
        });
        if (!video) return;
        video.voiceId = avatar.voiceId;
        video.avatarId = avatar.id;
        video.chatId = String(msg.chat.id);
        await manager.save(video);

        for (let i = 0; i < analysis.insertions.length; i++) {
          const insertion = analysis.insertions[i];
          await bot.sendMessage(msg.chat.id, `Вставка ${i+1}. Промпт: ${insertion.prompt}\nНачало: "...${insertion.startWord}..."\nКонец: "...${insertion.endWord}..."`, Keyboard([
            Btn('Редактировать промпт', `change-${i}`)
          ]))
        }

        
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
      } else if (waiter === Waiter.Prompt) {
        currentInsertions[currentIndex].prompt = msg.text!;
        currentIndex = 0;
        waiter = Waiter.None;
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        await bot.deleteMessage(msg.chat.id, msg.message_id - 1);
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

    bot.onText(/\/preview/, async (msg) => {
      const avatars = db.getAll();
      for (const avatar of avatars) {
        const photo = await avatar.getImagePreview();
        const audio = await avatar.getVoicePreview();
        await bot.sendPhoto(msg.chat.id, photo, {
          caption: `Аватар: ${avatar.name}`
        });
        await bot.sendAudio(msg.chat.id, audio, {
          caption:  `Голос аватара ${avatar.name}`
        });
      }
    })

    bot.onText(/\/add/, async (msg) => {
      waiter = Waiter.Avatar;
      await bot.sendMessage(msg.chat.id, 'Пришлите мне ID аватара из хейген');
    })

    app.listen(5000);
  })
  .catch((error) => console.log(error));
