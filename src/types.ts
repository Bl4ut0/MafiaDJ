### MafaiDJ - Types
export interface BotConfig {
    discordToken: string;
    discordClientId: string;
    guildId: string;
    spotifyClientId: string;
    spotifyClientSecret: string;
    spotifyUsername?: string;
    spotifyPassword?: string;
}

export interface Track {
    title: string;
    artist: string;
    url: string;
    thumbnail: string;
    duration: number; // in seconds
    source: 'youtube' | 'spotify' | 'soundcloud' | 'direct';
    requesterId: string;
}

export interface QueueItem extends Track {
    addedAt: number;
}

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface Command {
    data: SlashCommandBuilder | any; // simplify for now
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
