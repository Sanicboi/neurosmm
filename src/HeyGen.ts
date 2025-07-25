import axios, { Axios, AxiosResponse } from "axios";
import { AvatarType } from "./avatarDB";

export interface IAvatar {
    type: AvatarType.Avatar;
    avatar_id: string;
    avatar_name: string;
    gender: string;
    premium: boolean;
    preview_image_url: string;
    preview_video_url: string;
}

export interface ISingleAvatar {
    id: string;
    type: AvatarType;
    name: string;
    gender: string;
    preview_video_url: string;
    preview_image_url: string;
}

export interface ITalkingPhoto {
    type: AvatarType.TalkingPhoto;
    talking_photo_id: string;
    talking_photo_name: string;
    preview_image_url: string;
}

export interface IVoice {
    voice_id: string;
    language: string;
    gender: 'Female' | 'Male' | 'unknown';
    name: 'string';
    preview_audio: string;
    support_pause: boolean;
    emotion_support: boolean;
    support_locale: boolean;
}

export interface ICreateVideo {
    caption?: boolean;
    title?: string;
    callback_id?: string;
    video_inputs: {
        character?: {
            type: AvatarType;
            avatar_id?: string;
            scale?: number;
            avatar_style?: 'circle' | 'normal' | 'closeup';
            offset?: {
                x: number;
                y: number;
            }
            matting?: boolean;
            circle_background_color?: string;
            talking_photo_id?: string;
        };
        voice?: {
            type: 'text';
            voice_id: string;
            input_text: string;
            speed?: number;
            pitch?: number;
            emotion?: 'Excited' | 'Friendly' | 'Serious' | 'Soothing' | 'Broadcaster';
            locale?: string;
        },
        background?: {
            type: 'image',
            url: string,
            fit: 'cover' | 'crop' | 'contain' | 'none'
        }
    }[];
    dimension: {
        width: number,
        height: number
    };
    folder_id?: string;
    callback_url?: string;
}

class HeyGen {

    private token: string = process.env.HEYGEN_TOKEN!;


    constructor() {

    }

    public async getAvatars(): Promise<(IAvatar | ITalkingPhoto)[]> {
        const res: AxiosResponse<{
            data: {
                avatars: IAvatar[],
                talking_photos: ITalkingPhoto[]
            }
        }> = await axios.get('https://api.heygen.com/v2/avatars', {
            headers: {
                'x-api-key': this.token
            }
        });
        let arr: (IAvatar | ITalkingPhoto)[] = [];
        arr = arr.concat(res.data.data.avatars.map<IAvatar>(el => {
            return {
                ...el,
                type: AvatarType.Avatar
            }
        }));
        arr = arr.concat(res.data.data.talking_photos.map<ITalkingPhoto>(el => {
            return {
                ...el,
                type: AvatarType.TalkingPhoto
            }
        }))
        return arr;
    }

    public async getAvatar(id: string): Promise<ISingleAvatar> {
        const res: AxiosResponse<{data: ISingleAvatar}> = await axios.get(`https://api.heygen.com/v2/avatar/${id}/details`, {
            headers: {
                'x-api-key': this.token
            }
        });
        return res.data.data;
    }

    public async getVoices(): Promise<IVoice[]> {
        const res: AxiosResponse<{
            data: {
                voices: IVoice[]
            }
        }> = await axios.get('https://api.heygen.com/v2/voices', {
            headers: {
                'x-api-key': this.token
            }
        });
        return res.data.data.voices;
    }

    public async generateVideo(data: ICreateVideo): Promise<any> {
        const res = await axios.post('https://api.heygen.com/v2/video/generate', data, {
            headers: {
                'x-api-key': this.token
            }
        });
    }
}

export const heygen = new HeyGen();