import 'dotenv/config';
import { heygen } from './HeyGen';
import { AvatarType } from './avatarDB';
import path from 'path';
import { addOverlays } from './addOverlay';
import { addSubtitles } from './addSubtitles';
import { generateSubtitles } from './generateSubtitles';

(async () => {

    const inPath = path.join(process.cwd(), 'video.mp4');
    const i1Path = path.join(process.cwd(), 'i1.mp4');
    const i2Path = path.join(process.cwd(), 'i2.mp4');
    const i3Path = path.join(process.cwd(), 'i3.mp4');
    const i4Path = path.join(process.cwd(), 'i4.mp4');
    const outPath = path.join(process.cwd(), 'output.mp4');
    await addOverlays(inPath, [
        {
            from: 1,
            to: 3,
            path: i1Path
        },
        {
            from: 8,
            to: 10,
            path: i2Path
        },
        {
            from: 12,
            to: 13,
            path: i3Path
        },
        {
            from: 15,
            to: 18,
            path: i4Path
        }
    ], outPath);
    generateSubtitles([
        {
            start: 0,
            end: 1,
            word: 'Hey'
        },
        {
            start: 1.5,
            end: 2,
            word: 'Hi'
        }
    ], '.temp.ass')
    await addSubtitles(outPath, '.temp.ass', path.join(process.cwd(), 'final.mp4'))
})();