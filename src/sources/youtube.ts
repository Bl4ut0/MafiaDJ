import { QueueItem } from '../types';
import { config } from '../config';
import { runYtDlp } from '../utils/ytdlp';

const MAX_PLAYLIST_ITEMS = config.playback?.maxQueueLength ?? 200;
const MAX_DURATION_SECONDS = config.playback?.maxDurationSeconds ?? 4 * 60 * 60;

function toQueueItem(info: any, fallbackUrl: string, requesterId: string): QueueItem | null {
    const duration = Number(info.duration) || 0;
    if (duration > MAX_DURATION_SECONDS || info.is_live === true || info.live_status === 'is_live') {
        return null;
    }
    return {
        title: String(info.title || 'Unknown Title').slice(0, 300),
        artist: String(info.uploader || info.channel || 'Unknown Artist').slice(0, 300),
        url: info.webpage_url || info.original_url || fallbackUrl,
        thumbnail: typeof info.thumbnail === 'string' ? info.thumbnail : '',
        duration,
        source: 'youtube',
        requesterId,
        addedAt: Date.now(),
    };
}

export async function getYtInfo(url: string, requesterId: string): Promise<QueueItem | QueueItem[]> {
    const { stdout } = await runYtDlp([
        '--dump-json',
        '--skip-download',
        '--playlist-end', String(MAX_PLAYLIST_ITEMS),
        '--no-warnings',
        url,
    ], {
        timeoutMs: 60_000,
        maxOutputBytes: 8 * 1024 * 1024,
    });

    const tracks = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => {
            try {
                return toQueueItem(JSON.parse(line), url, requesterId);
            } catch {
                return null;
            }
        })
        .filter((track): track is QueueItem => track !== null);

    if (tracks.length === 0) {
        throw new Error('No playable tracks were found within the configured duration limit.');
    }
    return tracks.length === 1 ? tracks[0] : tracks;
}

export async function searchYouTube(query: string): Promise<string | null> {
    const { stdout } = await runYtDlp([
        '--dump-single-json',
        '--skip-download',
        '--no-playlist',
        '--no-warnings',
        `ytsearch1:${query.slice(0, 200)}`,
    ]);
    const result = JSON.parse(stdout);
    const first = result.entries?.[0] ?? result;
    return first?.webpage_url || (first?.id ? `https://www.youtube.com/watch?v=${first.id}` : null);
}
