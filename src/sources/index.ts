import { QueueItem } from '../types';
import { getYtInfo } from './youtube'; // We'll update sources/youtube.ts to export this properly
import { resolveSpotifyUrl } from '../spotify/SpotifyResolver';

export async function resolveUrl(url: string, requesterId: string): Promise<QueueItem | QueueItem[]> {
    url = url.trim();
    if (!url) {
        throw new Error('Please provide a song name or supported media URL.');
    }

    const spotifyUri = url.match(/^spotify:(track|album|playlist):([a-zA-Z0-9]+)$/);
    if (spotifyUri) {
        url = `https://open.spotify.com/${spotifyUri[1]}/${spotifyUri[2]}`;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        // A slash command may provide a plain song title. Keep this separate
        // from arbitrary URL fetching so the HTTPS/source allowlist below
        // continues to protect the server from SSRF-style requests.
        if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.includes('://')) {
            throw new Error('Please provide a valid HTTPS URL.');
        }
        if (url.length > 200) {
            throw new Error('Search queries must be 200 characters or fewer.');
        }
        return getYtInfo(`ytsearch1:${url}`, requesterId);
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
