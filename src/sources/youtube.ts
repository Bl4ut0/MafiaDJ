import { spawn } from 'child_process';
import { QueueItem } from '../types';
import { config } from '../config';

export async function getYtInfo(url: string, requesterId: string): Promise<QueueItem | QueueItem[]> {
    return new Promise((resolve, reject) => {
        const process = spawn((config as any).paths?.ytdlp || 'yt-dlp', [
            '--dump-json',
            // If it's a playlist URL, we might want --flat-playlist for speed, but then we lack duration/thumbnail often?
            // For now, full dump is safer for metadata, even if slower for large playlists.
            url
        ]);

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`yt-dlp exited with code ${code}: ${errorOutput}`));
            }

            try {
                const lines = output.trim().split('\n');
                const tracks: QueueItem[] = [];

                for (const line of lines) {
                    if (!line) continue;
                    try {
                        const info = JSON.parse(line);
                        tracks.push({
                            title: info.title || 'Unknown Title',
                            artist: info.uploader || 'Unknown Artist',
                            url: info.webpage_url || url,
                            thumbnail: info.thumbnail || '',
                            duration: info.duration || 0,
                            source: 'youtube',
                            requesterId: requesterId,
                            addedAt: Date.now()
                        });
                    } catch (e) {
                        // ignore parse errors line by line
                    }
                }

                if (tracks.length === 0) return reject(new Error('No tracks found'));
                if (tracks.length === 1) resolve(tracks[0]);
                else resolve(tracks);
            } catch (err) {
                reject(err);
            }
        });
    });
}

export async function searchYouTube(query: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const process = spawn((config as any).paths?.ytdlp || 'yt-dlp', [
            '--get-url',
            '--no-playlist',
            `ytsearch1:${query}` // Search for 1 result
        ]);

        let output = '';

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0 && output.trim().length > 0) {
                resolve(output.trim());
            } else {
                resolve(null);
            }
        });
    });
}
