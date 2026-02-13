import db from './Database';
import { QueueItem } from '../types';

export class Favorites {
    public static add(userId: string, track: QueueItem): boolean {
        try {
            const stmt = db.prepare(`
                INSERT INTO favorites (user_id, title, artist, url, thumbnail, duration, source, added_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);
            stmt.run(userId, track.title, track.artist, track.url, track.thumbnail, track.duration, track.source);
            return true;
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return false; // Already favorited
            }
            console.error('Error adding favorite:', error);
            throw error;
        }
    }

    public static remove(userId: string, url: string): boolean {
        try {
            const stmt = db.prepare(`DELETE FROM favorites WHERE user_id = ? AND url = ?`);
            const result = stmt.run(userId, url);
            return result.changes > 0;
        } catch (error) {
            console.error('Error removing favorite:', error);
            throw error;
        }
    }

    public static get(userId: string, limit: number = 20, offset: number = 0): QueueItem[] {
        try {
            const stmt = db.prepare(`SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC LIMIT ? OFFSET ?`);
            const rows = stmt.all(userId, limit, offset) as any[];
            return rows.map(row => ({
                ...row,
                requesterId: row.user_id, // Map DB user_id to requesterId
                addedAt: new Date(row.added_at).getTime()
            }));
        } catch (error) {
            console.error('Error fetching favorites:', error);
            return [];
        }
    }

    public static count(userId: string): number {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM favorites WHERE user_id = ?');
        const row = stmt.get(userId) as any;
        return row ? row.count : 0;
    }
}
