import { Readable, Writable } from "typeorm/platform/PlatformTools";
import fs from "fs/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

(async () => {
  const videoPath = path.join(process.cwd(), 'input.mp4');
  const imagePath = path.join(process.cwd(), 'output.png')
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(imagePath)
      .complexFilter([
        {
          filter: "overlay",
          options: {
            x: "(main_w-overlay_w)/2",
            y: "(main_h-overlay_h)/2",
            enable: `between(t\\,${3}\\,${5})`,
          },
        },
      ])
      .output(videoPath)
      .on("error", reject)
      .on("end", resolve)
      .run();
  });
})();
