import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../data/mafiadj.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export default db;

export function initDatabase() {
    // Server Settings
    db.exec(`
        CREATE TABLE IF NOT EXISTS server_settings (
            guild_id TEXT PRIMARY KEY,
            dj_role_id TEXT,
            music_channel_id TEXT,
            controller_message_id TEXT,
            vote_skip_threshold INTEGER DEFAULT 50,
            vote_stop_threshold INTEGER DEFAULT 66,
            default_volume INTEGER DEFAULT 50,
            autoplay_enabled INTEGER DEFAULT 0
        );
    `);

    // Server Playlists (Guild-scoped, created via /queue save)
    db.exec(`
        CREATE TABLE IF NOT EXISTS server_playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(guild_id, name)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS server_playlist_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL REFERENCES server_playlists(id) ON DELETE CASCADE,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            artist TEXT,
            thumbnail TEXT,
            duration INTEGER,
            source TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Favorites (User-scoped, cross-guild)
    db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            url TEXT NOT NULL,
            thumbnail TEXT,
            duration INTEGER,
            source TEXT NOT NULL,
            album TEXT,
            spotify_url TEXT,
            youtube_url TEXT,
            added_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, url)
        );
    `);

    // Personal Playlists (User-owned, curated from favorites)
    db.exec(`
        CREATE TABLE IF NOT EXISTS personal_playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, name)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS personal_playlist_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL REFERENCES personal_playlists(id) ON DELETE CASCADE,
            favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            added_at TEXT DEFAULT (datetime('now')),
            UNIQUE(playlist_id, favorite_id)
        );
    `);

    // Library DM State (Tracks the DM message ID for each user's library)
    db.exec(`
        CREATE TABLE IF NOT EXISTS library_dm_state (
            user_id TEXT PRIMARY KEY,
            dm_channel_id TEXT NOT NULL,
            dm_message_id TEXT NOT NULL,
            current_view TEXT DEFAULT 'favorites',
            current_page INTEGER DEFAULT 1,
            current_playlist_id INTEGER,
            current_track_id INTEGER,
            search_query TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );
    `);

    console.log('Database initialized successfully.');
}
