import fs from 'fs';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { config } from '../config';
import { getCookiesFilePath, isYouTubeAuthenticated } from '../sources/youtubeAuth';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENT_PROCESSES = Math.max(
    1,
    Math.min(8, Number.parseInt(process.env.YTDLP_MAX_CONCURRENT || '3', 10) || 3)
);
const MAX_PENDING_PROCESSES = 20;

let activeProcesses = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<() => void> {
    if (activeProcesses >= MAX_CONCURRENT_PROCESSES) {
        if (waiting.length >= MAX_PENDING_PROCESSES) {
            throw new Error('The media worker queue is busy. Please try again shortly.');
        }
        await new Promise<void>(resolve => waiting.push(resolve));
    }
    activeProcesses += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        activeProcesses -= 1;
        waiting.shift()?.();
    };
}

export function getYtDlpBaseArgs(): string[] {
    const args = [
        '--ignore-config',
        '--socket-timeout', '15',
        '--retries', '3',
        '--fragment-retries', '3',
        '--extractor-retries', '2',
        '--retry-sleep', '1',
    ];

    const providerUrl = process.env.YOUTUBE_POT_PROVIDER_URL;
    if (providerUrl) {
        const parsed = new URL(providerUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('YOUTUBE_POT_PROVIDER_URL must be an HTTP(S) URL.');
        }
        args.push(
            '--extractor-args', 'youtube:player_client=mweb',
            '--extractor-args', `youtubepot-bgutilhttp:base_url=${parsed.href.replace(/\/$/, '')}`
        );
    }

    if (isYouTubeAuthenticated()) {
        const cookiePath = getCookiesFilePath();
        if (fs.existsSync(cookiePath)) args.push('--cookies', cookiePath);
    }
    return args;
}

export interface YtDlpResult {
    stdout: string;
    stderr: string;
}

export async function runYtDlp(
    args: string[],
    options: { timeoutMs?: number; maxOutputBytes?: number } = {}
): Promise<YtDlpResult> {
    const release = await acquireSlot();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

    return new Promise((resolve, reject) => {
        const child = spawn(config.paths?.ytdlp || 'yt-dlp', [...getYtDlpBaseArgs(), ...args], {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let outputBytes = 0;
        let settled = false;

        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            release();
            error ? reject(error) : resolve({ stdout, stderr });
        };

        const append = (target: 'stdout' | 'stderr', chunk: Buffer) => {
            outputBytes += chunk.length;
            if (outputBytes > maxOutputBytes) {
                child.kill();
                finish(new Error('yt-dlp produced more output than allowed.'));
                return;
            }
            if (target === 'stdout') stdout += chunk.toString('utf8');
            else stderr += chunk.toString('utf8');
        };

        child.stdout.on('data', chunk => append('stdout', chunk));
        child.stderr.on('data', chunk => append('stderr', chunk));
        child.on('error', error => finish(error));
        child.on('close', code => {
            if (code === 0) finish();
            else finish(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(-2_000)}`));
        });

        const timer = setTimeout(() => {
            child.kill();
            finish(new Error(`yt-dlp timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
        timer.unref();
    });
}

export async function spawnYtDlp(args: string[]): Promise<{
    process: ChildProcessWithoutNullStreams;
    release: () => void;
}> {
    const release = await acquireSlot();
    const child = spawn(config.paths?.ytdlp || 'yt-dlp', [...getYtDlpBaseArgs(), ...args], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const releaseOnExit = () => release();
    child.once('close', releaseOnExit);
    child.once('error', releaseOnExit);
    return { process: child, release };
}
