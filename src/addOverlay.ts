import ffmpeg from 'fluent-ffmpeg';

export const addOverlay = async (mainOverlay: string, insertion: string, out: string, from: number, to: number): Promise<void> => {
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(mainOverlay)
            .input(insertion)
            .complexFilter({
                filter: 'overlay',
                options: {
                    enable: `between(t\\,${from}\\,${to})`
                },
                inputs: "[0:v][1:v]",
                outputs: '[v]'
            })
            .outputOptions([
                '-map [v]',
                '-map 0:a?',
                '-c:v libx264',
                '-c:a aac',
                '-shortest'
            ])
            .on('error', reject)
            .on('end', resolve)
            .output(out)
            .run()
    })
}