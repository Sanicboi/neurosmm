import { z } from "zod";
import { Image } from "./entity/Image";
import { IImage } from "./editor";
import { openai } from ".";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {zodTextFormat} from 'openai/helpers/zod';
import path from "path";

const Insertions = z.object({
    data: z.array(z.object({
        from: z.number(),
        to: z.number(),
    }))
})

export default async(images: Image[], transcription: string): Promise<IImage[]> => {
    let ids: string[] = [];
    let result: IImage[] = [];
    for (const image of images) {
        const r = await openai.files.create({
            file: new File([image.data], image.basename),
            purpose: 'vision'
        });
        ids.push(r.id);
    }

    const res = await openai.responses.parse({
        model: 'gpt-4o',
        instructions: 'You are a scriptwriter for a video. You will be given a set of images and a transcription of a video. Look at the image and determine at which video time period it is supposed to be. For your response you have a structured json schema. THE ORDER OF YOUR IMAGES IN THE RESULT MUST BE THE SAME AS IN THE INPUT DATA!',
        input: [
            {
                role: 'user',
                type: 'message',
                content: [
                    {
                        type: 'input_text',
                        text: transcription,
                    },
                    ...images.map<ResponseInputContent>((el, idx) => ({
                        type: 'input_image',
                        detail: 'auto',
                        file_id: ids[idx],
                    }))
                ]
            }
        ],
        text: {
            format: zodTextFormat(Insertions, "result")
        },
        store: false
    });
    

    if (!res.output_parsed) throw new Error("Could not parse");
    for (let i = 0; i < res.output_parsed.data.length; i++) {
        result.push({
            extension: path.extname(images[i].basename),
            from: res.output_parsed.data[i].from,
            source: images[i].data,
            to: res.output_parsed.data[i].to
        });
    }

    for (const id of ids) {
        await openai.files.del(id);
    }
    return result;
}