import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import sendVoices from "../helpers/sendVoices";
import { heygen } from "../HeyGen";
import { Voice } from "../entity/Voice";
import sendAvatars from "../helpers/sendAvatars";
import { Avatar } from "../entity/Avatar";
import subtitles from "../subtitles";
import { Subtitles } from "../entity/Subtitles";

const manager = AppDataSource.manager;
export default async (bot: TelegramBot) => {
  bot.onText(/\/settings/, async (msg) => {
    if (!msg.from) return;
    await bot.sendMessage(
      msg.from!.id,
      "Выберите раздел, который необходимо настроить",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Настройки голоса",
                callback_data: "settings-voice",
              },
            ],
            [
              {
                text: "Настройки аватаров",
                callback_data: "settings-avatars",
              },
            ],
            [
              {
                text: "Настройки субтитров",
                callback_data: "settings-subtitles",
              },
            ],
          ],
        },
      }
    );
  });

  bot.on("callback_query", async (q) => {
    if (q.data === "settings-voice") {
      await bot.sendMessage(q.from.id, "Настройки голоса", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Текущие голоса",
                callback_data: "current-voices",
              },
            ],
            [
              {
                text: "Добавить голос",
                callback_data: "add-voice",
              },
            ],
          ],
        },
      });
    }

    if (q.data === "current-voices") {
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          voices: true,
        },
      });
      if (!user) return;
      await sendVoices(bot, user, "getvoice-", true);
    }

    if (q.data === "add-voice") {
      const user = await manager.findOneBy(User, {
        id: q.from.id,
      });
      if (!user) return;
      user.waitingFor = "voice";
      await manager.save(user);
      await bot.sendMessage(
        user.id,
        'Пришлите мне ID голоса из хейген (Его можно найти, если при выборе голоса нажать на три точки и затем на "get voice id")'
      );
    }

    if (q.data?.startsWith("getvoice-")) {
      const voices = await heygen.getVoices();
      const v = await manager.findOneBy(Voice, {
        id: +q.data.substring(9),
      });
      if (!v) return;
      const voice = voices.find((el) => el.voice_id === v.heygenId)!;
      console.log(voice);
      await bot.sendAudio(q.from.id, voice.preview_audio, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Удалить голос",
                callback_data: "delete-voice",
              },
            ],
          ],
        },
      });
    }

    if (q.data === "delete-voice") {
    }

    if (q.data === "settings-avatars") {
      await bot.sendMessage(q.from.id, "Настройки аватара", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Текущие аватары",
                callback_data: "current-avatars",
              },
            ],
            [
              {
                text: "Добавить аватар",
                callback_data: "add-avatar",
              },
            ],
          ],
        },
      });
    }

    if (q.data === "add-avatar") {
      const user = await manager.findOneBy(User, {
        id: q.from.id,
      });
      if (!user) return;
      user.waitingFor = "avatar";
      await manager.save(user);
      await bot.sendMessage(
        user.id,
        'Для добавления аватара пришлите мне его ID из хейген. (ID аватара можно найти, если нажать на три точки при выборе аватар и нажать "copy avatar id")'
      );
    }

    if (q.data === "current-avatrs") {
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          avatars: true,
        },
      });
      if (!user) return;

      await sendAvatars(bot, user, "getavatar-");
    }

    if (q.data?.startsWith("setavatar-")) {
      const id = q.data.substring(10);
      const user = await manager.findOneBy(User, {
        id: q.from.id,
      });
      if (!user) return;
      const avatar = await heygen.getAvatar(id);
      const a = new Avatar();
      a.user = user;
      a.heygenId = id;
      a.name = avatar.name;
      await manager.save(a);

      await bot.sendMessage(user.id, "Аватар добавлен!", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Назад",
                callback_data: "settings-avatars",
              },
            ],
          ],
        },
      });
    }

    if (q.data?.startsWith("getavatar-")) {
      const avatar = await manager.findOneBy(Avatar, {
        id: +q.data.substring(10),
      });
      if (!avatar) return;

      const a = await heygen.getAvatar(avatar.heygenId);
      await bot.sendVideo(q.from.id, a.preview_video_url, {
        caption: "Аватар",
      });
    }

    if (q.data === "settings-subtitles") {
      const user = await manager.findOne(User, {
        where: {
          id: q.from.id,
        },
        relations: {
          subtitles: true,
        },
      });
      if (!user) return;
      await bot.sendMessage(q.from.id, "Текущие субтитры", {
        reply_markup: {
          inline_keyboard: user.subtitles.map<InlineKeyboardButton[]>((el) => [
            {
              text: el.name,
              callback_data: `subs-${el.id}`,
            },
          ]),
        },
      });
    }

    if (q.data?.startsWith("subs-")) {
      const id = q.data.substring(5);
      const subs = await manager.findOneBy(Subtitles, {
        id: +id,
      });
      if (!subs) return;

      await bot.sendDocument(
        q.from.id,
        subtitles.getPreviewFile(subs),
        {
          caption: "Вот так выглядит текст субтитров",
        },
        {
          contentType: "text/html",
          filename: "preview.html",
        }
      );
    }
  });

  bot.onText(/./, async (msg) => {
    if (!msg.from || !msg.text) return;
    if (msg.text?.startsWith("/")) return;
    const user = await manager.findOneBy(User, {
      id: msg.from!.id,
    });
    if (!user) return;

    if (user?.waitingFor === "avatar") {
      user.waitingFor = "none";
      await manager.save(user);
      try {
        const avatar = await heygen.getAvatar(msg.text!);
        const a = new Avatar();
        a.heygenId = avatar.id;
        a.imageUrl = avatar.preview_image_url;
        a.user = user;
        a.name = avatar.name;
        a.type = avatar.type;
        await manager.save(a);
        await bot.sendMessage(user.id, "Аватар добавлен", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "В библиотеку аватаров",
                  callback_data: "current-avatars",
                },
              ],
            ],
          },
        });
      } catch (error) {
        console.error(error);
        await bot.sendMessage(user.id, "Неверный ID аватара.", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Назад",
                  callback_data: "add-avatar",
                },
              ],
            ],
          },
        });
      }
    }

    if (user.waitingFor === "voice") {
      try {
        const voice = new Voice();
        voice.heygenId = msg.text!;
        const voices = await heygen.getVoices();
        const v = voices.find((el) => el.voice_id === msg.text!)!;
        voice.name = v.name;
        voice.user = user;
        user.waitingFor = "none";
        await manager.save(user);
        await manager.save(voice);
        await bot.sendMessage(user.id, "Голос добавлен");
      } catch (error) {
        await bot.sendMessage(user.id, "Голос не найден");
      }
    }
  });
};
