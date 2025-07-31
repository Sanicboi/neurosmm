import fs from 'fs';
import path from 'path';
import { heygen } from './HeyGen';


export enum AvatarType {
    TalkingPhoto = 'talking_photo',
    Avatar = 'avatar'
}

export class Avatar {
    public constructor(
        public readonly id: string,
        public readonly voiceId: string,
        public readonly type: AvatarType,
        public readonly name: string
    ) {

    }


    public async getImagePreview(): Promise<string> {
        if (this.type === AvatarType.Avatar) {
            const res = await heygen.getAvatar(this.id);
            return res.preview_image_url;
        } else {
            const avatars = await heygen.getAvatars();
            const found = avatars.find(el => el.type === 'talking_photo' && el.talking_photo_id === this.id);
            if (!found) throw new Error("Not found!");
            return found.preview_image_url;
        }
    }

    public async getVoicePreview(): Promise<string> {
        const voices = await heygen.getVoices();
        const voice = voices.find(el => el.voice_id === this.id);
        if (!voice) throw new Error("Voice not found");
        return voice.preview_audio;
    }

    public static async build(id: string, voiceId: string, name: string): Promise<Avatar> {
        const avatars = await heygen.getAvatars();
        const av = avatars.find(el => {
            if (el.type === 'avatar') {
                return el.avatar_id === id
            }
            return el.talking_photo_id === id;
        });
        if (!av) throw new Error("Avatar not found");
        const voices = await heygen.getVoices();
        const voice = voices.find(el => el.voice_id === voiceId);
        if (!voice) throw new Error("Voice not found");
        return new Avatar(id, voiceId, av.type, name)
    }
}


class AvatarDatabase {

    private avatars: Avatar[];
    private filePath: string = path.join(process.cwd(), 'avatars', 'avatars.json');

    constructor() {
        const exists = fs.existsSync(this.filePath);
        if (!exists) {
            fs.writeFileSync(this.filePath, JSON.stringify([]), 'utf-8');
        }
        const avatars: {
            name: string,
            type: AvatarType,
            id: string,
            voiceId: string
        }[] = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.avatars = avatars.map<Avatar>(el => new Avatar(el.id, el.voiceId, el.type, el.name));
    }

    private save(): void {
        fs.writeFileSync(this.filePath, JSON.stringify(this.avatars), 'utf-8');
    }

    public add(avatar: Avatar): void {
        this.avatars.push(avatar);
        this.save();
    }

    public getAll(): Avatar[] {
        return this.avatars;
    }

    public getOne(id: string): Avatar | undefined {
        console.log(this.avatars);
        return this.avatars.find(el => el.id === id);
    }


}


export const db = new AvatarDatabase();