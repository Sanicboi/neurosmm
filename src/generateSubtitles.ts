import { IWord } from "./retranscribe";
import fs from "fs";

const formatTimeASS = (t: number): string => {
  const hours = Math.floor(t / 3600);
  const minutes = Math.floor((t % 3600) / 60);
  const seconds = Math.floor(t % 60);
  const centis = Math.floor((t % 1) * 100);
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
};

const combineWords = (words: IWord[]): IWord[] => {
  return words.reduce<IWord[]>((a, curr) => {
    if (a.length === 0) {
      a.push(curr);
      return a;
    }

    const duration = curr.end - curr.start;
    const last = a.length - 1;
    const lastDuration = a[last].end - a[last].start;
    if (lastDuration + duration < 3) {
      a[last].end = curr.end;
      a[last].word += " " + curr.word;
    } else {
      a.push(curr);
    }

    return a;
  }, []);
};

const generateAss = (words: IWord[]): string => {
  const header = `
      [Script Info]
      ScriptType: v4.00+
      PlayResX: 720
      PlayResY: 1080
      Collisions: Normal
    
      [V4+ Styles]
      Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
      Style: Default,Vela Sans,40,&H00baff,&HFFFFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,2,2,60,60,60,0
    
      [Events
      Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      `;
  const events = words
    .map(
      (s) =>
        `Dialogue: 0,${formatTimeASS(s.start)},${formatTimeASS(
          s.end
        )},Default,,0,0,0,,${s.word.replace(/\n/g, "\\N")}`
    )
    .join("\n");
  return header + "\n" + events;
};
export const generateSubtitles = (words: IWord[], out: string): void => {
    const together = combineWords(words);
    const asString = generateAss(together);
    fs.writeFileSync(out, asString, 'utf-8');
};
