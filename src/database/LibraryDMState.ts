import db from './Database';

interface LibraryState {
    userId: string;
    dmChannelId: string;
    dmMessageId: string;
    currentView: 'favorites' | 'playlists' | 'playlist_detail' | 'track_detail' | 'search';
    currentPage: number;
    currentPlaylistId?: number;
    currentTrackId?: number; // Actually favoriteId or track index
    searchQuery?: string;
}

export class LibraryDMState {
    public static save(state: LibraryState) {
        const stmt = db.prepare(`
            INSERT INTO library_dm_state (user_id, dm_channel_id, dm_message_id, current_view, current_page, current_playlist_id, current_track_id, search_query, updated_at)
            VALUES (@userId, @dmChannelId, @dmMessageId, @currentView, @currentPage, @currentPlaylistId, @currentTrackId, @searchQuery, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
            dm_channel_id = excluded.dm_channel_id,
            dm_message_id = excluded.dm_message_id,
            current_view = excluded.current_view,
            current_page = excluded.current_page,
            current_playlist_id = excluded.current_playlist_id,
            current_track_id = excluded.current_track_id,
            search_query = excluded.search_query,
            updated_at = datetime('now')
        `);
        stmt.run(state);
    }

    public static get(userId: string): LibraryState | null {
        const row = db.prepare('SELECT * FROM library_dm_state WHERE user_id = ?').get(userId) as any;
        if (!row) return null;

        return {
            userId: row.user_id,
            dmChannelId: row.dm_channel_id,
            dmMessageId: row.dm_message_id,
            currentView: row.current_view,
            currentPage: row.current_page,
            currentPlaylistId: row.current_playlist_id,
            currentTrackId: row.current_track_id,
            searchQuery: row.search_query
        };
    }
}
