import { Router, Request, Response } from 'express';
import { requireAuth, requireDJ, requireAdmin } from './middleware';
import { buildState } from './state';
import PlayerManager from '../player/PlayerManager';
import { config } from '../config';
import { resolveUrl } from '../sources/index';
import { broadcastEvent } from './server';
import { searchYouTubeMultiple } from '../events/messageHandler';
import { logger } from '../utils/logger';
import { Favorites } from '../database/Favorites';
import SpotifyAPI from '../spotify/SpotifyAPI';
import { PersonalPlaylists } from '../database/PersonalPlaylists';
import { joinVoiceChannel } from '@discordjs/voice';
import client from '../bot/client';

export const apiRouter = Router();

// GET /api/me — current user from session (or 401)
apiRouter.get('/me', requireAuth, (req: Request, res: Response) => {
    const s = req.session as any;
    res.json({
        userId: s.userId,
        username: s.username,
        avatar: s.avatar,
        role: s.role,
    });
});

// GET /api/state — full player state (public — no sensitive data)
apiRouter.get('/state', (_req: Request, res: Response) => {
    try {
        res.json(buildState());
    } catch (err) {
        res.status(500).json({ error: 'Failed to build state' });
    }
});

// GET /api/search?q=...&source=youtube|spotify|all
apiRouter.get('/search', requireAuth, async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    const source = (req.query.source as string) ?? 'youtube';

    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        const player = PlayerManager.getPlayer(config.guildId);
        const spotifyAllowed = player.spotifyPlaybackEnabled && !!process.env.SPOTIFY_CLIENT_ID;
        
        let results: any[] = [];
        
        if (source === 'all' || source === 'youtube') {
            const ytResults = await searchYouTubeMultiple(q, 5);
            const mappedYt = ytResults.map(r => ({
                ...r,
                source: 'youtube',
                artist: r.channel || 'YouTube'
            }));
            results = [...results, ...mappedYt];
        }
        
        if ((source === 'all' || source === 'spotify') && spotifyAllowed) {
            try {
                const spResults = await (SpotifyAPI as any).searchTracks?.(q, 5) || [];
                const mappedSp = spResults.map((t: any) => ({
                    url: t.external_urls?.spotify || `spotify:track:${t.id}`,
                    title: t.name,
                    artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
                    source: 'spotify',
                    thumbnail: t.album?.images?.[0]?.url || 'https://developer.spotify.com/images/guidelines/design/icon3@2x.png',
                    duration: t.duration_ms / 1000
                }));
                results = [...results, ...mappedSp];
            } catch (err) {
                logger.error('[Dashboard API] Spotify search error:', err);
            }
        }

        return res.json(results);
    } catch (err) {
        logger.error('[Dashboard API] Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// POST /api/play — add a URL or search result to the queue (DJ+)
apiRouter.post('/play', requireDJ, async (req: Request, res: Response) => {
    const { url } = req.body;
    const s = req.session as any;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    try {
        const player = PlayerManager.getPlayer(config.guildId);

        // Auto-join voice channel if not connected
        if (!player.connection) {
            const guild = client.guilds.cache.get(config.guildId);
            const member = guild?.members.cache.get(s.userId);
            const voiceChannel = member?.voice?.channel;

            if (!voiceChannel) {
                return res.status(400).json({ error: 'Bot is not connected. Please join a voice channel in Discord or use the dashboard Join button first!' });
            }

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
                });
                player.connection = connection;
                connection.subscribe(player.audioPlayer);
            } catch (err) {
                logger.error('[Dashboard API] Voice join failed:', err);
                return res.status(500).json({ error: 'Could not join your voice channel.' });
            }
        }
        const result = await resolveUrl(url, s.userId);
        const tracks = Array.isArray(result) ? result : [result];
        tracks.forEach(t => player.queue.enqueue(t));
        
        player.emit('stateChange');
        
        if (!player.currentTrack && !player.queue.isEmpty()) {
            player.playNext();
        }
        res.json({ ok: true, added: tracks.length });
    } catch (err: any) {
        logger.error(`[Dashboard API] Play error: ${err?.stack || err?.message || err}`);
        res.status(500).json({ error: err?.message || 'Failed to queue track' });
    }
});

