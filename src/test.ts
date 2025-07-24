import 'dotenv/config';
import { heygen } from './HeyGen';
import { AvatarType } from './avatarDB';

(async () => {


    const avatars = await heygen.getAvatars();
    for (const a of avatars) {
        if (a.type === AvatarType.Avatar) {
            console.log(a.avatar_id);
        }
    }
})();