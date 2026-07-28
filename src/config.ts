import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { BotConfig } from './types';

// Load .env file
dotenv.config();

// Load config.json if it exists
const configPath = path.join(__dirname, '../config.json');
let fileConfig: any = {};
if (fs.existsSync(configPath)) {
    try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
        console.error('Error parsing config.json:', error);
    }
}

export const config: BotConfig = {
    ...fileConfig,
    // Environment variables take precedence over config.json so deployment
    // secrets cannot be accidentally overridden by an image-bundled file.
    discordToken: process.env.DISCORD_TOKEN || fileConfig.discordToken || '',
    discordClientId: process.env.DISCORD_CLIENT_ID || fileConfig.discordClientId || '',
    guildId: process.env.GUILD_ID || fileConfig.guildId || '',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || fileConfig.spotifyClientId || '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || fileConfig.spotifyClientSecret || '',
    spotifyUsername: process.env.SPOTIFY_USERNAME || fileConfig.spotifyUsername,
    spotifyPassword: process.env.SPOTIFY_PASSWORD || fileConfig.spotifyPassword,
    bot: {
        ...fileConfig.bot,
        logLevel: process.env.LOG_LEVEL || fileConfig.bot?.logLevel || 'info'
    }
};

// Validate essential config
const requiredKeys: (keyof BotConfig)[] = ['discordToken', 'discordClientId', 'guildId', 'spotifyClientId', 'spotifyClientSecret'];
for (const key of requiredKeys) {
    if (!config[key]) {
        console.error(`Missing required configuration: ${key}`);
        // In a real scenario, we might want to exit here, but for now we'll just log
    }
}
