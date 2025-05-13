import 'dotenv/config';
import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import express from 'express';
import { HeyGen } from "./HeyGen";
import TelegramBot, { InlineKeyboardButton, InputMedia } from 'node-telegram-bot-api';
import { Video } from './entity/Video';
import OpenAI from 'openai';
import { SubtitleGenerator } from './subtitles';
import { Avatar } from './entity/Avatar';
import { Voice } from './entity/Voice';
import axios from 'axios';
import { Subtitles } from './entity/Subtitles';

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
});



AppDataSource.initialize().then(async () => {
    const manager = AppDataSource.manager;
    const app = express();
    const heygen = new HeyGen();
    const subtitleGenerator = new SubtitleGenerator();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, {
        polling: true
    })

    const sendWidgetAvatars = async (user: User, start: string) => {
        let media: InputMedia[] = [];
        for (const a of user.avatars) {
            media.push({
                media: a.imageUrl,
                type: 'photo'
            });
        }

        await bot.sendMediaGroup(user.id, media);
        await bot.sendMessage(user.id, 'Выберите аватар', {
            reply_markup: {
                inline_keyboard: user.avatars.map<InlineKeyboardButton[]>(el => [{
                    text: el.name,
                    callback_data: start + el.id 
                }])
            }
        });
    }
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
        video.file = (await axios.get(video.url, {
            responseType: 'arraybuffer'
        })).data;
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
	        user.avatars = [];
            await manager.save(user);
            const avatars = (await heygen.getAvatars()).filter(el => el.type === 'avatar').slice(0, 10);
            const voices = (await heygen.getVoices()).slice(0, 10);

            await bot.sendMessage(user.id, 'Собираю аватары и голоса...');


            for (const avatar of avatars) {
                const a = new Avatar();
                a.heygenId = avatar.avatar_id;
                a.name = avatar.avatar_name;
                a.user = user;
                a.imageUrl = avatar.preview_image_url;
		        user.avatars.push(a);
                await manager.save(a);
            }

            for (const voice of voices) {
                const v = new Voice();
                v.heygenId = voice.voice_id;
                v.name = voice.name;
                v.user = user;
                await manager.save(v);
            }

            const s = new Subtitles();
            s.color = '000000FF';
            s.fontFamily = 'Helvetica';
            s.name = 'По умолчанию';
            s.user = user;
            await manager.save(s);
        }
        
        await sendWidgetAvatars(user, 'genavatar-')
        
    });

    bot.on('callback_query', async (q) => {
        
        if (q.data?.startsWith('genavatar-')) {
            const avatar = await manager.findOneBy(Avatar, {
                id: +q.data.substring(10)
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
            const video = await manager.findOne(Video, {
                where: {
                    id: id
                },
                relations: {
                    user: {
                        subtitles: true
                    }
                }
            });
            if (!video) return;
            video.active = true;
            await manager.save(video);
            await bot.sendMessage(q.from.id, 'Выберите субтитры', {
                reply_markup: {
                    inline_keyboard: video.user.subtitles.map<InlineKeyboardButton[]>(el => [{
                        text: el.name,
                        callback_data: `subtitles-${el.id}`
                    }])
                }
            });
        }

        if (q.data?.startsWith('subtitles-')) {
            const id = +q.data.substring(10);
            const user = await manager.findOne(User, {
                where: {
                    id: q.from.id
                },
                relations: {
                    subtitles: true,
                    videos: true
                }
            });
            if (!user) return;
            const currentVideo = user.videos.find(el => el.active)!;
            const subtitles = user.subtitles.find(el => el.id === id)!;
            currentVideo.subtitles = subtitles;
            await manager.save(currentVideo);
            const res = await subtitleGenerator.generate(currentVideo.file, currentVideo.subtitles);
            currentVideo.file = res;
            await manager.save(currentVideo);
            await bot.sendVideo(user.id, currentVideo.file, {
                caption: 'Ваше видео'
            }, {
                contentType: 'video/mpeg',
                filename: 'video.mp4'
            });
        }

        if (q.data === 'settings-voice') {
            await bot.sendMessage(q.from.id, 'Настройки голоса', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Текущие голоса',
                                callback_data: 'current-voices'
                            }
                        ],
                        [
                            {
                                text: 'Добавить голос',
                                callback_data: 'add-voice'
                            }
                        ]
                    ]
                }
            });
            
        }   
        
        // if (q.data === 'add-voice') {
        //     await bot.sendMessage(q.from.id, 'Откуда вы хотит добавить голос?', {
        //         reply_markup: {
        //             inline_keyboard: [
        //                 [
        //                     {
        //                         text: 'Из HeyGen',
        //                         callback_data: 'voicefrom-heygen'
        //                     }
        //                 ],
        //                 [
        //                     {
        //                         text: 'Клонировать голос',
        //                         callback_data: 'voicefrom-clone'
        //                     }
        //                 ]
        //             ]
        //         }
        //     });
        // }

        if (q.data === 'voicefrom-heygen' || q.data?.startsWith('voicefrom-heygen-')) {
            let pageN = 1;
            if (q.data !== 'voicefrom-heygen') pageN = +q.data.substring(16);
            const all = await heygen.getVoices();
            const voices = (all).slice(0 * (pageN - 1), Math.min(10 * pageN, all.length));
            await bot.sendMessage(q.from.id, `Доступные голоса:\n${voices.map<string>(el => el.name).join('\n')}`, {
                reply_markup: {
                    inline_keyboard: [
                        ...voices.map<InlineKeyboardButton[]>(el => [{
                        text: el.name,
                        callback_data: `setvoice-${el.voice_id}`
                    }]),
                    all.length > (pageN * 10) ? [] : [{
                        text: 'Следующая страница',
                        callback_data: `voicefrom-heygen-${pageN + 1}`
                    }],
                    pageN === 1 ? [] : [{
                        text: 'Предыдущая страница',
                        callback_data: `voicefrom-heygen-${pageN - 1}`
                    }]
                ]
                }
            });
        }

        if (q.data?.startsWith('setvoice-')) {
            const user = await manager.findOneBy(User, {
                id: q.from.id
            });
            if (!user) return;
            const id = q.data.substring(9);
            const voices = await heygen.getVoices();
            const voice = voices.find(el => el.voice_id === id)!;
            const v = new Voice();
            v.heygenId = id;
            v.name = voice.name;
            v.selected = false;
            v.user = user;
            await manager.save(v);
            await bot.sendMessage(user.id, 'Голос добавлен', {
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
        }

        if (q.data === 'current-voices') {
            const user = await manager.findOne(User, {
                where: {
                    id: q.from.id
                },
                relations: {
                    voices: true
                }
            });
            if (!user) return;
            await bot.sendMessage(q.from.id, 'Ваши голоса', {
                reply_markup: {
                    inline_keyboard: user.voices.map<InlineKeyboardButton[]>(el => [{
                        text: el.name,
                        callback_data: `getvoice-${el.id}`
                    }])
                }
            })
        }

        if (q.data?.startsWith('getvoice-')) {
            const voices = await heygen.getVoices();
            const v = await manager.findOneBy(Voice, {
                id: +q.data.substring(9)
            });
            if (!v) return;
            const voice = voices.find(el => el.voice_id === v.heygenId)!;
            await bot.sendAudio(q.from.id, voice.preview_audio, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Удалить голос',
                                callback_data: 'delete-voice'
                            }
                        ]
                    ]
                }
            });
        }

        if (q.data === 'settings-avatars') {
            await bot.sendMessage(q.from.id, 'Настройки аватара', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Текущие аватары',
                                callback_data: 'current-avatars'
                            }
                        ],
                        [
                            {
                                text: 'Добавить аватар',
                                callback_data: 'add-avatar'
                            }
                        ]
                    ]
                }
            })
        }

        // if (q.data === 'add-avatar') {
        //     const avatars = (await heygen.getAvatars()).slice(0, 15);
        //     await bot.sendMessage(q.from.id, `Выберите аватара\n${avatars.map(el => el.type === 'avatar' ? el.avatar_name : el.talking_photo_name).join('\n')}`, {
        //         reply_markup: {
        //             inline_keyboard: avatars.map<InlineKeyboardButton[]>(el => el.type === 'avatar' ? [{
        //                 text: el.avatar_name,
        //                 callback_data: `setavatar-${el.avatar_id}`
        //             }] : [])
        //         }
        //     });
        // }

        if (q.data?.startsWith('setavatar-')) {
            const id = q.data.substring(10);
            const user = await manager.findOneBy(User, {
                id: q.from.id
            });
            if (!user) return; 
            const avatar = await heygen.getAvatar(id);
            const a = new Avatar();
            a.user = user;
            a.heygenId = id;
            a.selected = false;
            a.name = avatar.name;
            await manager.save(a);

            await bot.sendMessage(user.id, 'Аватар добавлен!', {
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
            });
        }

        if (q.data === 'current-avatars') {
            const user = await manager.findOne(User, {
                where: {
                    id: q.from.id
                },
                relations: {
                    avatars: true
                }
            });
            if (!user) return;

            await sendWidgetAvatars(user, 'getavatar-');
        }


        if (q.data?.startsWith('getavatar-')) {
            const avatar = await manager.findOneBy(Avatar, {
                id: +q.data.substring(10)
            });
            if (!avatar) return;

            const a = await heygen.getAvatar(avatar.heygenId);
            await bot.sendVideo(q.from.id, a.preview_video_url, {
                caption: 'Аватар'
            });
        }

        if (q.data === 'settings-subtitles') {
            // TODO
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
        await bot.sendMessage(msg.from!.id, 'Выберите раздел, который необходимо настроить', {
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
                    [
                        {
                            text: 'Настройки субтитров',
                            callback_data: 'settings-subtitles'
                        }
                    ]
                ]
            }
        });
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
