import axios, { AxiosResponse } from "axios"



export const genVideo = async (prompt: string): Promise<Buffer> => {
    const res: AxiosResponse<any> = await axios.post('https://api.segmind.com/v1/veo-3', {
        aspect_ratio: '9:16',
        prompt,
        seed: 0,
        generate_audio: true
    }, {
        headers: {
            'x-api-key': process.env.SEGMIND_KEY
        },
        responseType: 'arraybuffer'
    });

    return Buffer.from(res.data);
}