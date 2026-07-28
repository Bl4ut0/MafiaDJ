import PlayerManager from '../player/PlayerManager';
import { config } from '../config';
import client from '../bot/client';

export interface DashboardTrack {
    title: string;
    artist: string;
    url: string;
    thumbnail: string;
    duration: number;
    source: string;
    requesterId: string;
    requesterName?: string;
}

export interface DashboardState {
    currentTrack: DashboardTrack | null;
    queue: DashboardTrack[];
    isPaused: boolean;
    volume: number;
    loopMode: string;
    spotifyAutoplay: boolean;
    elapsedSeconds: number;
    isConnected: boolean;
    serverName: string;
    serverIcon: string | null;
    spotifyEnabled: boolean;
    spotifyPlaybackEnabled: boolean;
}

function resolveRequesterName(requesterId: string): string {
    if (!requesterId || requesterId === 'Autoplay' || requesterId === 'Jam Host') return requesterId || 'Unknown';
    try {
        const guild = client.guilds.cache.get(config.guildId);
        const member = guild?.members.cache.get(requesterId);
        return member?.displayName ?? member?.user.username ?? requesterId;
    } catch {
        return requesterId;
    }
}

export function buildState(): DashboardState {
    const player = PlayerManager.getPlayer(config.guildId);
    const guild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();

    const mapTrack = (t: any): DashboardTrack => ({
        title: t.title ?? 'Unknown',
        artist: t.artist ?? '',
        url: t.url ?? '',
        thumbnail: t.thumbnail ?? '',
        duration: t.duration ?? 0,
        source: t.source ?? 'youtube',
        requesterId: t.requesterId ?? '',
        requesterName: resolveRequesterName(t.requesterId),
    });

    return {
        currentTrack: player.currentTrack ? mapTrack(player.currentTrack) : null,
        queue: player.queue.getTracks().map(mapTrack),
        isPaused: player.audioPlayer.state.status === 'paused',
        volume: player.volume,
        loopMode: player.loopMode,
        spotifyAutoplay: player.spotifyAutoplay,
        elapsedSeconds: player.getElapsedSeconds(),
        isConnected: !!player.connection,
        serverName: guild?.name ?? '',
        serverIcon: guild?.iconURL({ extension: 'png', size: 64 }) ?? null,
        spotifyEnabled: !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET,
        spotifyPlaybackEnabled: (player as any).spotifyPlaybackEnabled ?? true,
    };
}
