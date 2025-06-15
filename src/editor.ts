import path from "path";
import fs from 'fs/promises';
import { Readable, Writable } from "stream";
import ffmpeg from 'fluent-ffmpeg';

export interface IImage {
    source: Buffer;
    from: number;
    to: number;
    extension: string;
}

export class VideoEditor {

    private _path: string;

    constructor(private _name: string, private _buffer: Buffer) {

    }


    public async init() {
        this._path = path.join(process.cwd(), 'video', `editing-${this._name}`);
        await fs.writeFile(this._path, this._buffer);
        return this;
    }

    public async addImages(images: IImage[]): Promise<Buffer> {
        for (let i = 0; i < images.length; i++) {
            images[i].source = await this.scaleDownImage(images[i].source);
        }

        
    }

    private async scaleDownImage(buffer: Buffer): Promise<Buffer> {
        return await new Promise((resolve, reject) => {
            const inputStream = new Readable();
            inputStream.push(buffer);
            inputStream.push(null);
            let chunks: Uint8Array[] = [];
            const outputStream = new Writable({
                write(chunk: Uint8Array, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            });

            outputStream.on('finish', () => {
                resolve(Buffer.concat(chunks));
            });

            ffmpeg(inputStream)
                .inputFormat('image2pipe')
                .outputOptions('-vf', 'scale=512:512')
                .on('error', reject)
                .pipe(outputStream, {end: true});
        })
    }

    public async cleanup() {
        await fs.rm(this._path);
    }
}