// GET /api/channels
apiRouter.get('/channels', requireDJ, (_req: Request, res: Response) => {
    try {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) return res.json([]);
        const channels = guild.channels.cache
            .filter(c => c.isVoiceBased())
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        res.json(channels);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// POST /api/join { channelId }
apiRouter.post('/join', requireDJ, (req: Request, res: Response) => {
    try {
        const { channelId } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        
        const guild = client.guilds.cache.get(config.guildId);
        const voiceChannel = guild?.channels.cache.get(channelId);
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
            return res.status(400).json({ error: 'Invalid voice channel' });
        }
        
        const player = PlayerManager.getPlayer(config.guildId);
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
        });
        player.setConnection(connection);
        connection.subscribe(player.audioPlayer);
        
        // Broadcast state update so dashboard updates to connected
        setTimeout(() => {
            player.emit('stateChange');
        }, 500);
        
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to join channel' });
    }
});

// POST /api/queue/remove { index }
apiRouter.post('/queue/remove', requireAuth, (req: Request, res: Response) => {
    try {
        const { index } = req.body;
        const s = req.session as any;
        if (typeof index !== 'number') return res.status(400).json({ error: 'Missing index' });
        
        const player = PlayerManager.getPlayer(config.guildId);
        const queue = player.queue.getTracks();
        if (index < 0 || index >= queue.length) return res.status(400).json({ error: 'Invalid index' });
        
        const track = queue[index];
        // Only allow removal if user is DJ/Admin OR if user was the requester
        if (s.role !== 'dj' && s.role !== 'admin' && track.requesterId !== s.userId) {
            return res.status(403).json({ error: 'You can only remove your own tracks from the queue.' });
        }
        
        player.queue.remove(index);
        
        // Broadcast queue update
        player.emit('stateChange');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove track' });
    }
});

