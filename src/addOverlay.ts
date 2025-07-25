import ffmpeg from "fluent-ffmpeg";

export const addOverlay = async (
  mainOverlay: string,
  insertion: string,
  out: string,
  from: number,
  to: number
): Promise<void> => {
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(mainOverlay)
      .input(insertion)
      .complexFilter([
        {
            filter: 'fps',
            options: 30,
            inputs: '0:v',
            outputs: 'main_fps'
        },
        {
            filter: 'fps',
            options: 30,
            inputs: '1:v',
            outputs: 'ins_fps'
        },
        {
          filter: "overlay",
          options: {
            enable: `between(t\\,${from}\\,${to})`,
          },
          inputs: ['main_fps', 'ins_fps'],
          outputs: "[v]",
        },
      ])
      .outputOptions([
        "-map [v]",
        "-map 0:a?",
        "-c:v libx264",
        "-c:a aac",
        "-shortest",
      ])
      .on("error", reject)
      .on("end", resolve)
      .output(out)
      .run();
  });
};
