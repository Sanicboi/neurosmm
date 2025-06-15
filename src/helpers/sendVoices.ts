import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api";
import { User } from "../entity/User";
import { heygen } from "../HeyGen";

export default async (
  bot: TelegramBot,
  user: User,
  start: string,
  sendPreview: boolean
) => {
  if (user.voices.length === 0) {
    return await bot.sendMessage(user.id, "У вас нет голосов", {
      reply_markup: {
        inline_keyboard: [
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

  const voices = await heygen.getVoices();

  for (const v of user.voices) {
    const voice = voices.find((el) => el.voice_id === v.heygenId)!;
    console.log(voice.preview_audio);
    if (sendPreview)
      await bot.sendMessage(
        user.id,
        `Превью голоса ${voice.name}: ${voice.preview_audio}`
      );
  }

  await bot.sendMessage(user.id, "Выберите голос", {
    reply_markup: {
      inline_keyboard: user.voices.map<InlineKeyboardButton[]>((el) => [
        {
          text: el.name,
          callback_data: start + el.id,
        },
      ]),
    },
  });
};
