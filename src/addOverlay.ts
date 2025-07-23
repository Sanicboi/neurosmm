import ffmpeg from 'fluent-ffmpeg';

export const addOverlay = async (mainOverlay: string, insertion: string, out: string, from: number, to: number): Promise<void> => {
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(mainOverlay)
            .input(insertion)
            .complexFilter([
                `[1:v]scale=1080:720[ol]`,
                `[0:v][ol]overlay=enable='between(t,${from},${to})':eof_action=pass[outv]`
            ], 'outv')
            .outputOptions([
                '-map [outv]',
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