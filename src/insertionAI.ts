import { z } from "zod";
import { openai } from ".";
import { zodTextFormat } from "openai/helpers/zod";
import { IWord } from "./retranscribe";
import { Insertion } from "./entity/Insertion";


const ScriptAnalysis = z.object({
  script: z.string(),
  insertions: z.array(z.object({
    prompt: z.string(),
    startWord: z.string(),
    endWord: z.string()
  }))
});

const InsertionsData = z.object({
  insertions: z.array(z.object({
    start: z.number(),
    end: z.number(),
    id: z.number()
  }))
})

export const analyzeVideoScript = async (script: string): Promise<{
  script: string,
  insertions: {
    prompt: string,
    startWord: string,
    endWord: string
  }[]
}> => {
  const res = await openai.responses.parse({
    model: 'gpt-4.1',
    input: script,
    text: {
      format: zodTextFormat(ScriptAnalysis, 'result')
    },
    store: false,
    instructions: 'Ты - профессиональный режиссер. Тебе будет дан сценарий видео. Твоя задача - его проанализировать. Видео будет состоять из основной части - ИИ-аватара, говорящего определнный текст (скрипт) и ии-генерируемых вставок. Сначала определи скрипт, а затем определи вставки. Для каждой вставки укажи промпт, чтобы ее сгенерировать, слово, на котором она появляется, и слово, на котором она исчезает. Вставки не должны перекрывать друг друга.'
  });
  if (!res.output_parsed) throw new Error("Could not parse");
  return res.output_parsed;
}


