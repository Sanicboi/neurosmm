import path, { resolve } from "path";
import fs from "fs/promises";
import { Readable, Writable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { v4 } from "uuid";
import { Subtitles } from "./entity/Subtitles";
import generator from "./subtitles";
import { Insertion } from "./entity/Insertion";
import { Fragment } from "./entity/Fragment";

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

  constructor(private _name: string, private _data: Buffer) {}

  public async init() {
    this._path = path.join(process.cwd(), "video", this._name);
    await fs.writeFile(this._path, this._data);
  }

  public async addVideoOverlay(insertion: Insertion, from: number, to: number) {
    const name = path.join(
      process.cwd(),
      "video",
      `insertion-${insertion.basename}`
    );
    const out = path.join(process.cwd(), "video", `${v4()}-${this._name}`);

    await fs.writeFile(name, insertion.data);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .addInput(this._path)
        .addInput(name)
        .complexFilter({
          filter: "overlay",
          options: {
            enable: `between(t\\,${from}\\,${to})`,
          },
          inputs: "[0:v][1:v]",
          outputs: "[v]",
        })
        .outputOptions([
          "-map [v]",
          "-map 0:a",
          "-c:v libx264",
          "-c:a aac",
          "-shortest",
        ])
        .output(out)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    await fs.rm(name);
    await fs.rm(this._path);
    this._path = out;
  }

  public get path() {
    return this._path;
  }

  public async addSubtitles(
    subtitles: Subtitles,
    words: string
  ): Promise<void> {
    const assPath: string = await generator.generate(
      subtitles,
      JSON.parse(words),
      this._path
    );

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

  public async pushVideo(fragment: Fragment): Promise<void> {
    const fragPath = `${fragment.index}.mp4`;
    const out = path.join(process.cwd(), "video", `${v4()}-${this._name}`);
    console.log(out);

    await fs.writeFile(
      path.join(process.cwd(), "video", fragPath),
      fragment.data
    );
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(this._path)
        .input(path.join(process.cwd(), "video", fragPath))
        .complexFilter([
          // scale and set fps for both videos, set aformat for both audios
          `[0:v]scale=${720}:${1280},fps=${30}[v0];` +
            `[1:v]scale=${720}:${1280},fps=${30}[v1];` +
            `[0:a]aformat=sample_rates=${48000}:channel_layouts=stereo[a0];` +
            `[1:a]aformat=sample_rates=${48000}:channel_layouts=stereo[a1];` +
            // now concat the standardized streams
            `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
        ])
        .outputOptions([
          "-map [v]",
          "-map [a]",
          "-movflags +faststart",
          "-f mp4",
          "-c:v libx264",
          "-c:a aac",
        ])
        .output(out)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    await fs.rm(path.join(process.cwd(), "video", fragPath));
    await fs.rm(this._path);
    this._path = out;
  }

  public async getBuffer(): Promise<Buffer> {
    return await fs.readFile(this._path);
  }
}
