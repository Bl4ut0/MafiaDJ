import { spawn } from 'child_process';
import { Readable } from 'stream';
import { config } from '../config';
import { logger } from '../utils/logger';
import { spawnYtDlp } from '../utils/ytdlp';

export async function createYtDlpStream(url: string): Promise<Readable> {
    const { process: ytDlp, release } = await spawnYtDlp([
        '-o', '-',
        '--quiet',
        '--no-playlist',
        '-f', 'bestaudio/best',
        url,
    ]);

    const ffmpeg = spawn(config.paths?.ffmpeg || 'ffmpeg', [
        '-nostdin',
        '-hide_banner',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-vn',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
    ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    let ytDlpError = '';
    let ffmpegError = '';
    let cleanedUp = false;
    let maxDurationTimer: NodeJS.Timeout | undefined;
    ytDlp.stderr.on('data', chunk => {
        ytDlpError = (ytDlpError + chunk.toString('utf8')).slice(-4_000);
    });
    ffmpeg.stderr.on('data', chunk => {
        ffmpegError = (ffmpegError + chunk.toString('utf8')).slice(-4_000);
    });

    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (maxDurationTimer) clearTimeout(maxDurationTimer);
        if (!ytDlp.killed) ytDlp.kill();
        if (!ffmpeg.killed) ffmpeg.kill();
        release();
    };

    ytDlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdin.on('error', cleanup);
    ytDlp.on('error', error => logger.error('[yt-dlp] Failed to start:', error));
    ffmpeg.on('error', error => logger.error('[ffmpeg] Failed to start:', error));
    ytDlp.on('close', code => {
        if (code && code !== 0) logger.warn(`[yt-dlp] Stream exited with code ${code}: ${ytDlpError}`);
        if (!ffmpeg.stdin.destroyed) ffmpeg.stdin.end();
    });
    ffmpeg.on('close', code => {
        if (code && code !== 0 && ffmpegError) {
            logger.warn(`[ffmpeg] Stream exited with code ${code}: ${ffmpegError}`);
        }
        cleanup();
    });
    ffmpeg.stdout.once('close', cleanup);
    ffmpeg.stdout.once('error', cleanup);
    const maxDurationSeconds = config.playback?.maxDurationSeconds ?? 4 * 60 * 60;
    maxDurationTimer = setTimeout(cleanup, (maxDurationSeconds + 30) * 1000);
    maxDurationTimer.unref();
    return ffmpeg.stdout;
}
