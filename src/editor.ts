import path, { resolve } from "path";
import fs from "fs/promises";
import { Readable, Writable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { v4 } from "uuid";

export interface IImage {
  source: Buffer;
  from: number;
  to: number;
  extension: string;
}

export class VideoEditor {
  private _path: string;

  constructor(private _name: string, private _buffer: Buffer) {}

  public async init() {
    this._path = path.join(process.cwd(), "video", `editing-${this._name}`);
    await fs.writeFile(this._path, this._buffer);
    return this;
  }

  public async addImages(images: IImage[]): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      images[i].source = await this.scaleDownImage(
        images[i].source,
        images[i].extension
      );
    }

    for (let i = 0; i < images.length; i++) {
      await this.addImageOverlay(images[i]);
    }
  }

  private async scaleDownImage(
    buffer: Buffer,
    extname: string
  ): Promise<Buffer> {
    const p = path.join(process.cwd(), "images", `${v4()}${extname}`);
    await fs.writeFile(p, buffer);
    await new Promise((resolve, reject) => {
      ffmpeg(path.join(process.cwd(), p))
        .videoFilters([
          {
            filter: "scale",
            options: "512:512",
          },
        ])
        .on("error", reject)
        .on("end", resolve)
        .output(path.join(process.cwd(), p))
        .run();
    });
    const b = await fs.readFile(p);
    await fs.rm(p);
    return b;
  }

  private async addImageOverlay(image: IImage): Promise<void> {
    const imagePath = path.join(
      process.cwd(),
      "images",
      `${v4()}${image.extension}`
    );
    await fs.writeFile(imagePath, image.source);

    await new Promise((resolve, reject) => {
      ffmpeg(this._path)
        .input(imagePath)
        .complexFilter([
          {
            filter: "overlay",
            options: {
              x: "(main_w-overlay_w)/2",
              y: "(main_h-overlay_h)/2",
              enable: `between(t\\,${image.from}\\,${image.to})`,
            },
          },
        ])
        .output(this._path.split('.').map((el, idx) => idx === 0 ? el + '1' : el).join('.'))
        .on("error", reject)
        .on("end", resolve)
        .run();
    });

    await fs.rm(imagePath);
  }

  public async cleanup() {
    await fs.rm(this._path);
  }

  public async getBuffer(): Promise<Buffer> {
    return await fs.readFile(this._path);
  }
}
