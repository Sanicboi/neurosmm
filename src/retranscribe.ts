import { openai } from ".";

export interface IWord {
    word: string;
    start: number;
    end: number;
}

export const retranscribe = async (buffer: Buffer): Promise<IWord[]> => {
    const file = new File([buffer], 'video.mp4', {type: 'video/mp4'});
    const res = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        timestamp_granularities: [
            'word',
        ],
        response_format: 'verbose_json'
    });
    return res.words!;
}