import ffmpeg from "fluent-ffmpeg";

export const addOverlays = async (
  mainOverlay: string,
  insertions: {
    path: string,
    from: number,
    to: number
  }[],
  out: string,
): Promise<void> => {
  await new Promise((resolve, reject) => {
    let cmd = ffmpeg().input(mainOverlay);
    for (const insertion of insertions) {
        cmd = cmd.input(insertion.path);
    }
    let filters: ffmpeg.FilterSpecification[] = [
    ];
    let lastOut: string = '0:v'
    for (let i = 0; i < insertions.length; i++) {
      const insertion = insertions[i];
        filters.push({
            filter: 'overlay',
            options: {
              enable: `between(t\\,${insertion.from}\\,${insertion.to})`
            },
            inputs: [`${i === 0 ? '0:v' : `tmp${i}`}`, `${i + 1}:v`],
            outputs: `tmp${i + 1}`
        });
        lastOut = `tmp${i + 1}`;
    }
      cmd
      .complexFilter(filters)
      .outputOptions([
        `-map [${lastOut}]`,
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
