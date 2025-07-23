import ffmpeg from "fluent-ffmpeg";

export const addSubtitles = async (
  videoPath: string,
  assPath: string,
  outPath: string
): Promise<void> => {
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters([
        {
          filter: "ass",
          options: assPath,
        },
      ])
      .output(outPath)
      .outputOptions("-c:a copy")
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
};
