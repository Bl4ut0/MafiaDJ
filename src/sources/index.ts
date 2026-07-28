import { QueueItem } from '../types';
import { getYtInfo } from './youtube'; // We'll update sources/youtube.ts to export this properly
import { resolveSpotifyUrl } from '../spotify/SpotifyResolver';

export async function resolveUrl(url: string, requesterId: string): Promise<QueueItem | QueueItem[]> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('Please provide a valid HTTPS URL.');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('Only HTTPS media URLs are allowed.');
    }

    const host = parsed.hostname.toLowerCase();
    const isHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);

    if (isHost('spotify.com')) {
        return resolveSpotifyUrl(url, requesterId);
    }

    if (isHost('youtube.com') || isHost('youtu.be')) {
        // Need to handle YouTube playlists in youtube.ts
        return getYtInfo(url, requesterId);
    }

    if (isHost('soundcloud.com')) {
        // Use yt-dlp for SoundCloud for now (it supports it well)
        return getYtInfo(url, requesterId);
    }

    const directHosts = (process.env.DIRECT_MEDIA_HOSTS || '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    if (directHosts.some(domain => isHost(domain))) {
        return getYtInfo(url, requesterId);
    }

    throw new Error('Unsupported media source. Configure DIRECT_MEDIA_HOSTS to explicitly allow a direct media host.');
}
