import { Readable, Writable } from "typeorm/platform/PlatformTools";
import fs from "fs/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import axios from "axios";
import 'dotenv/config';

(async () => {
  const res = await axios.post('https://api.segmind.com/v1/seedance-v1-lite-text-to-video', 
    {
  "duration": 5,
  "aspect_ratio": "16:9",
  "prompt": "A whimsical underwater world thriving with marine life in kaleidoscope colors.",
  "resolution": "720p",
  "seed": 56698,
  "camera_fixed": false
}, {
  headers: {
    'x-api-key': process.env.SEGMIND_KEY
  },
  responseType: 'arraybuffer'
}
  );
  await fs.writeFile('test.mp4', Buffer.from(res.data));
})();
