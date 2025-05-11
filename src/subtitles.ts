import axios, { AxiosResponse } from "axios";
import path from "path";
import { openai } from ".";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough, Readable, Writable } from "stream";
import { v4 } from "uuid";
import { Subtitles } from "./entity/Subtitles";

export class SubtitleGenerator {
  constructor() {}

  private async fetchVideo(url: string | Buffer): Promise<string> {
    if (typeof url === 'string') {
      const res: AxiosResponse<Buffer> = await axios.get(url, {
      responseType: "arraybuffer",
      });
      await fs.promises.writeFile("./video.mp4", res.data);
    } else {
      await fs.promises.writeFile("./video.mp4", url);
    }
    return "./video.mp4";
  }

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
    .reduce<{
      text: string;
      start: number;
      end: number;
    }[]>((a: {
      text: string;
      start: number;
      end: number;
    }[], el) => {
      const idx = a.length - 1;
      if (idx === -1 || !(a[idx].text.length < 7 && el.text.length < 7)) {
        a.push(el);
      } else {
          a[idx].text += " " + el.text;
          a[idx].end = el.end;
      }

      return a;
    }, [])
      .map(
        (s) =>
          `Dialogue: 0,${this.formatTimeASS(s.start)},${this.formatTimeASS(
            s.end
          )},Default,,0,0,0,,${s.text.replace(/\n/g, "\\N")}`
      )
      .join("\n");
    return header + "\n" + events;
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
    await fs.promises.writeFile('.temp.ass', ass, "utf-8");
    return '.temp.ass';
  }

  private async appendSubtitles(videoPath: string, subtitlesPath: string): Promise<Buffer> {
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .videoFilters([
                {
                    filter: 'ass',
                    options: subtitlesPath
                }
            ])
            .outputOptions('-c:a copy')
            .on('end', resolve)
            .on('error', reject)
            .output('output.mp4')
            .run();
    });

    const buf =  await fs.promises.readFile('output.mp4');
    await this.cleanup('output.mp4');
    return buf;
  }

  private async cleanup(p: string) {
    await fs.promises.rm(p);
  }

  /**
   * Fetches the video and embeds the subtitles into it
   * @param videoUrl
   */
  public async generate(videoUrl: string | Buffer, subtitles: Subtitles): Promise<Buffer> {
    // fetch the video
    const file = await this.fetchVideo(videoUrl);

    // transcribe into words
    const words = await this.transcribe(file);

    // get the dimensions
    const dimension = await this.getDimensions(file);

    // styled subtitles
    const ass = this.generateASS(words, dimension, subtitles);
    const filePath = await this.writeASSToFile(ass);

    

    // editing the video
    const edited = await this.appendSubtitles(file, filePath);

    await Promise.all([
        async () => this.cleanup(file),
        async () => this.cleanup(filePath)
    ]);

    return edited;
  }
}
