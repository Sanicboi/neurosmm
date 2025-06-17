import path, { resolve } from "path";
import fs from "fs/promises";
import { Readable, Writable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { v4 } from "uuid";
import { Subtitles } from "./entity/Subtitles";
import generator from './subtitles';
import { Segment } from "./entity/Segment";

export interface IImage {
  source: Buffer;
  from: number;
  to: number;
  extension: string;
}

/**
 *
 * @example
 * const editor = new VideoEditor("video.mp3", Buffer.from([...]));
 *
 * await editor.init();
 * await editor.addImages([...]);
 * await editor.addSubtitles(...);
 * const buffer = await editor.getBuffer();
 * await editor.cleanup();
 *
 */
export class VideoEditor {
  private _path: string;

  constructor(private _name: string, private _segments: Segment[]) {}

  public async init() {
    this._path = path.join(process.cwd(), "video", this._name);
    let fileNames: string[] = [];
    for (const segment of this._segments) {
      const p = path.join(process.cwd(), 'video', 'seg-' + v4() + '.mp4');
      await fs.writeFile(p, segment.data);
      fileNames.push(p);
    }

    await new Promise((resolve, reject) => {
      let cmd = ffmpeg();
      for (const i of fileNames) {
        cmd = cmd.input(i);
      }
      cmd.complexFilter([{
        filter: 'concat',
        options: {
          n: fileNames.length,
          v: 1,
          a: 1
        }
      }])
      .output(this._path)
      .on('end', resolve)
      .on('error', reject)
      .run()
    });

    for (const i of fileNames) {
      await fs.rm(i);
    }

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

  public get path() {
    return this._path;
  }

  private async scaleDownImage(
    buffer: Buffer,
    extname: string
  ): Promise<Buffer> {
    const basename = `${v4()}${extname}`;
    const inputPath = path.join(process.cwd(), "images", `input-${basename}`);
    const outputPath = path.join(process.cwd(), "images", `output-${basename}`);
    await fs.writeFile(inputPath, buffer);
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([
          {
            filter: "scale",
            options: "512:512",
          },
        ])
        .on("error", reject)
        .on("end", resolve)
        .output(outputPath)
        .run();
    });
    const b = await fs.readFile(outputPath);
    await fs.rm(inputPath);
    await fs.rm(outputPath);
    return b;
  }

  private async addImageOverlay(image: IImage): Promise<void> {
    const imagePath = path.join(
      process.cwd(),
      "images",
      `input-${v4()}${image.extension}`
    );
    await fs.writeFile(imagePath, image.source);

    const outputPath = path.join(
      process.cwd(),
      "video",
      `${v4()}${this._name}`
    );

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
        .output(outputPath)
        .on("error", reject)
        .on("end", resolve)
        .run();
    });

    await fs.rm(imagePath);
    await fs.rm(this._path);
    this._path = outputPath;
  }

  public async addSubtitles(subtitles: Subtitles, words: string): Promise<void> {
    const assPath: string = await generator.generate(subtitles, JSON.parse(words), this._path);

    const outputPath = path.join(
      process.cwd(),
      "video",
      `${v4()}${this._name}`
    );

    await new Promise((resolve, reject) => {
      ffmpeg(this._path)
        .videoFilters([
          {
            filter: "ass",
            options: assPath,
          },
        ])
        .output(outputPath)
        .outputOptions("-c:a copy")
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    await fs.rm(this._path);
    await fs.rm(assPath);
    this._path = outputPath;
  }

  public async cleanup() {
    await fs.rm(this._path);
  }

  public async getBuffer(): Promise<Buffer> {
    return await fs.readFile(this._path);
  }
}
