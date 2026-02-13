import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { config } from '../config';
import os from 'os';

export const command = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Show bot debug information'),
    async execute(interaction: ChatInputCommandInteraction) {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle('System Debug Info')
            .addFields(
                { name: 'Uptime', value: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`, inline: true },
                { name: 'Memory (RSS)', value: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`, inline: true },
                { name: 'Node Version', value: process.version, inline: true },
                { name: 'Platform', value: `${os.platform()} (${os.release()})`, inline: true },
                { name: 'Spotify Mode', value: config.playback?.spotifyMode || 'Fallback', inline: true }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
