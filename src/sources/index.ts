import { QueueItem } from '../types';
import { getYtInfo } from './youtube'; // We'll update sources/youtube.ts to export this properly
import { resolveSpotifyUrl } from '../spotify/SpotifyResolver';

export async function resolveUrl(url: string, requesterId: string): Promise<QueueItem | QueueItem[]> {
    if (url.includes('spotify.com')) {
        return resolveSpotifyUrl(url, requesterId);
    }

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        // Need to handle YouTube playlists in youtube.ts
        return getYtInfo(url, requesterId);
    }

    if (url.includes('soundcloud.com')) {
        // Use yt-dlp for SoundCloud for now (it supports it well)
        return getYtInfo(url, requesterId);
    }

    // Fallback to yt-dlp for everything else
    return getYtInfo(url, requesterId);
}
