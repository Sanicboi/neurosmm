import axios, { AxiosResponse } from "axios"



export const genVideo = async (prompt: string): Promise<Buffer> => {
    const res: AxiosResponse<any> = await axios.post('', {
        duration: 5,
        aspect_ratio: '9:16',
        prompt,
        resolution: '720p',
        seed: 56698,
        camera_fixed: false,
    }, {
        headers: {
            'X-Api-Key': `Bearer ${process.env.SEGMIND_KEY}`
        },
        responseType: 'arraybuffer'
    });

    return Buffer.from(res.data, 'base64');
}