import axios, { AxiosResponse } from "axios"



export const genVideo = async (prompt: string): Promise<Buffer> => {
    const res: AxiosResponse<any> = await axios.post('https://www.segmind.com/models/seedance-v1-lite-text-to-video/api', {
        duration: 5,
        aspect_ratio: '9:16',
        prompt,
        resolution: '720p',
        seed: 56698,
        camera_fixed: false,
    }, {
        headers: {
            'x-api-key': `${process.env.SEGMIND_KEY}`
        },
        responseType: 'arraybuffer'
    });

    return Buffer.from(res.data);
}