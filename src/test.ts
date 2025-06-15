import { Readable, Writable } from "typeorm/platform/PlatformTools";
import fs from 'fs/promises';
import path from "path";
import ffmpeg from 'fluent-ffmpeg';


(async () => {
  const buffer = await fs.readFile(path.join(process.cwd(), 'input.png'))

  const r = await new Promise<Buffer>((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(buffer);
    inputStream.push(null);
    let chunks: Uint8Array[] = [];
    const outputStream = new Writable({
      write(chunk: Uint8Array, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    outputStream.on("finish", () => {
      resolve(Buffer.concat(chunks));
    });

    ffmpeg(inputStream)
      .inputFormat("image2pipe")
      .outputOptions("-vf", "scale=512:512")
      .on("error", reject)
      .pipe(outputStream, { end: true });
  });

  await fs.writeFile(path.join(process.cwd(), 'output.png'), r);
})();
