import 'dotenv/config';
import { heygen } from './HeyGen';
import { AvatarType } from './avatarDB';
import path from 'path';
import { addOverlays } from './addOverlay';

(async () => {

    const inPath = path.join(process.cwd(), 'video.mp4');
    const i1Path = path.join(process.cwd(), 'ins1.mp4');
    const i2Path = path.join(process.cwd(), 'ins2.mp4');
    const outPath = path.join(process.cwd(), 'output.mp4');
    await addOverlays(inPath, [
        {
            from: 1,
            to: 2,
            path: i1Path
        },
        {
            from: 3,
            to: 4,
            path: i2Path
        }
    ], outPath);
})();