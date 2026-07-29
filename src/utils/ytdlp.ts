import fs from 'fs';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { config } from '../config';
import {
    getCookiesFilePath,
    getYouTubeBrowserProfilePath,
    isYouTubeAuthenticated,
    isYouTubeBrowserProfileAvailable,
} from '../sources/youtubeAuth';
import { logger } from './logger';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const YOUTUBE_PROBE_URL = 'https://www.youtube.com/watch?v=BaW_jenozKc';
const MAX_CONCURRENT_PROCESSES = Math.max(
    1,
    Math.min(8, Number.parseInt(process.env.YTDLP_MAX_CONCURRENT || '3', 10) || 3)
);
const MAX_PENDING_PROCESSES = 20;

let activeProcesses = 0;
const waiting: Array<() => void> = [];

export interface YtDlpDiagnostics {
    status: 'disabled' | 'checking' | 'ready' | 'degraded';
    providerConfigured: boolean;
    providerReachable: boolean;
    providerVersion: string | null;
    pluginDetected: boolean;
    publicPlaybackProbe: boolean;
    lastCheckedAt: string | null;
    error: string | null;
}

let diagnostics: YtDlpDiagnostics = {
    status: process.env.YOUTUBE_POT_PROVIDER_URL ? 'checking' : 'disabled',
    providerConfigured: Boolean(process.env.YOUTUBE_POT_PROVIDER_URL),
    providerReachable: false,
    providerVersion: null,
    pluginDetected: false,
    publicPlaybackProbe: false,
    lastCheckedAt: null,
    error: null,
};

export function getYtDlpDiagnostics(): YtDlpDiagnostics {
    return { ...diagnostics };
}

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
        '--js-runtimes', 'node',
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

    // A dedicated, server-side Chromium profile avoids transferring account
    // cookies through the dashboard. It takes precedence over a legacy static
    // cookie file, but remains entirely optional.
    if (isYouTubeBrowserProfileAvailable()) {
        args.push('--cookies-from-browser', `chromium:${getYouTubeBrowserProfilePath()}`);
    } else if (isYouTubeAuthenticated()) {
        const cookiePath = getCookiesFilePath();
        if (fs.existsSync(cookiePath)) args.push('--cookies', cookiePath);
    }
    return args;
}

export async function checkYtDlpHealth(): Promise<YtDlpDiagnostics> {
    const providerUrl = process.env.YOUTUBE_POT_PROVIDER_URL;
    diagnostics = {
        status: providerUrl ? 'checking' : 'disabled',
        providerConfigured: Boolean(providerUrl),
        providerReachable: false,
        providerVersion: null,
        pluginDetected: false,
        publicPlaybackProbe: false,
        lastCheckedAt: new Date().toISOString(),
        error: null,
    };

    if (!providerUrl) {
        logger.info('[YouTube] PO-token provider is not configured; public playback will use yt-dlp defaults.');
        return getYtDlpDiagnostics();
    }

    try {
        const baseUrl = new URL(providerUrl);
        if (!['http:', 'https:'].includes(baseUrl.protocol)) {
            throw new Error('YOUTUBE_POT_PROVIDER_URL must be an HTTP(S) URL.');
        }

        const pingUrl = `${baseUrl.href.replace(/\/$/, '')}/ping`;
        const response = await fetch(pingUrl, { signal: AbortSignal.timeout(5_000) });
        if (!response.ok) {
            throw new Error(`PO-token provider health check returned HTTP ${response.status}.`);
        }
        const providerInfo = await response.json() as { version?: unknown };
        diagnostics.providerReachable = true;
        diagnostics.providerVersion = typeof providerInfo.version === 'string'
            ? providerInfo.version
            : null;

        const result = await runYtDlp([
            '--verbose',
            '--dump-single-json',
            '--skip-download',
            '--no-playlist',
            '--no-warnings',
            YOUTUBE_PROBE_URL,
        ], {
            timeoutMs: 45_000,
            maxOutputBytes: 4 * 1024 * 1024,
        });

        diagnostics.pluginDetected = /\[pot\]\s+PO Token Providers:.*bgutil:http/i.test(result.stderr);
        diagnostics.publicPlaybackProbe = result.stdout.trim().length > 0;
        if (!diagnostics.pluginDetected) {
            throw new Error('yt-dlp did not report the bgutil HTTP PO-token plugin.');
        }
        if (!diagnostics.publicPlaybackProbe) {
            throw new Error('yt-dlp did not return metadata for the public playback probe.');
        }

        diagnostics.status = 'ready';
        logger.info(
            `[YouTube] Server-side playback ready (PO provider ${diagnostics.providerVersion || 'unknown'}, bgutil plugin detected, Node challenge runtime enabled).`
        );
    } catch (error) {
        diagnostics.status = 'degraded';
        diagnostics.error = error instanceof Error ? error.message : String(error);
        logger.warn(`[YouTube] Server-side playback check is degraded: ${diagnostics.error}`);
    } finally {
        diagnostics.lastCheckedAt = new Date().toISOString();
    }

    return getYtDlpDiagnostics();
}

export interface YtDlpResult {
    stdout: string;
    stderr: string;
}

export async function runYtDlp(
    args: string[],
    options: { timeoutMs?: number; maxOutputBytes?: number } = {}
): Promise<YtDlpResult> {
    const commandArgs = [...getYtDlpBaseArgs(), ...args];
    const release = await acquireSlot();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

    return new Promise((resolve, reject) => {
        const child = spawn(config.paths?.ytdlp || 'yt-dlp', commandArgs, {
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
    const commandArgs = [...getYtDlpBaseArgs(), ...args];
    const release = await acquireSlot();
    const child = spawn(config.paths?.ytdlp || 'yt-dlp', commandArgs, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const releaseOnExit = () => release();
    child.once('close', releaseOnExit);
    child.once('error', releaseOnExit);
    return { process: child, release };
}
