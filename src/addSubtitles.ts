import ffmpeg from "fluent-ffmpeg";

export const addSubtitles = async (
  videoPath: string,
  assPath: string,
  outPath: string
): Promise<void> => {
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters(`subtitles=${assPath}`)
      .output(outPath)
      .outputOptions("-c:a copy")
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
};
