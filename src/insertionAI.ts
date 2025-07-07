import { z } from "zod";
import { openai } from ".";
import { zodTextFormat } from "openai/helpers/zod";
import { Insertion } from "./entity/Insertion";

const Script = z.object({
  text: z.string(),
});

const Insertions = z.object({
  insertions: z.array(
    z.object({
      from: z.number(),
      to: z.number(),
    })
  ),
});

const Fragments = z.object({
  fragments: z.array(
    z.object({
      type: z.enum(['avatar', 'ai']),
      script: z.optional(z.string()),
      prompt: z.optional(z.string())
    })
  )
})

export const getScript = async (prompt: string): Promise<string> => {
  const res = await openai.responses.parse({
    input: prompt,
    model: "gpt-4o",
    instructions:
      "You will be given a prompt for an AI video maker. The prompt has information about a video. The information usually contains two different parts - the script of a video and the descriptions of pre-made fragments and where they should be put. Extract THE SCRIPT from the prompt.",
    store: false,
    text: {
      format: zodTextFormat(Script, "result"),
    },
  });

  if (!res.output_parsed) throw new Error("Could not parse!");
  return res.output_parsed.text;
};

export const getInsertions = async (
  prompt: string,
  transcription: string,
  insertions: Insertion[]
): Promise<
  {
    from: number;
    to: number;
    insertion: Insertion;
  }[]
> => {
  const res = await openai.responses.parse({
    input: [
      {
        role: "user",
        type: "message",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
          {
            type: "input_text",
            text: transcription,
          },
        ],
      },
    ],
    model: "gpt-4o",
    store: false,
    text: {
      format: zodTextFormat(Insertions, "result"),
    },
    instructions:
      "You will be given a prompt for the creation of a video and the transcript of it. Based on the prompt, the video must have some parts that are inserted (insertions). Based on the script and the timed transcription, determine, where they must be. Keep their order the same as in the video.",
  });

  if (!res.output_parsed) throw new Error("Could not parse");

  let result: {
    from: number;
    to: number;
    insertion: Insertion;
  }[] = [];

  for (let i = 0; i < res.output_parsed.insertions.length; i++) {
    result.push({
      from: res.output_parsed.insertions[i].from,
      to: res.output_parsed.insertions[i].to,
      insertion: insertions[i],
    })
  }

  return result;
};

export const splitterAI = async (
  prompt: string
): Promise<{
  type: 'ai' | 'avatar',
  script?: string,
  prompt?: string
}[]> => {
  let result = [];
  const res = await openai.responses.parse({
    instructions: 'Ты - профессиональный режиссер. Тебе будет дан промпт-сценарий для видео. Твоя задача - продумать его и разбить его на части. Каждая часть - это либо видео с ии-аватаром, где он говорит определенный текст, либо видео, сгенерированное с помощью ИИ. В ответе определи данные фрагменты и дай их описание. Для аватара нужно дать его слова, для ии-видео - промпт для нейросети. Видео должно суммарно быть меньше минуты.',
    input: prompt,
    model: 'gpt-4.1',
    store: false,
    text: {
      format: zodTextFormat(Fragments, 'result')
    }
  });
  if (!res.output_parsed) throw new Error("Could not parse");
  return res.output_parsed.fragments;
}
