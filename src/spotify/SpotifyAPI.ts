import SpotifyWebApi from 'spotify-web-api-node';
import { config } from '../config';
import { logger } from '../utils/logger';

class SpotifyAPI {
    private static instance: SpotifyAPI;
    private metadataApi: SpotifyWebApi;
    private userApi: SpotifyWebApi;
    private metadataTokenExpiresAt = 0;
    private userTokenExpiresAt = 0;

    private constructor() {
        this.metadataApi = new SpotifyWebApi({
            clientId: config.spotifyClientId,
            clientSecret: config.spotifyClientSecret,
        });
        this.userApi = new SpotifyWebApi({
            clientId: config.spotifyClientId,
            clientSecret: config.spotifyClientSecret,
            refreshToken: config.spotifyRefreshToken,
        });
    }

    public static getInstance(): SpotifyAPI {
        if (!SpotifyAPI.instance) SpotifyAPI.instance = new SpotifyAPI();
        return SpotifyAPI.instance;
    }

    private ensureConfigured(): void {
        if (!config.spotifyClientId || !config.spotifyClientSecret) {
            throw new Error('Spotify metadata search is not configured.');
        }
    }

    private async ensureMetadataToken(): Promise<void> {
        this.ensureConfigured();
        if (Date.now() < this.metadataTokenExpiresAt - 60_000) return;
        const data = await this.metadataApi.clientCredentialsGrant();
        this.metadataApi.setAccessToken(data.body.access_token);
        this.metadataTokenExpiresAt = Date.now() + data.body.expires_in * 1000;
    }

    private async ensureUserToken(): Promise<void> {
        if (!config.spotifyOwnerSyncAvailable || !config.spotifyOwnerSyncRiskAcknowledged || !config.spotifyRefreshToken) {
            throw new Error('Spotify owner sync is not configured.');
        }
        if (Date.now() < this.userTokenExpiresAt - 60_000) return;
        const data = await this.userApi.refreshAccessToken();
        this.userApi.setAccessToken(data.body.access_token);
        this.userTokenExpiresAt = Date.now() + data.body.expires_in * 1000;
    }

    public async getTrack(trackId: string) {
        await this.ensureMetadataToken();
        return (await this.metadataApi.getTrack(trackId)).body;
    }

    public async getAlbum(albumId: string) {
        await this.ensureMetadataToken();
        return (await this.metadataApi.getAlbum(albumId)).body;
    }

    public async getPlaylist(playlistId: string) {
        await this.ensureMetadataToken();
        return (await this.metadataApi.getPlaylist(playlistId)).body;
    }

    public async searchTracks(query: string, limit = 5) {
        await this.ensureMetadataToken();
        const response = await this.metadataApi.searchTracks(query, {
            limit: Math.max(1, Math.min(10, limit)),
        });
        return response.body.tracks?.items ?? [];
    }

    public async findDevice(deviceName: string): Promise<string | null> {
        await this.ensureUserToken();
        const response = await this.userApi.getMyDevices();
        return response.body.devices.find(device => device.name === deviceName)?.id ?? null;
    }

    public async playOnDevice(deviceId: string, trackUri: string): Promise<void> {
        await this.ensureUserToken();
        await this.userApi.play({ device_id: deviceId, uris: [trackUri] });
    }

    public async getPlaybackState() {
        await this.ensureUserToken();
        return (await this.userApi.getMyCurrentPlaybackState()).body;
    }

    public async pausePlayback(): Promise<void> {
        await this.ensureUserToken();
        try {
            await this.userApi.pause();
        } catch (error) {
            logger.warn('[SpotifyAPI] Could not pause owner playback:', error);
            throw error;
        }
    }
}

export default SpotifyAPI.getInstance();
