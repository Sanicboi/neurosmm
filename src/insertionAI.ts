import { z } from "zod";
import { Image } from "./entity/Image";
import { IImage } from "./editor";
import { openai } from ".";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import path from "path";
import { Video } from "./entity/Video";
import { Segment } from "./entity/Segment";

const Insertions = z.object({
  data: z.array(
    z.object({
      from: z.number(),
      to: z.number(),
    })
  ),
});

const Script = z.object({
  items: z.array(
    z.object({
      type: z.enum(["ai", "pre-rendered"]),
      text: z.optional(z.string()),
      index: z.optional(z.number()),
    })
  ),
});

export const insertImages = async (
  images: Image[],
  transcription: string
): Promise<IImage[]> => {
  let ids: string[] = [];
  let result: IImage[] = [];
  for (const image of images) {
    const r = await openai.files.create({
      file: new File([image.data], image.basename),
      purpose: "vision",
    });
    ids.push(r.id);
  }

  const res = await openai.responses.parse({
    model: "gpt-4o",
    instructions:
      "You are a scriptwriter for a video. You will be given a set of images and a transcription of a video. Look at the image and determine at which video time period it is supposed to be. For your response you have a structured json schema. THE ORDER OF YOUR IMAGES IN THE RESULT MUST BE THE SAME AS IN THE INPUT DATA!",
    input: [
      {
        role: "user",
        type: "message",
        content: [
          {
            type: "input_text",
            text: transcription,
          },
          ...images.map<ResponseInputContent>((el, idx) => ({
            type: "input_image",
            detail: "auto",
            file_id: ids[idx],
          })),
        ],
      },
    ],
    text: {
      format: zodTextFormat(Insertions, "result"),
    },
    store: false,
  });

  if (!res.output_parsed) throw new Error("Could not parse");
  for (let i = 0; i < res.output_parsed.data.length; i++) {
    result.push({
      extension: path.extname(images[i].basename),
      from: res.output_parsed.data[i].from,
      source: images[i].data,
      to: res.output_parsed.data[i].to,
    });
  }

  for (const id of ids) {
    await openai.files.del(id);
  }
  return result;
};

export const insertVideos = async (
  insertions: Segment[],
  prompt: string
): Promise<
  (
    | {
        type: "ai";
        text: string;
      }
    | {
        type: "pre-rendered";
        insertion: Segment;
      }
  )[]
> => {
  const res = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Описание видео и примерный скрипт: ${prompt}`,
          },
        ],
      },
    ],
    instructions:
      "You are a videographer. You will be given a description of a video that can be split into parts. Each part is either a pre-rendered fragment or an ai-generated part. You must, based on the input given, create a structure for the video. for each ai-generated part, give the script. For each pre-rendered part give its index (zero-based) based on the prompt given originally",
    text: {
      format: zodTextFormat(Script, "result"),
    },
  });

  if (!res.output_parsed) throw new Error("Could not parse");
  let result: (
    | {
        type: "ai";
        text: string;
      }
    | {
        type: "pre-rendered";
        insertion: Segment;
      }
  )[] = [];
  for (const el of res.output_parsed.items) {
    if (el.type === "ai") {
      result.push({
        type: "ai",
        text: el.text!,
      });
    } else {
      result.push({
        type: "pre-rendered",
        insertion: insertions[el.index!],
      });
    }
  }
  return result;
};
