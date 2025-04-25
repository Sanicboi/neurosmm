from dotenv import load_dotenv
import asyncio
from heygen import HeyGen
from flask import Flask, request
from aiogram import Bot, Dispatcher, Router, types
from os import getenv
load_dotenv()

heygen = HeyGen()
app = Flask(__name__)
bot = Bot(token=getenv('TELEGRAM_TOKEN'))
dp = Dispatcher()


userId = None
generating = False

@dp.message()
async def onMessage(message: types.Message):
    if message.text == '/generate':
        generating = True
        await message.answer("Пришлите мне скрипт вашего видео")
    elif generating:
        generating = False
        avatars = heygen.get_avatars()
        userId = message.from_user.id
        heygen.generate_video(avatar_id=avatars[0]['avatar_id'], voice_id='', voice_text=message.text, caption=True, callback_id=userId)

    


@app.post('/webhook')
async def webhook():
    event_type = request.json['event_type']
    if event_type == 'avatar_video.success':
        video_id = request.json['event_data']['video_id']
        url = request.json['event_data']['url']
        callback_id = request.json['event_data']['callback_id']
        await bot.send_message(int(callback_id), f"Video url: {url}")



async def main():
    dp.run_polling(bot)
    



if __name__ == "__main__":
    asyncio.run(main())