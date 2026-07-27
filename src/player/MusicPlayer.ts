import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, VoiceConnection, NoSubscriberBehavior } from '@discordjs/voice';
import { Queue } from './Queue';
import { QueueItem } from '../types';
import { EventEmitter } from 'events';
import { createYtDlpStream } from './AudioStream';
import { searchYouTube } from '../sources/youtube';
import { logger } from '../utils/logger';

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
    public spotifyPlaybackEnabled: boolean = true;
    public playStartTime: number = 0;
    public pauseStartTime: number = 0;
    public totalPausedMs: number = 0;

    constructor(guildId: string = '') {
        super();
        this.guildId = guildId;
        this.queue = new Queue();
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
                    stream = createYtDlpStream(ytUrl);
                } else {
                    logger.warn('[MusicPlayer] Could not find fallback for Spotify track.');
                    this.playNext();
                    return;
                }
            }
            else {
                stream = createYtDlpStream(track.url);
            }

            const resource = createAudioResource(stream, {
                inlineVolume: true
            });

            resource.volume?.setVolume(this.volume / 100);

            this.audioPlayer.play(resource);
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
        this.emit('stateChange');
    }

    public pause() {
        this.audioPlayer.pause();
        this.emit('stateChange');
    }

    public resume() {
        this.audioPlayer.unpause();
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
        this.spotifyAutoplay = !this.spotifyAutoplay;
        this.emit('stateChange');
        return this.spotifyAutoplay;
    }

    public setSpotifyPlaybackEnabled(enabled: boolean): void {
        this.spotifyPlaybackEnabled = enabled;
        this.emit('stateChange');
    }

    public setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(100, volume));
        this.emit('stateChange');
    }
}
