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
    discordToken: process.env.DISCORD_TOKEN || '',
    discordClientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    spotifyUsername: process.env.SPOTIFY_USERNAME,
    spotifyPassword: process.env.SPOTIFY_PASSWORD,
    ...fileConfig
};

// Validate essential config
const requiredKeys: (keyof BotConfig)[] = ['discordToken', 'discordClientId', 'guildId', 'spotifyClientId', 'spotifyClientSecret'];
for (const key of requiredKeys) {
    if (!config[key]) {
        console.error(`Missing required configuration: ${key}`);
        // In a real scenario, we might want to exit here, but for now we'll just log
    }
}
