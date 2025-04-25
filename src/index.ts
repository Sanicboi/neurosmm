import 'dotenv/config';
import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import express from 'express';
import { HeyGen } from "./HeyGen";
import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';



AppDataSource.initialize().then(async () => {
    const manager = AppDataSource.manager;
    const app = express();
    const heygen = new HeyGen();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, {
        polling: true
    })

    app.post('/webhook', async (req: express.Request<any, any, {
        event_type: 'avatar_video.success',
        event_data: {
            video_id: string;
            url: string;
            callback_id: string;
        }
    }>, res) => {
        await bot.sendVideo(+req.body.event_data.callback_id, req.body.event_data.url, {
            caption: 'Видео готово'
        });
    });

    await bot.setMyCommands([
        {
            command: 'generate',
            description: 'Сгенерировать видео'
        }
    ])

    bot.onText(/\/generate/, async (msg) => {
        if (!msg.from) return;
        let user = await manager.findOneBy(User, {
            id: msg.from.id,
        });
        if (!user) {
            user = new User();
            user.id = msg.from.id;
            await manager.save(user);
        }

        const avatars = (await heygen.getAvatars()).slice(0, 10);
        await bot.sendMediaGroup(msg.from.id,avatars.map<TelegramBot.InputMedia>(el => {return {
            media: el.preview_image_url,
            type: 'photo'
        }}));
        await bot.sendMessage(user.id, 'Выберите аватар', {
            reply_markup: {
                inline_keyboard: avatars.map<InlineKeyboardButton[]>((el, idx) => [{
                    text: `#${idx+1}`,
                    callback_data: `avatar-${el.avatar_id}`
                }])
            }
        });
    });

    bot.on('callback_query', async (q) => {
        console.log(q);
        const user = await manager.findOneBy(User, {
            id: q.from.id
        });
        if (!user) return;
        if (q.data?.startsWith('avatar-')) {
            user.avatarId = q.data.substring(7);
            await manager.save(user);
            console.log('up to here');
            const voices = (await heygen.getVoices()).slice(0, 10);
            await bot.sendMessage(user.id, 'Выберите голос', {
                reply_markup: {
                    inline_keyboard: voices.map<InlineKeyboardButton[]>(el => [{
                        text: el.name,
                        callback_data: `voice-${el.voice_id}`
                    }])
                }
            });


        }
        if (q.data?.startsWith('voice-')) {
            user.voiceId = q.data.substring(6);
            user.generating = true;
            await manager.save(user);

            await bot.sendMessage(user.id, "Пришлите мне скрипт");
            
        }
        
    });

    bot.onText(/./, async (msg) => {
        if (!msg.text?.startsWith('/') && msg.from) {
            const user = await manager.findOneBy(User, {
                id: msg.from.id
            });
            if (!user) return;

            if (user.generating) {
                await heygen.generateVideo({
                    dimension: {
                        height: 1280,
                        width: 720
                    },
                    video_inputs: [
                        {
                            character: {
                                avatar_id: user.avatarId,
                                type: 'avatar',
                            },
                            voice: {
                                input_text: msg.text!,
                                type: 'text',
                                voice_id: user.voiceId
                            }
                        }
                    ]
                });
                user.generating = false;
                await manager.save(user);
                await bot.sendMessage(user.id, 'Генерирую и монтирую видео');
            }
        }
    })

    app.listen(5000);


}).catch(error => console.log(error))
