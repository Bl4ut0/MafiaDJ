import { spawn } from 'child_process';
import { Readable } from 'stream';
import { config } from '../config';
import { logger } from '../utils/logger';

export function createYtDlpStream(url: string): Readable {
    // yt-dlp arguments to stream audio
    const ytDlp = spawn((config as any).paths?.ytdlp || 'yt-dlp', [
        url,
        '-o', '-',
        '-q',
        '-f', 'bestaudio',
        '--no-playlist' // for single track
    ]);

    // ffmpeg arguments to convert to opus/pcm (or just s16le for Discord)
    const ffmpeg = spawn((config as any).paths?.ffmpeg || 'ffmpeg', [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-loglevel', 'error',
        'pipe:1'
    ]);

    ytDlp.stdout.pipe(ffmpeg.stdin);

    // Proper logging of stderr buffers
    ytDlp.stderr.on('data', (data) => {
        // logger.debug(`[yt-dlp]: ${data.toString()}`);
    });

    ytDlp.on('error', (err) => {
        logger.error(`[yt-dlp error]:`, err);
    });

    ffmpeg.stderr.on('data', (data) => {
        // logger.debug(`[ffmpeg]: ${data.toString()}`);
    });

    ffmpeg.on('error', (err) => {
        logger.error(`[ffmpeg error]:`, err);
    });

    ffmpeg.on('close', () => {
        if (!ytDlp.killed) ytDlp.kill();
    });

    return ffmpeg.stdout;
}
