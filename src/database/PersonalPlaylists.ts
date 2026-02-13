import db from './Database';

export class PersonalPlaylists {
    // Playlist Management
    public static create(userId: string, name: string): boolean {
        try {
            const stmt = db.prepare('INSERT INTO personal_playlists (user_id, name) VALUES (?, ?)');
            stmt.run(userId, name);
            return true;
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
            throw error;
        }
    }

    public static delete(playlistId: number, userId: string): boolean {
        const stmt = db.prepare('DELETE FROM personal_playlists WHERE id = ? AND user_id = ?');
        const result = stmt.run(playlistId, userId);
        return result.changes > 0;
    }

    public static list(userId: string) {
        return db.prepare('SELECT * FROM personal_playlists WHERE user_id = ? ORDER BY name ASC').all(userId) as any[];
    }

    // Track Management
    public static addTrack(playlistId: number, favoriteId: number): boolean {
        try {
            // Get max position
            const maxPos = db.prepare('SELECT MAX(position) as pos FROM personal_playlist_tracks WHERE playlist_id = ?').get(playlistId) as any;
            const position = (maxPos.pos || 0) + 1;

            const stmt = db.prepare('INSERT INTO personal_playlist_tracks (playlist_id, favorite_id, position) VALUES (?, ?, ?)');
            stmt.run(playlistId, favoriteId, position);
            return true;
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
            throw error;
        }
    }

    public static removeTrack(playlistId: number, favoriteId: number): boolean {
        const stmt = db.prepare('DELETE FROM personal_playlist_tracks WHERE playlist_id = ? AND favorite_id = ?');
        const result = stmt.run(playlistId, favoriteId);
        return result.changes > 0;
    }

    public static getTracks(playlistId: number) {
        // Join with favorites to get track details
        const stmt = db.prepare(`
            SELECT f.*, ppt.position 
            FROM personal_playlist_tracks ppt
            JOIN favorites f ON ppt.favorite_id = f.id
            WHERE ppt.playlist_id = ?
            ORDER BY ppt.position ASC
        `);
        return stmt.all(playlistId) as any[];
    }
}
