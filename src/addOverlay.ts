import ffmpeg from "fluent-ffmpeg";

export const addOverlays = async (
  mainOverlay: string,
  insertions: {
    path: string;
    from: number;
    to: number;
  }[],
  out: string
): Promise<void> => {
  await new Promise((resolve, reject) => {
    let cmd = ffmpeg().input(mainOverlay);
    for (const insertion of insertions) {
      cmd = cmd.input(insertion.path);
    }
    let filters: ffmpeg.FilterSpecification[] = [];
    let lastOut: string = "0:v";
    for (let i = 0; i < insertions.length; i++) {
      const insertion = insertions[i];
      const overlayInputIndex = i + 1;
      const trimmed = `ol${i}`;
      filters.push({
        filter: 'trim',
        options: {
          duration: (insertion.to - insertion.from)
        },
        inputs: [`${overlayInputIndex}:v`],
        outputs: [trimmed],
      });

      filters.push({
        filter: 'scale',
        options: {
          w: 720,
          h: 1080
        },
        inputs: [trimmed],
        outputs: [trimmed+'s']
      })

      filters.push({
        filter: 'setpts',
        options: {
          expr: `PTS+${insertion.from}/TB`
        },
        inputs: [trimmed+'s'],
        outputs: [trimmed + 's' + 't']
      });

      const outName = `tmp${i + 1}`;
      filters.push({
        filter: "overlay",
        options: {
          enable: `between(t\\,${insertion.from}\\,${insertion.to})`,
        },
        inputs: [lastOut, trimmed + 's' + 't'],
        outputs: [outName],
      });
      lastOut = outName;
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
