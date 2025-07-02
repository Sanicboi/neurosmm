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
    if (q.data === "edit") {
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
            subtitles: true,
            fragments: true,
          },
        },
      });
      if (!user) return;
      const video = user.videos.find((el) => el.active);
      if (!video) return;
      const subs = await manager.findOneBy(Subtitles, {
        id,
      });
      video.fragments = video.fragments.sort((a, b) => a.index - b.index)
      if (!subs) return;
      video.subtitles = subs;
      await manager.save(video);

      await bot.sendMessage(user.id, "Редактирую видео...");
      const editor = new VideoEditor(video.basename ?? 'video.mp4', video.file ?? video.fragments[0].data);
      await editor.init();
      let words: string;
      await bot.sendMessage(user.id, "Добавляю вставки...");
      
      if (video.insertionsType === "custom") {
        words = await subtitles.reTranscribe(editor.path);
        const whereToAdd = await getInsertions(
          video.prompt,
          words,
          video.insertions
        );
        for (const i of whereToAdd) {
          await editor.addVideoOverlay(i.insertion, i.from, i.to);
        }
      } else {
        for (let i = 0; i < video.fragments.length; i++) {
          if (i === 0) continue;
          await editor.pushVideo(video.fragments[i]);
        }

        words = await subtitles.reTranscribe(editor.path);
      }



      await bot.sendMessage(user.id, "Добавляю субтитры...");
      await editor.addSubtitles(video.subtitles, words);

      const result = await editor.getBuffer();
      await editor.cleanup();

      video.active = false;
      video.file = result;
      await manager.save(video);
      await bot.sendVideo(
        user.id,
        result,
        {
          caption: "Ваше видео",
        },
        {
          filename: video.basename,
        }
      );
    }
  });
};
