import SpotifyWebApi from 'spotify-web-api-node';
import { config } from '../../config';

// Singleton wrapper for Spotify Web API
class SpotifyAPI {
    private static instance: SpotifyAPI;
    private api: SpotifyWebApi;
    private tokenExpirationEpoch: number = 0;

    private constructor() {
        this.api = new SpotifyWebApi({
            clientId: config.spotifyClientId,
            clientSecret: config.spotifyClientSecret,
        });
    }

    public static getInstance(): SpotifyAPI {
        if (!SpotifyAPI.instance) {
            SpotifyAPI.instance = new SpotifyAPI();
        }
        return SpotifyAPI.instance;
    }

    private async ensureToken() {
        // Refresh token if expired or about to expire (within 60s)
        if (Date.now() / 1000 > this.tokenExpirationEpoch - 60) {
            try {
                const data = await this.api.clientCredentialsGrant();
                this.api.setAccessToken(data.body['access_token']);
                this.tokenExpirationEpoch = (Date.now() / 1000) + data.body['expires_in'];
                console.log('[SpotifyAPI] Access token refreshed');
            } catch (error) {
                console.error('[SpotifyAPI] Error retrieving access token:', error);
                throw error;
            }
        }
    }

    public async getTrack(trackId: string) {
        await this.ensureToken();
        const response = await this.api.getTrack(trackId);
        return response.body;
    }

    public async getAlbum(albumId: string) {
        await this.ensureToken();
        const response = await this.api.getAlbum(albumId);
        return response.body;
    }

    public async getPlaylist(playlistId: string) {
        await this.ensureToken();
        const response = await this.api.getPlaylist(playlistId);
        return response.body;
    }

    // Helper to start playback on a device (librespot)
    public async playOnDevice(deviceId: string, trackUri: string) {
        // Requires user authentication (authorization code grant) not client credentials.
        // Librespot handles playback itself usually via being a Connect device.
        // If we want to CONTROL it from the bot using the Web API, we need a user token.
        // However, standard librespot usage for bots often just pipes audio.
        // If using 'librespot --backend pipe', it just outputs audio when "something" plays on it.
        // We can use the Spotify Web API to tell Spotify "Play Track X on Device Y".
        // BUT this requires a User Access Token (authorized by the user), not Client Credentials.

        // Strategy: 
        // 1. We start librespot with user/pass (it becomes a device).
        // 2. We need a way to tell it to play. Librespot doesn't have a CLI for "play this" once running?
        //    Actually, standard librespot is a receiver.
        //    We need a controller. 
        //    
        // Alternative: Use a library that wraps librespot or acts as a controller? 
        // Or simpler: We use `spotify-web-api-node` with a REFRESH TOKEN from the user account defined in .env.
        // We'll need to do a one-time setup to get that refresh token or just use the username/password to get a token?
        // Spotify doesn't support user/pass for API tokens directly anymore.

        // Wait, the plan says:
        // "Bot Start → Spawn librespot (--backend pipe) ... On /play → Send play command via Spotify Connect API"
        // To use Spotify Connect API, we need a User Token.
        // We can get a user token if we have the refresh token.
        // We should add SPOTIFY_REFRESH_TOKEN to .env? Or handle the auth flow?
        // For a personal bot, we can manually generate a refresh token once and put it in .env.

        // Let's assume for now we use the fallback "Spotify -> YouTube" method primarily if auth is hard, 
        // but for "Direct Spotify" we need that user token.

        // Let's stick to Metadata resolution first.
    }
}

export default SpotifyAPI.getInstance();
