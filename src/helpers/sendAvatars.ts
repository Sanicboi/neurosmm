import TelegramBot, { InlineKeyboardButton, InputMedia } from "node-telegram-bot-api";
import { User } from "../entity/User";

export default async (bot: TelegramBot, user: User, start: string) => {
  if (user.avatars.length === 0) {
    return await bot.sendMessage(user.id, "У вас нет аватаров", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Добавить",
              callback_data: "add-avatar",
            },
          ],
        ],
      },
    });
  }
  let media: InputMedia[] = [];
  for (const a of user.avatars) {
    media.push({
      media: a.imageUrl,
      type: "photo",
    });
  }

  await bot.sendMediaGroup(user.id, media);
  await bot.sendMessage(user.id, "Выберите аватар", {
    reply_markup: {
      inline_keyboard: user.avatars.map<InlineKeyboardButton[]>((el) => [
        {
          text: el.name,
          callback_data: start + el.id,
        },
      ]),
    },
  });
};
