import { Readable, Writable } from "typeorm/platform/PlatformTools";
import fs from "fs/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

(async () => {

  await new Promise((resolve, reject) => {
    ffmpeg(path.join(process.cwd(), "input.png"))
      .videoFilters([
        {
          filter: "scale",
          options: "512:512",
        },
      ])
      .on("error", reject)
      .on('end', resolve)
      .output(path.join(process.cwd(), "output.png"))
      .run();
  })
})();
