import axios, { AxiosResponse } from "axios";
import path from "path";
import { openai } from ".";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough, Readable, Writable } from "stream";
import { v4 } from "uuid";

export class SubtitleGenerator {
  constructor() {}

  private async fetchVideo(url: string): Promise<Buffer> {
    const res: AxiosResponse<Buffer> = await axios.get(url, {
      responseType: "arraybuffer",
    });
    return res.data;
  }

  private async transcribe(
    video: Buffer,
    url: string
  ): Promise<
    {
      text: string;
      start: number;
      end: number;
    }[]
  > {
    const file = new File([video], path.basename(url));
    const res = await openai.audio.transcriptions.create({
      file,
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
    }[]
  ): string {
    const lines = words.map((el) => {
      return `Dialogue: 0,${this.formatTimeASS(el.start)},${this.formatTimeASS(
        el.end
      )},Default,,0,0,0,,${el.text}`;
    });

    return (
      `
[Script Info]
Title: StyledSubs
ScriptType: v4.00+
Collisions: Normal
PlayResY: 1280
PlayResX: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,3,2,10,10,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text` + "\n" +
      lines.join("\n")
    );
  }

  private writeASSToFile(ass: string, url: string): string {
    const name = path.basename(url);
    const p = path.join(process.cwd(), "audio", v4() + '.ass');
    fs.writeFileSync(p, ass, "utf-8");
    console.log(p);
    return p;
  }

  private bufferToStream(buffer: Buffer): Readable {
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    return readable;
  }

  private async appendSubtitles(p: string, video: Buffer): Promise<Buffer> {
    let chunks: Uint8Array[] = [];
    const outStream = new PassThrough();
    const inStream = this.bufferToStream(video);
    outStream.on("data", (chunk) => {
      chunks.push(chunk);
      console.log(chunks.length);
    });
    const result = await new Promise<Buffer>((resolve, reject) => {
      outStream.on("error", (err) => {
        console.error("Error", err);
        reject(err);
      });
      outStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      ffmpeg()
        .input(inStream)
        .inputFormat("mp4")
        .videoFilter(`ass=${p}`)
        .format('mp4')
        .outputOptions([
          "-movflags",
          "frag_keyframe+empty_moov",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-c:a",
          "aac",
        ])
        .output(outStream)
        .on("error", (err) => {
          console.error("FFmpeg err", err);
          reject(err);
        })
        .run();
    });

    return result;
  }

  private cleanup(p: string) {
    fs.rmSync(p);
  }

  /**
   * Fetches the video and embeds the subtitles into it
   * @param videoUrl
   */
  public async generate(videoUrl: string): Promise<Buffer> {
    // fetch the video
    const video = await this.fetchVideo(videoUrl);

    // transcribe into words
    const words = await this.transcribe(video, videoUrl);

    // styled subtitles
    const ass = this.generateASS(words);
    const filePath = this.writeASSToFile(ass, videoUrl);

    console.log(video.length);

    // editing the video
    const edited = await this.appendSubtitles(filePath, video);

    // cleanup
    this.cleanup(filePath);

    return edited;
  }
}
