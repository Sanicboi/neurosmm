import 'dotenv/config';
import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import express from 'express';
import { HeyGen } from "./HeyGen";
import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';
import { Video } from './entity/Video';
import OpenAI from 'openai';
import { SubtitleGenerator } from './subtitles';

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
                            text: 'Начать редактирование',
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
        let user = await manager.findOneBy(User, {
            id: msg.from.id,
        });
        if (!user) {
            user = new User();
            user.id = msg.from.id;
            await manager.save(user);
        }

        if (!user.avatarId || !user.voiceId) return await bot.sendMessage(user.id, 'Пожалуйста, перед генерацией выберите аватар и голос в меню настройки.');
        user.generating = true;
        await manager.save(user);
        await bot.sendMessage(user.id, 'Пришлите мне скрипт');
        
    });

    bot.on('callback_query', async (q) => {
        try {
            const user = await manager.findOneBy(User, {
                id: q.from.id
            });
            if (!user) return;

            if (q.data === 'settings-avatars') {
                await bot.sendMessage(user.id, 'Настройки автаров', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Текущий аватар',
                                    callback_data: 'current-avatar'
                                }
                            ],
                            [
                                {
                                    text: 'Все аватары',
                                    callback_data: 'all-avatars'
                                }
                            ]
                        ]
                    }
                })
            }

            if (q.data === 'all-avatars') {
                const res = await heygen.getAvatars();
                const avatars = (res).slice(0, 10);
                console.log(res);
                await bot.sendMediaGroup(q.from.id, avatars.map<TelegramBot.InputMedia>(el => {return {
                    media: el.preview_image_url,
                    type: 'photo'
                }}));
                await bot.sendMessage(user.id, 'Выберите аватар (идут по порядку слева направо, сверху вниз)', {
                    reply_markup: {
                        inline_keyboard: avatars.map<InlineKeyboardButton[]>((el, idx) => [{
                            text: `#${idx+1}`,
                            callback_data: `avatar-${el.avatar_id}`
                        }])
                    }
                });
            }

            if (q.data === 'current-avatar') {
                if (!user.avatarId) return await bot.sendMessage(user.id, 'У вас не выбран аватар', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Назад',
                                    callback_data: 'settings-avatars'
                                }
                            ]
                        ]
                    }
                })
                const avatar = await heygen.getAvatar(user.avatarId);
                await bot.sendVideo(user.id, avatar.preview_video_url, {
                    caption: 'Текущий аватар ' + avatar.name 
                });

            }

            if (q.data === 'settings-voice') {
                await bot.sendMessage(user.id, 'Настройки голоса', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Текущий голос',
                                    callback_data: 'current-voice'
                                }
                            ],
                            [
                                {
                                    text: 'Все голоса',
                                    callback_data: 'all-voices'
                                }
                            ],
                            
                        ]
                    }
                });
            }

            if (q.data === 'all-voices') {
                const voices = (await heygen.getVoices()).slice(0, 15);
                for (const v of voices) {
                    // await bot.sendAudio(user.id, v.preview_audio);
                }
                await bot.sendMessage(user.id, 'Выберите голос', {
                    reply_markup: {
                        inline_keyboard: voices.map<InlineKeyboardButton[]>(el => [{
                            text: el.name,
                            callback_data: `voice-${el.voice_id}`
                        }])
                    }
                });
            }

            if (q.data === 'current-voice') {
                if (!user.voiceId) return await bot.sendMessage(user.id, 'Вы не выбрали голос', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Назад',
                                    callback_data: 'settings-voice'
                                }
                            ]
                        ]
                    }
                });

                await bot.sendMessage(user.id, `ID голоса: ${user.voiceId}`);
            }

            if (q.data?.startsWith('avatar-')) {
                user.avatarId = q.data.substring(7);
                await manager.save(user);
                await bot.sendMessage(user.id, 'Аватар выбран!',{
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Назад",
                                    callback_data: "settings"
                                }
                            ]
                        ]
                    }
                });
    
    
            }
            if (q.data?.startsWith('voice-')) {
                user.voiceId = q.data.substring(6);
                await manager.save(user);
    
                
                await bot.sendMessage(user.id, 'Голос выбран!', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Назад",
                                    callback_data: "settings"
                                }
                            ]
                        ]
                    }
                });
            }

            if (q.data?.startsWith('edit-')) {
                const id = q.data.substring(5);
                const video = await manager.findOneBy(Video, {
                    id
                });
                if (!video) throw new Error("Video not found");

                await bot.sendMessage(q.from.id, 'Монтирую видео');
                const result = await subtitles.generate(video.url);
                await bot.sendMessage(q.from.id, 'Видео готово');
                video.file = result;
                await manager.save(video);
                await bot.sendVideo(q.from.id, result, {}, {
                    contentType: 'video/mp4'
                });
                
            }

            if (q.data === "settings") {
                await bot.sendMessage(q.from.id, 'Настрйоки', {
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
            }
        } catch (e) {
            console.error(e);
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
                                voice_id: user.voiceId,
                                speed: 0.8
                            }
                        }
                    ],
                    caption: false,
                    callback_id: String(user.id)
                });
                user.generating = false;
                await manager.save(user);
                await bot.sendMessage(user.id, 'Генерирую видео');
            }
        }
    });

    app.listen(5000);


}).catch(error => console.log(error))
