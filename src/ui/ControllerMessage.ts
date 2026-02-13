import { Client, TextChannel, Message, EmbedBuilder } from 'discord.js';
import db from '../database/Database';
import { createNowPlayingEmbed } from './NowPlayingEmbed';
import { createControllerButtons } from './ButtonRows';
import PlayerManager from '../player/PlayerManager';

// Map guildId -> ControllerMessage instance to keep active listeners
const controllers = new Map<string, ControllerMessage>();

export class ControllerMessage {
    private client: Client;
    private guildId: string;
    private channelId: string | null = null;
    private messageId: string | null = null;
    private message: Message | null = null;
    private isInitialized: boolean = false;

    constructor(client: Client, guildId: string) {
        this.client = client;
        this.guildId = guildId;

        // Listen to player events to auto-update
        const player = PlayerManager.getPlayer(guildId);
        // Remove existing listener to avoid duplicates if re-instantiated? 
        // Better to manage single instance in manager.
        player.on('stateChange', () => this.update());
        player.on('trackStart', () => this.update());
        player.on('queueEnd', () => this.update());
    }

    public static getInstance(client: Client, guildId: string): ControllerMessage {
        if (!controllers.has(guildId)) {
            controllers.set(guildId, new ControllerMessage(client, guildId));
        }
        return controllers.get(guildId)!;
    }

    // ... (loadState, setup, update methods)

    private async loadState() {
        if (this.isInitialized) return;
        try {
            const row = db.prepare('SELECT music_channel_id, controller_message_id FROM server_settings WHERE guild_id = ?').get(this.guildId) as any;
            if (row) {
                this.channelId = row.music_channel_id;
                this.messageId = row.controller_message_id;

                if (this.channelId) {
                    try {
                        const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
                        if (channel && this.messageId) {
                            this.message = await channel.messages.fetch(this.messageId);
                        }
                    } catch (err) {
                        console.error('Failed to fetch channel/message from saved state:', err);
                    }
                }
            }
            this.isInitialized = true;
        } catch (error) {
            console.error('Error loading controller state from DB:', error);
        }
    }

    public async setup(channel: TextChannel) {
        try {
            const player = PlayerManager.getPlayer(this.guildId);
            const embed = createNowPlayingEmbed(player.currentTrack, player.queue.getTracks(), false, player.isLooping, player.volume);
            const buttons = createControllerButtons(false, player.isLooping, player.volume);

            const message = await channel.send({ embeds: [embed], components: buttons });
            this.message = message;
            this.channelId = channel.id;
            this.messageId = message.id;

            const stmt = db.prepare(`
                INSERT INTO server_settings (guild_id, music_channel_id, controller_message_id) 
                VALUES (?, ?, ?) 
                ON CONFLICT(guild_id) DO UPDATE SET 
                music_channel_id = excluded.music_channel_id, 
                controller_message_id = excluded.controller_message_id
            `);
            stmt.run(this.guildId, this.channelId, this.messageId);

            this.isInitialized = true;
        } catch (error) {
            console.error('Error in controller setup:', error);
            throw error;
        }
    }

    public async update() {
        await this.loadState();
        if (!this.message) return;

        try {
            const player = PlayerManager.getPlayer(this.guildId);
            const isPaused = player.audioPlayer.state.status === 'paused';

            const embed = createNowPlayingEmbed(
                player.currentTrack,
                player.queue.getTracks(),
                isPaused,
                player.isLooping,
                player.volume
            );

            const buttons = createControllerButtons(isPaused, player.isLooping, player.volume);

            await this.message.edit({ embeds: [embed], components: buttons });
        } catch (error) {
            console.error('Error updating controller message:', error);
        }
    }
}
