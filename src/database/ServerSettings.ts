import db from '../database/Database';
import { config } from '../config';

export type ServerSettingKey =
    | 'dj_role_id'
    | 'music_channel_id'
    | 'controller_message_id'
    | 'vote_skip_threshold'
    | 'vote_stop_threshold'
    | 'default_volume'
    | 'autoplay_enabled'
    | 'spotify_owner_sync_enabled'
    | 'spotify_jam_enabled';

export class ServerSettings {
    private static instance: ServerSettings;

    private constructor() { }

    public static getInstance(): ServerSettings {
        if (!ServerSettings.instance) {
            ServerSettings.instance = new ServerSettings();
        }
        return ServerSettings.instance;
    }

    public getSettings(guildId: string) {
        const row = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId) as any;
        if (!row) {
            // Return defaults if not found
            return {
                dj_role_id: null,
                music_channel_id: null,
                controller_message_id: null,
                vote_skip_threshold: config.permissions?.voteSkipThreshold || 50,
                vote_stop_threshold: config.permissions?.voteStopThreshold || 66,
                default_volume: config.playback?.defaultVolume || 50,
                autoplay_enabled: 0,
                spotify_owner_sync_enabled: 0,
                spotify_jam_enabled: 0
            };
        }
        return row;
    }

    public updateSetting(guildId: string, key: ServerSettingKey, value: string | number | null) {
        const stmt = db.prepare(`
            INSERT INTO server_settings (guild_id, ${key}) 
            VALUES (?, ?) 
            ON CONFLICT(guild_id) DO UPDATE SET ${key} = excluded.${key}
        `);
        stmt.run(guildId, value);
    }
}

export default ServerSettings.getInstance();
