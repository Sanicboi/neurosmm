import { z } from "zod";
import { openai } from ".";
import { zodTextFormat } from "openai/helpers/zod";
import { IWord } from "./retranscribe";
import { Insertion } from "./entity/Insertion";

const ScriptAnalysis = z.object({
  script: z.string(),
  insertions: z.array(
    z.object({
      prompt: z.string(),
      startWord: z.string(),
      endWord: z.string(),
    })
  ),
});

const InsertionPosition = z.object({
  start: z.number(),
  end: z.number(),
});

export const analyzeVideoScript = async (
  script: string
): Promise<{
  script: string;
  insertions: {
    prompt: string;
    startWord: string;
    endWord: string;
  }[];
}> => {
  const res = await openai.responses.parse({
    model: "gpt-4.1",
    input: script,
    text: {
      format: zodTextFormat(ScriptAnalysis, "result"),
    },
    store: false,
    instructions:
      "Ты - профессиональный режиссер. Тебе будет дан сценарий видео. Твоя задача - его проанализировать. Видео будет состоять из основной части - ИИ-аватара, говорящего определнный текст (скрипт) и ии-генерируемых вставок. Сначала определи скрипт, а затем определи вставки. Для каждой вставки укажи промпт, чтобы ее сгенерировать, слова, на котором она появляется, и слова, на котором она исчезает. Вставки не должны перекрывать друг друга.",
  });
  if (!res.output_parsed) throw new Error("Could not parse");
  return res.output_parsed;
};

export const findPosition = async (
  words: IWord[],
  insertion: {
    startWord: string;
    endWord: string;
  }
): Promise<{
  start: number;
  end: number;
}> => {
  const res = await openai.responses.parse({
    model: "gpt-4.1",
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Скрипт видео: ${words
              .map<string>((el) => `${el.word}: [${el.start}--${el.end}]`)
              .join("\n\n")}`,
          },
          {
            type: "input_text",
            text: `Данные вставки: Слова начала: "${insertion.startWord}" Слова конца: "${insertion.endWord}"`,
          },
        ],
      },
    ],
    store: false,
    instructions: 'Ты - профессиональный режиссер. тебе будет дан скрипт видео и описание видео-вставки, которую надо добавить в видео. Твоя задача - определить, на каком моменте ее нужно вставить. В ответе укажи время начала и конца (например, со 2й секунды по 4ую)',
    text: {
      format: zodTextFormat(InsertionPosition, 'result')
    }
  });
  if (!res.output_parsed) throw new Error("Could not parse!");
  return res.output_parsed;
};
