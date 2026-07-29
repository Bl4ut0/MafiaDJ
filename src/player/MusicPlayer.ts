import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, VoiceConnection, NoSubscriberBehavior, StreamType } from '@discordjs/voice';
import { Queue } from './Queue';
import { QueueItem } from '../types';
import { EventEmitter } from 'events';
import { createYtDlpStream } from './AudioStream';
import { searchYouTube } from '../sources/youtube';
import { logger } from '../utils/logger';
import { config } from '../config';
import ServerSettings from '../database/ServerSettings';
import { History } from '../database/History';
import SpotifyAPI from '../spotify/SpotifyAPI';

export class MusicPlayer extends EventEmitter {
    public guildId: string;
    public queue: Queue;
    public audioPlayer: AudioPlayer;
    public connection: VoiceConnection | null = null;
    public currentTrack: QueueItem | null = null;
    public isLooping: boolean = false;
    public loopMode: 'off' | 'track' | 'queue' = 'off';
    public volume: number = 50;
    public spotifyAutoplay: boolean = false;
    public spotifyOwnerSyncEnabled: boolean = false;
    public playStartTime: number = 0;
    public pauseStartTime: number = 0;
    public totalPausedMs: number = 0;
    private currentResource: AudioResource | null = null;
    private jamPollTimer: NodeJS.Timeout | null = null;
    private lastJamTrackId: string | null = null;
    private lastJamErrorAt = 0;

