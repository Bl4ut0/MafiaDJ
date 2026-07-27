import db from './Database';
import { QueueItem } from '../types';

export class History {
    public static add(track: QueueItem, guildId: string) {
        if (!track.url || !track.title) return;

        const stmt = db.prepare(`
            INSERT INTO play_history (user_id, guild_id, title, artist, url, thumbnail, duration, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        try {
            stmt.run(
                track.requesterId || 'unknown',
                guildId,
                track.title,
                track.artist,
                track.url,
                track.thumbnail,
                track.duration,
                track.source
            );
        } catch (e) {
            console.error('[History] Failed to add track:', e);
        }
    }

    public static getRecent(guildId: string, limit: number = 20, offset: number = 0) {
        return db.prepare(`
            SELECT * FROM play_history 
            WHERE guild_id = ? 
            ORDER BY played_at DESC 
            LIMIT ? OFFSET ?
        `).all(guildId, limit, offset);
    }

    public static getUserRecent(userId: string, limit: number = 20, offset: number = 0) {
        return db.prepare(`
            SELECT * FROM play_history 
            WHERE user_id = ? 
            ORDER BY played_at DESC 
            LIMIT ? OFFSET ?
        `).all(userId, limit, offset);
    }
}
