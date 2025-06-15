import axios, { AxiosResponse } from "axios";
import { openai } from ".";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { Subtitles } from "./entity/Subtitles";
import path from "path";
import { v4 } from "uuid";

/**
 * @example
 * const subtitlePath = await generator.generate();
 */
class SubtitleGenerator {
  constructor() {}

  private async transcribe(videoPath: string): Promise<
    {
      text: string;
      start: number;
      end: number;
    }[]
  > {
    const res = await openai.audio.transcriptions.create({
      file: fs.createReadStream(videoPath),
      model: "whisper-1",
      timestamp_granularities: ["word"],
      response_format: "verbose_json",
    });
    if (!res.words) throw new Error("Impossible");
    return res.words.map((el) => {
      return {
        text: el.word,
        end: el.end,
        start: el.start,
      };
    });
  }

  private formatTimeASS(t: number): string {
    const hours = Math.floor(t / 3600);
    const minutes = Math.floor((t % 3600) / 60);
    const seconds = Math.floor(t % 60);
    const centis = Math.floor((t % 1) * 100);
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  }

  private generateASS(
    words: {
      text: string;
      start: number;
      end: number;
    }[],
    dimensions: {
      width: number;
      height: number;
    },
    subtitles: Subtitles
  ): string {
    const header = `
  [Script Info]
  ScriptType: v4.00+
  PlayResX: ${dimensions.width}
  PlayResY: ${dimensions.height}
  Collisions: Normal

  [V4+ Styles]
  Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
  Style: Default,${subtitles.fontFamily},${subtitles.fontSize},&H${subtitles.color},&HFFFFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,2,2,${subtitles.marginL},${subtitles.marginR},${subtitles.marginV},0

  [Events]
  Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
  `;
    const events = words
      .reduce<
        {
          text: string;
          start: number;
          end: number;
        }[]
      >(
        (
          a: {
            text: string;
            start: number;
            end: number;
          }[],
          el
        ) => {
          const idx = a.length - 1;
          if (idx === -1 || !(a[idx].text.length < 7 && el.text.length < 7)) {
            a.push(el);
          } else {
            a[idx].text += " " + el.text;
            a[idx].end = el.end;
          }

          return a;
        },
        []
      )
      .map(
        (s) =>
          `Dialogue: 0,${this.formatTimeASS(s.start)},${this.formatTimeASS(
            s.end
          )},Default,,0,0,0,,${s.text.replace(/\n/g, "\\N")}`
      )
      .join("\n");
    return header + "\n" + events;
  }

  public async reTranscribe(videoPath: string): Promise<string> {
    const words = await this.transcribe(videoPath);
    return JSON.stringify(words);
  }

  private async getDimensions(file: string): Promise<{
    width: number;
    height: number;
  }> {
    return await new Promise<{
      width: number;
      height: number;
    }>((resolve, reject) => {
      ffmpeg.ffprobe(file, (err, metadata) => {
        if (err) return reject(err);
        const stream = metadata.streams.find((s) => s.codec_type === "video");
        if (!stream) return reject(new Error("No video stream found"));
        resolve({ width: stream.width!, height: stream.height! });
      });
    });
  }

  private async writeASSToFile(ass: string): Promise<string> {
    const p = path.join(process.cwd(), "subtitles", `${v4()}.ass`);
    await fs.promises.writeFile(p, ass, "utf-8");
    return p;
  }

  /**
   * Creates the subtitle file for the video
   * @param videoUrl
   */
  public async generate(
    subtitles: Subtitles,
    words: {
      text: string;
      start: number;
      end: number;
    }[],
    videoPath: string
  ): Promise<string> {

    // get the dimensions
    const dimension = await this.getDimensions(videoPath);

    // styled subtitles
    const ass = this.generateASS(words, dimension, subtitles);
    const filePath = await this.writeASSToFile(ass);

    return filePath;
  }

  public getPreviewFile(subtitles: Subtitles): Buffer {
    let content = `
      <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <style>
    p {
      font-size: ${subtitles.fontSize}px;
      font-family: ${subtitles.fontFamily};
      color: #${subtitles.color};
    }
    </style>
    <p>Вот так будет выглядеть текст субтитров</p>
</body>
</html>
    `;

    return Buffer.from(content, "utf-8");
  }
}


export default new SubtitleGenerator();