    constructor(guildId: string = '') {
        super();
        this.guildId = guildId;
        this.queue = new Queue(config.playback?.maxQueueLength ?? 200);
        const settings = guildId ? ServerSettings.getSettings(guildId) : {};
        this.volume = Number(settings.default_volume ?? config.playback?.defaultVolume ?? 50);
        this.spotifyOwnerSyncEnabled = config.spotifyOwnerSyncAvailable
            && config.spotifyOwnerSyncRiskAcknowledged
            && settings.spotify_owner_sync_enabled === 1;
        this.spotifyAutoplay = this.spotifyOwnerSyncEnabled && settings.spotify_jam_enabled === 1;
        this.audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            },
        });
        this.setupPlayerListeners();
    }

    private setupPlayerListeners() {
        this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
            if (this.isLooping && this.currentTrack) {
                this.play(this.currentTrack);
            } else {
                this.playNext();
            }
            this.emit('stateChange');
        });

        this.audioPlayer.on(AudioPlayerStatus.Playing, () => this.emit('stateChange'));
        this.audioPlayer.on(AudioPlayerStatus.Paused, () => this.emit('stateChange'));

        this.audioPlayer.on('error', error => {
            logger.error('Audio player error:');
            logger.error(error);
            this.playNext();
        });
    }

    public async play(track: QueueItem) {
        this.currentTrack = track;
        logger.info(`[MusicPlayer] Playing: ${track.title} [Source: ${track.source}]`);

        try {
            let stream;

            // Spotify Fallback Logic
            if (track.source === 'spotify') {
                logger.info(`[MusicPlayer] Resolving Spotify track "${track.title} - ${track.artist}" via YouTube search...`);
                // Simple search query improvement
                const searchQuery = `${track.title} ${track.artist} audio`;
                const ytUrl = await searchYouTube(searchQuery);

                if (ytUrl) {
                    logger.info(`[MusicPlayer] Fallback found: ${ytUrl}`);
                    stream = await createYtDlpStream(ytUrl);
                } else {
                    logger.warn('[MusicPlayer] Could not find fallback for Spotify track.');
                    this.playNext();
                    return;
                }
            }
            else {
                stream = await createYtDlpStream(track.url);
            }

            const resource = createAudioResource(stream, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });

            resource.volume?.setVolume(this.volume / 100);
            this.currentResource = resource;
            this.playStartTime = Date.now();
            this.pauseStartTime = 0;
            this.totalPausedMs = 0;

            this.audioPlayer.play(resource);
            History.add(track, this.guildId);
            this.emit('trackStart', track);
            this.emit('stateChange');
        } catch (error) {
            logger.error('Error in play():');
            logger.error(error);
            this.playNext();
        }
    }

    public playNext() {
        const nextTrack = this.queue.dequeue();
        if (nextTrack) {
            this.play(nextTrack);
        } else {
            this.currentTrack = null;
            this.emit('queueEnd');
            this.audioPlayer.stop();
            this.emit('stateChange');
        }
    }

    public stop() {
        this.queue.clear();
        this.audioPlayer.stop();
        this.currentTrack = null;
        this.currentResource = null;
        this.playStartTime = 0;
        this.pauseStartTime = 0;
        this.totalPausedMs = 0;
        this.emit('stateChange');
    }

    public pause() {
        if (this.audioPlayer.pause() && !this.pauseStartTime) {
            this.pauseStartTime = Date.now();
        }
        this.emit('stateChange');
    }

    public resume() {
        if (this.audioPlayer.unpause() && this.pauseStartTime) {
            this.totalPausedMs += Date.now() - this.pauseStartTime;
            this.pauseStartTime = 0;
        }
        this.emit('stateChange');
    }

    public setConnection(conn: VoiceConnection | null): void {
        this.connection = conn;
    }

    public getElapsedSeconds(): number {
        if (!this.playStartTime) return 0;
        const now = Date.now();
        let paused = this.totalPausedMs;
        if (this.pauseStartTime > 0) {
            paused += now - this.pauseStartTime;
        }
        return Math.floor((now - this.playStartTime - paused) / 1000);
    }

    public cycleLoopMode(): 'off' | 'track' | 'queue' {
        switch (this.loopMode) {
            case 'off': this.loopMode = 'track'; break;
            case 'track': this.loopMode = 'queue'; break;
            case 'queue': this.loopMode = 'off'; break;
        }
        this.isLooping = this.loopMode !== 'off';
        this.emit('stateChange');
        return this.loopMode;
    }

    public toggleSpotifyAutoplay(): boolean {
        if (!this.spotifyOwnerSyncEnabled) return false;
        this.spotifyAutoplay = !this.spotifyAutoplay;
        ServerSettings.updateSetting(this.guildId, 'spotify_jam_enabled', this.spotifyAutoplay ? 1 : 0);
        if (this.spotifyAutoplay) void this.startJam();
        else this.stopJam();
        this.emit('stateChange');
        return this.spotifyAutoplay;
    }

    public setSpotifyOwnerSyncEnabled(enabled: boolean): void {
        this.spotifyOwnerSyncEnabled = enabled
            && config.spotifyOwnerSyncAvailable
            && config.spotifyOwnerSyncRiskAcknowledged;
        if (!this.spotifyOwnerSyncEnabled) {
            this.spotifyAutoplay = false;
            this.stopJam();
            ServerSettings.updateSetting(this.guildId, 'spotify_jam_enabled', 0);
        }
        ServerSettings.updateSetting(this.guildId, 'spotify_owner_sync_enabled', this.spotifyOwnerSyncEnabled ? 1 : 0);
        this.emit('stateChange');
    }

    public async startJam(): Promise<boolean> {
        if (!this.spotifyOwnerSyncEnabled || !config.spotifyRefreshToken || !this.connection) return false;
        this.spotifyAutoplay = true;
        ServerSettings.updateSetting(this.guildId, 'spotify_jam_enabled', 1);
        if (this.jamPollTimer) return true;

        const poll = async () => {
            try {
                const playback: any = await SpotifyAPI.getPlaybackState();
                const item = playback?.item;
                if (!playback?.is_playing || !item || item.type !== 'track' || item.id === this.lastJamTrackId) return;
                if (!this.queue.isEmpty() || (this.currentTrack && this.currentTrack.requesterId !== 'Jam Host')) return;

                this.lastJamTrackId = item.id;
                await this.play({
                    title: item.name,
                    artist: item.artists?.map((artist: any) => artist.name).join(', ') || 'Unknown Artist',
                    url: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
                    thumbnail: item.album?.images?.[0]?.url || '',
                    duration: Math.round((item.duration_ms || 0) / 1000),
                    source: 'spotify',
                    requesterId: 'Jam Host',
                    addedAt: Date.now(),
                });
            } catch (error) {
                if (Date.now() - this.lastJamErrorAt > 60_000) {
                    logger.warn('[Spotify Jam] Could not read owner playback state:', error);
                    this.lastJamErrorAt = Date.now();
                }
            }
        };

        await poll();
        this.jamPollTimer = setInterval(poll, 5_000);
        this.jamPollTimer.unref();
        this.emit('stateChange');
        return true;
    }

    public stopJam(): void {
        if (this.jamPollTimer) clearInterval(this.jamPollTimer);
        this.jamPollTimer = null;
        this.lastJamTrackId = null;
    }

    public setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(100, volume));
        this.currentResource?.volume?.setVolume(this.volume / 100);
        this.emit('stateChange');
    }
}
