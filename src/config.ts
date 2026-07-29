import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { BotConfig } from './types';

dotenv.config();

const configPath = path.join(__dirname, '../config.json');
let fileConfig: any = {};
if (fs.existsSync(configPath)) {
    try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
        console.error('Error parsing config.json:', error);
    }
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
    if (value === undefined || value.trim() === '') return fallback;
    return value.trim().toLowerCase() === 'true';
}

function envPath(name: string, configured: unknown, fallback: string): string {
    const value = process.env[name] || (typeof configured === 'string' ? configured : '') || fallback;
    if (!path.isAbsolute(value) && path.dirname(value) === '.') {
        const executableName = process.platform === 'win32' && !value.toLowerCase().endsWith('.exe')
            ? `${value}.exe`
            : value;
        const bundledPath = path.resolve(process.cwd(), 'bin', executableName);
        if (fs.existsSync(bundledPath)) return bundledPath;
    }
    return value;
}

export const config: BotConfig = {
    ...fileConfig,
    // Secrets are environment-only so they cannot be committed in config.json.
    discordToken: process.env.DISCORD_TOKEN || '',
    discordClientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
    spotifyOwnerSyncAvailable: parseBoolean(process.env.SPOTIFY_OWNER_SYNC_AVAILABLE),
    spotifyOwnerSyncRiskAcknowledged: parseBoolean(process.env.SPOTIFY_OWNER_SYNC_RISK_ACKNOWLEDGED),
    bot: {
        ...fileConfig.bot,
        logLevel: process.env.LOG_LEVEL || fileConfig.bot?.logLevel || 'info'
    },
    paths: {
        ytdlp: envPath('YTDLP_PATH', fileConfig.paths?.ytdlp, 'yt-dlp'),
        ffmpeg: envPath('FFMPEG_PATH', fileConfig.paths?.ffmpeg, 'ffmpeg'),
    },
};

const requiredKeys: (keyof BotConfig)[] = ['discordToken', 'discordClientId', 'guildId'];
const missingKeys: string[] = [];
for (const key of requiredKeys) {
    if (!config[key]) {
        missingKeys.push(String(key));
    }
}

if (missingKeys.length > 0) {
    throw new Error(`Missing required configuration: ${missingKeys.join(', ')}`);
}

if (config.spotifyOwnerSyncAvailable) {
    const missingSpotify = [
        !config.spotifyClientId && 'SPOTIFY_CLIENT_ID',
        !config.spotifyClientSecret && 'SPOTIFY_CLIENT_SECRET',
        !config.spotifyRefreshToken && 'SPOTIFY_REFRESH_TOKEN',
        !config.spotifyOwnerSyncRiskAcknowledged && 'SPOTIFY_OWNER_SYNC_RISK_ACKNOWLEDGED=true',
    ].filter(Boolean);
    if (missingSpotify.length > 0) {
        throw new Error(`Spotify owner sync is enabled but missing: ${missingSpotify.join(', ')}`);
    }
}