// POST /api/settings/jam
apiRouter.post('/settings/jam', requireAdmin, (req: Request, res: Response) => {
    try {
        const { enabled } = req.body;
        const player = PlayerManager.getPlayer(config.guildId);
        if (enabled !== player.spotifyAutoplay) {
            player.toggleSpotifyAutoplay();
        }
        res.json({ ok: true, enabled: player.spotifyAutoplay });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// POST /api/settings/spotify
apiRouter.post('/settings/spotify', requireAdmin, (req: Request, res: Response) => {
    try {
        const { enabled } = req.body;
        const player = PlayerManager.getPlayer(config.guildId);
        player.setSpotifyPlaybackEnabled(!!enabled);
        res.json({ ok: true, enabled: player.spotifyPlaybackEnabled });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// POST /api/skip
apiRouter.post('/skip', requireDJ, (_req: Request, res: Response) => {
    try {
        PlayerManager.getPlayer(config.guildId).playNext();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Skip failed' });
    }
});

// POST /api/pause { paused: boolean }
apiRouter.post('/pause', requireDJ, (req: Request, res: Response) => {
    try {
        const player = PlayerManager.getPlayer(config.guildId);
        const { paused } = req.body;
        paused ? player.pause() : player.resume();
        res.json({ ok: true, paused });
    } catch (err) {
        res.status(500).json({ error: 'Pause failed' });
    }
});

// POST /api/volume { volume: number }
apiRouter.post('/volume', requireDJ, (req: Request, res: Response) => {
    try {
        const vol = Number(req.body.volume);
        if (isNaN(vol) || vol < 0 || vol > 100) return res.status(400).json({ error: 'Volume must be 0-100' });
        PlayerManager.getPlayer(config.guildId).setVolume(vol);
        res.json({ ok: true, volume: vol });
    } catch (err) {
        res.status(500).json({ error: 'Volume failed' });
    }
});

// POST /api/seek { seconds: number }
apiRouter.post('/seek', requireDJ, (req: Request, res: Response) => {
    try {
        const secs = Number(req.body.seconds);
        if (isNaN(secs)) return res.status(400).json({ error: 'Invalid seconds' });
        // Seek is not natively supported on our stream — note this in response
        res.status(501).json({ error: 'Seek not yet supported via web API' });
    } catch (err) {
        res.status(500).json({ error: 'Seek failed' });
    }
});

// POST /api/loop — cycle loop mode
apiRouter.post('/loop', requireDJ, (_req: Request, res: Response) => {
    try {
        const mode = PlayerManager.getPlayer(config.guildId).cycleLoopMode();
        res.json({ ok: true, loopMode: mode });
    } catch (err) {
        res.status(500).json({ error: 'Loop failed' });
    }
});

// POST /api/shuffle
apiRouter.post('/shuffle', requireDJ, (_req: Request, res: Response) => {
    try {
        PlayerManager.getPlayer(config.guildId).queue.shuffle();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Shuffle failed' });
    }
});

// POST /api/queue/clear
apiRouter.post('/queue/clear', requireDJ, (_req: Request, res: Response) => {
    try {
        const player = PlayerManager.getPlayer(config.guildId);
        player.queue.clear();
        player.emit('stateChange');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear queue' });
    }
});

// POST /api/leave
apiRouter.post('/leave', requireDJ, (_req: Request, res: Response) => {
    try {
        const player = PlayerManager.getPlayer(config.guildId);
        if (player.connection) {
            player.connection.destroy();
            player.connection = null;
            player.audioPlayer.stop();
            player.queue.clear();
            player.currentTrack = null;
            player.emit('stateChange');
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to leave voice channel' });
    }
});

// POST /api/stop (admin only)
apiRouter.post('/stop', (req: Request, res: Response) => {
    const role = (req.session as any)?.role;
    if (role !== 'admin' && role !== 'dj') return res.status(403).json({ error: 'Insufficient permissions' });
    try {
        const player = PlayerManager.getPlayer(config.guildId);
        player.stop();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Stop failed' });
    }
});

// ─── Library (Favorites & Playlists) ──────────────────────────────────────

// GET /api/favorites
apiRouter.get('/favorites', requireAuth, (req: Request, res: Response) => {
    try {
        const s = req.session as any;
        // Fetch up to 100 favorites for the web UI
        const favs = Favorites.get(s.userId, 100, 0);
        res.json(favs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// GET /api/favorites/check?url=...
apiRouter.get('/favorites/check', requireAuth, (req: Request, res: Response) => {
    try {
        const s = req.session as any;
        const url = req.query.url as string;
        if (!url) return res.json({ isFavorite: false });
        res.json({ isFavorite: Favorites.isFavorite(s.userId, url) });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
});

// POST /api/favorites/toggle
apiRouter.post('/favorites/toggle', requireAuth, (req: Request, res: Response) => {
    try {
        const s = req.session as any;
        const track = req.body; // Expects { url, title, artist, thumbnail, duration, source }
        if (!track || !track.url) return res.status(400).json({ error: 'Invalid track data' });
        
        const added = Favorites.toggle(s.userId, track);
        res.json({ ok: true, added });
    } catch (err) {
        logger.error('[Dashboard API] Favorite toggle error:', err);
        res.status(500).json({ error: 'Toggle failed' });
    }
});

// GET /api/playlists
apiRouter.get('/playlists', requireAuth, (req: Request, res: Response) => {
    try {
        const s = req.session as any;
        const lists = PersonalPlaylists.list(s.userId);
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// POST /api/playlists
apiRouter.post('/playlists', requireAuth, (req: Request, res: Response) => {
    try {
        const s = req.session as any;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        
        const created = PersonalPlaylists.create(s.userId, name);
        if (!created) return res.status(400).json({ error: 'Playlist already exists' });
        
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// GET /api/playlists/:id/tracks
apiRouter.get('/playlists/:id/tracks', requireAuth, (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
        
        const tracks = PersonalPlaylists.getTracks(id);
        res.json(tracks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch playlist tracks' });
    }
});

// POST /api/playlists/:id/add
apiRouter.post('/playlists/:id/add', requireAuth, (req: Request, res: Response) => {
    try {
        const playlistId = parseInt(req.params.id as string);
        const favoriteId = parseInt(req.body.favoriteId);
        if (isNaN(playlistId) || isNaN(favoriteId)) return res.status(400).json({ error: 'Invalid IDs' });
        
        const added = PersonalPlaylists.addTrack(playlistId, favoriteId);
        if (!added) return res.status(400).json({ error: 'Track already in playlist' });
        
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add track' });
    }
});

// ─── YouTube Google Account Authentication ──────────────────────────────
import { isYouTubeAuthenticated, initYouTubeDeviceAuth, pollYouTubeDeviceAuth } from '../sources/youtubeAuth';

// GET /api/youtube/status
apiRouter.get('/youtube/status', requireAuth, (_req: Request, res: Response) => {
    res.json({ authenticated: isYouTubeAuthenticated() });
});

// POST /api/youtube/auth/init (Admin only)
apiRouter.post('/youtube/auth/init', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const data = await initYouTubeDeviceAuth();
        res.json(data);
    } catch (err: any) {
        logger.error('[Dashboard API] YouTube auth init error:', err);
        res.status(500).json({ error: err?.message || 'Failed to start YouTube authentication' });
    }
});

// POST /api/youtube/auth/poll { deviceCode } (Admin only)
apiRouter.post('/youtube/auth/poll', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { deviceCode } = req.body;
        if (!deviceCode) return res.status(400).json({ error: 'Missing deviceCode' });
        const result = await pollYouTubeDeviceAuth(deviceCode);
        res.json(result);
    } catch (err: any) {
        logger.error('[Dashboard API] YouTube auth poll error:', err);
        res.status(500).json({ error: 'Poll failed' });
    }
});
