import { z } from "zod";
import { openai } from ".";
import { zodTextFormat } from "openai/helpers/zod";
import { IWord } from "./retranscribe";
import { Insertion } from "./entity/Insertion";


const ScriptAnalysis = z.object({
  script: z.string(),
  insertions: z.array(z.string())
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
  insertions: string[]
}> => {
  const res = await openai.responses.parse({
    model: 'gpt-4.1-nano',
    input: script,
    text: {
      format: zodTextFormat(ScriptAnalysis, 'result')
    },
    store: false,
    instructions: 'Ты - профессиональный режиссер. Тебе будет дан сценарий видео. Твоя задача -его проанализировать. Видео будет состоять из основного видео с использованием ИИ-Аватара, а также ИИ-генерированных вставок. В ответе укажи скрипт (текст, который говорит аватар) и промпты для генерации каждой из вставок. При этом сохрани порядок вставок таким же, каким он был во входных данных.'
  });
  if (!res.output_parsed) throw new Error("Could not parse");
  return res.output_parsed;
}


export const combineScriptAndInsertions = async (insertions: Insertion[], words: IWord[]): Promise<{
  start: number,
  end: number,
  id: number
}[]> => {
  const res = await openai.responses.parse({
    model: 'gpt-4.1-nano',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Транскрипция видео:\n${JSON.stringify(words)}`
          },
          {
            type: 'input_text',
            text: `Вставки:\n${insertions.map<string>(el => `Вставка (id: ${el.id}); Длительность: ${el.duration}; Описание: ${el.prompt};`).join('\n\n')}`
          }
        ],
      }
    ],
    text: {
      format: zodTextFormat(InsertionsData, 'result')
    },
    store: false,
    instructions: 'Ты - профессиональный режиссер. Тебе будет дана транскрипция видео (слова и время, когда они говорятся) и описание видео-вставок (ID, длительность вставки, описание). Определи, куда нужно вставить эти вставки. В ответе для каждой вставки укажи ее ID (обязательно один из переданных тебе!), время начала и время конца (может быть короче длительности вставки, если она не помещается по смыслу, но старайся избегать обрезания.).'
  });
  if (!res.output_parsed) throw new Error("could not parse");
  return res.output_parsed.insertions;
}