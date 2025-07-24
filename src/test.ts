import 'dotenv/config';
import { heygen } from './HeyGen';
import { AvatarType } from './avatarDB';

(async () => {


    const avatars = await heygen.getVoices();
    for (const a of avatars) {
        console.log(a.voice_id, a.gender, a.language);
    }
})();