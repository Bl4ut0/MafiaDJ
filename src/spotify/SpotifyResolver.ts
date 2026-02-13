import SpotifyAPI from './SpotifyAPI';
import { QueueItem } from '../types';

export async function resolveSpotifyUrl(url: string, requesterId: string): Promise<QueueItem | QueueItem[]> {
    // Regex for Track, Album, Playlist
    const trackRegex = /spotify\.com\/track\/([a-zA-Z0-9]+)/;
    const albumRegex = /spotify\.com\/album\/([a-zA-Z0-9]+)/;
    const playlistRegex = /spotify\.com\/playlist\/([a-zA-Z0-9]+)/;

    const trackMatch = url.match(trackRegex);
    if (trackMatch) {
        const id = trackMatch[1];
        const data = await SpotifyAPI.getTrack(id);
        const track: QueueItem = {
            title: data.name,
            artist: data.artists.map(a => a.name).join(', '),
            url: data.external_urls.spotify,
            thumbnail: data.album.images[0]?.url || '',
            duration: Math.round(data.duration_ms / 1000),
            source: 'spotify',
            requesterId,
            addedAt: Date.now()
        };
        return track;
    }

    const albumMatch = url.match(albumRegex);
    if (albumMatch) {
        const id = albumMatch[1];
        const data = await SpotifyAPI.getAlbum(id);
        const tracks: QueueItem[] = data.tracks.items.map(t => ({
            title: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            url: t.external_urls.spotify,
            thumbnail: data.images[0]?.url || '', // Album art for all
            duration: Math.round(t.duration_ms / 1000),
            source: 'spotify',
            requesterId,
            addedAt: Date.now()
        }));
        return tracks;
    }

    const playlistMatch = url.match(playlistRegex);
    if (playlistMatch) {
        const id = playlistMatch[1];
        const data = await SpotifyAPI.getPlaylist(id);
        const tracks: QueueItem[] = data.tracks.items.map(item => {
            const t = item.track;
            if (!t) return null; // Handle null tracks
            return {
                title: t.name,
                artist: t.artists.map(a => a.name).join(', '),
                url: t.external_urls.spotify,
                thumbnail: t.album.images[0]?.url || '',
                duration: Math.round(t.duration_ms / 1000),
                source: 'spotify',
                requesterId,
                addedAt: Date.now()
            };
        }).filter((t): t is QueueItem => t !== null);
        return tracks;
    }

    throw new Error('Invalid Spotify URL');
}
