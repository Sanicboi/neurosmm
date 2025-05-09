import 'dotenv/config';
import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import express from 'express';
import { HeyGen } from "./HeyGen";
import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';
import { Video } from './entity/Video';
import OpenAI from 'openai';
import { SubtitleGenerator } from './subtitles';
import { Avatar } from './entity/Avatar';
import { Voice } from './entity/Voice';

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
});

AppDataSource.initialize().then(async () => {
    const manager = AppDataSource.manager;
    const app = express();
    const heygen = new HeyGen();
    const subtitles = new SubtitleGenerator();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, {
        polling: true
    })
    app.use(express.json());
    app.post('/webhook', async (req: express.Request<any, any, {
        event_type: 'avatar_video.success',
        event_data: {
            video_id: string;
            url: string;
            callback_id: string;
        }
    }>, res) => {
        const video = new Video();
        video.id = req.body.event_data.video_id;
        video.user = new User();
        video.user.id = +req.body.event_data.callback_id;
        video.url = req.body.event_data.url;
        await manager.save(video);
        await bot.sendVideo(+req.body.event_data.callback_id, req.body.event_data.url, {
            caption: 'Видео готово',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Приступить к монтажу',
                            callback_data: `edit-${video.id}`
                        }
                    ]
                ]
            }
        });
        res.status(200).end()
    });

    await bot.setMyCommands([
        {
            command: 'generate',
            description: 'Сгенерировать видео'
        },
        {
            command: 'settings',
            description: 'Настройки'
        },
        {
            command: 'archive',
            description: 'Архив генерации'
        }
    ])

    bot.onText(/\/generate/, async (msg) => {
        if (!msg.from) return;
        let user = await manager.findOne(User, {
            where: {
                id: msg.from.id,
            },
            relations: {
                avatars: true
            }
        });

        if (!user) {
            user = new User();
            user.id = msg.from.id;
            await manager.save(user);
        }
        

        await bot.sendMessage(msg.from.id, 'Выберите аватар', {
            reply_markup: {
                inline_keyboard: user.avatars.map<InlineKeyboardButton[]>(el => [{
                    text: el.name,
                    callback_data:  `avatar-${el.id}`
                }])
            }
        });
        
    });

    bot.on('callback_query', async (q) => {
        
        if (q.data?.startsWith('avatar-')) {
            const avatar = await manager.findOneBy(Avatar, {
                id: +q.data.substring(7)
            });
            const user = await manager.findOne(User, {
                where: {
                    id: q.from.id,
                },
                relations: {
                    voices: true
                }
            })
            if (!avatar) return;
            avatar.selected = true;
            await manager.save(avatar);
            if (!user) return;


            await bot.sendMessage(q.from.id, `Аватар "${avatar.name}" выбран!`);
            await bot.sendMessage(q.from.id, 'Выберите голос озвучки', {
                reply_markup: {
                    inline_keyboard: [...user?.voices.map<InlineKeyboardButton[]>(el => [{
                        text: el.name,
                        callback_data: `voice-${el.id}`
                    }]), [{
                        text: 'Назад',
                        callback_data: 'generate'
                    }]]
                }
            });
        }

        if (q.data?.startsWith('voice-')) {
            const voice = await manager.findOneBy(Voice, {
                id: +q.data.substring(6)
            });
            if (!voice) return;
            voice.selected = true;
            await manager.save(voice);

            await bot.sendMessage(q.from.id, `Голос ${voice.name} выбран!`);
            await bot.sendMessage(q.from.id, 'Выберите формат генерации', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '720x1280',
                                callback_data: `res-720-1280`
                            }
                        ],
                        [
                            {
                                text: '1280x720',
                                callback_data: `res-1280-720`
                            }
                        ],
                        [
                            {
                                text: 'Назад',
                                callback_data: 'select-voice'
                            }
                        ]
                    ]
                    
                }
            });
        }

        if (q.data?.startsWith('res-')) {
            const spl = q.data.split('-');
            const width = +spl[1];
            const height = +spl[2];
            const user = await manager.findOneBy(User, {
                id: q.from.id
            });
            if (!user) return;
            user.resWidth = width;
            user.resHeight = height;
            user.generating = true;
            await manager.save(user);
            await bot.sendMessage(user.id, 'Разрешение выбрано!');
            await bot.sendMessage(user.id, 'Для генерации пришлите мне скрипт видео.');
        }

        if (q.data?.startsWith('edit-')) {
            const id = q.data.substring(5);
            await bot
        }
        
    });

    bot.onText(/\/archive/, async (msg) => {
        const user = await manager.findOne(User,{
            where: {
                id: msg.from?.id
            },
            relations: {
                videos: true
            }
        });
        if (!user) return;
        if (user.videos.length === 0) return await bot.sendMessage(user.id, 'У вас нет видео');

        for (const v of user.videos) {
            await bot.sendVideo(user.id, v.file ?? v.url, {
                reply_markup: {
                    inline_keyboard: v.file ? [] : [
                        [
                            {
                                text: 'Начать редактирование',
                                callback_data: `edit-${v.id}`
                            }
                        ]
                    ]
                }
            });
        }

    });

    bot.onText(/\/settings/, async (msg) => {
        await bot.sendMessage(msg.from!.id, 'Настрйоки', {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Настройки голоса',
                            callback_data: 'settings-voice'
                        }
                    ],
                    [
                        {
                            text: 'Настройки аватаров',
                            callback_data: 'settings-avatars'
                        }
                    ],
                    // [
                    //     {
                    //         text: 'Настройки субтитров',
                    //         callback_data: 'settings-subtitles'
                    //     }
                    // ]
                ]
            }
        })
    })

    bot.onText(/./, async (msg) => {
        if (!msg.text?.startsWith('/') && msg.from) {
            const user = await manager.findOneBy(User, {
                id: msg.from!.id
            });
            if (user?.generating) {
                await bot.sendMessage(user.id, 'Приступил к генерации');
                user.generating = false;
                await manager.save(user);
                const avatar = await manager.findOne(Avatar, {
                    where: {
                        selected: true,
                        user
                    }
                });
                const voice = await manager.findOne(Voice, {
                    where: {
                        user,
                        selected: true
                    }
                });
                if (!avatar || !voice) return;

                await heygen.generateVideo({
                    dimension: {
                        height: user.resHeight,
                        width: user.resWidth
                    },
                    video_inputs: [
                        {
                            character: {
                                type: 'avatar',
                                avatar_id: avatar.heygenId,
                                avatar_style: 'normal',
                            },
                            voice: {
                                type: 'text',
                                input_text: msg.text!,
                                voice_id: voice.heygenId,
                            }
                        }
                    ],
                    caption: false,
                    callback_id: String(user.id)
                });
            }
        }
    });

    app.listen(5000);


}).catch(error => console.log(error))
