import { Readable } from "stream";
import { Insertion } from "./entity/Insertion";
import ffmpeg from "fluent-ffmpeg";

export const getDuration = async (buffer: Buffer): Promise<number> => {
  return await new Promise<number>((resolve, reject) => {
    const stream = Readable.from([buffer]);
    ffmpeg(stream).ffprobe((err, data) => {
      if (err) return reject(err);
      resolve(+data.streams[0].duration!);
    });
  });
};
