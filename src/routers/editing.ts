import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { Subtitles } from "../entity/Subtitles";
import { VideoEditor } from "../editor";
import subtitles from "../subtitles";
import { getInsertions } from "../insertionAI";

const manager = AppDataSource.manager;
export default async (bot: TelegramBot) => {
  bot.on("callback_query", async (q) => {
    if (q.data === 'edit') {
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          videos: true,
          subtitles: true,
        },
      });
      if (!user) return;
      const id = +q.data.split("-")[1];
      const video = user.videos.find((el) => el.active);
      if (!video) return;

      await bot.sendMessage(q.from.id, "Выберите субтитры", {
        reply_markup: {
          inline_keyboard: user.subtitles.map<InlineKeyboardButton[]>((el) => [
            {
              text: el.name,
              callback_data: `subtitles-${el.id}`,
            },
          ]),
        },
      });
    }

    if (q.data?.startsWith("subtitles-")) {
      const id = +q.data.split("-")[1];
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          videos: {
            insertions: true,
            subtitles: true
          },
        },
      });
      if (!user) return;
      const video = user.videos.find((el) => el.active);
      if (!video) return;
      const subs = await manager.findOneBy(Subtitles, {
        id
      });
      if (!subs) return;
      video.subtitles = subs;
      await manager.save(video);

      await bot.sendMessage(user.id, 'Редактирую видео...');
      const editor = new VideoEditor(video.basename, video.file!);
      await editor.init();

      await bot.sendMessage(user.id, 'Ретранскрибирую видео с тайм-кодами...');


      const words = await subtitles.reTranscribe(editor.path);
      video.transcribed = words;
      await manager.save(video);

      await bot.sendMessage(user.id, 'Добавляю вставки...')
      const whereToAdd = await getInsertions(video.prompt, video.transcribed, video.insertions);
      for (const i of whereToAdd) {
        await editor.addVideoOverlay(i.insertion, i.from, i.to);
      }


      await bot.sendMessage(user.id, 'Добавляю субтитры...');
      await editor.addSubtitles(video.subtitles, words);

      
      const result = await editor.getBuffer();
      await editor.cleanup();


      video.active = false;
      video.file = result;
      await manager.save(video);
      await bot.sendVideo(user.id, result, {
        caption: 'Ваше видео',
      }, {
        filename: video.basename
      });
    }
  });
};
