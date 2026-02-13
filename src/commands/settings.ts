import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import ServerSettings from '../database/ServerSettings';

export const command = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure server settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addIntegerOption(option =>
            option.setName('votevalues')
                .setDescription('Set vote threshold percentage (1-100)')
                .setMinValue(1)
                .setMaxValue(100))
        .addBooleanOption(option =>
            option.setName('view')
                .setDescription('View current settings')),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        if (interaction.options.getBoolean('view')) {
            const settings = ServerSettings.getSettings(interaction.guildId);
            await interaction.reply({
                content: `**Server Settings:**\nSkip Threshold: ${settings.vote_skip_threshold}%\nStop Threshold: ${settings.vote_stop_threshold}%\nDefault Volume: ${settings.default_volume}%`,
                ephemeral: true
            });
            return;
        }

        const voteThreshold = interaction.options.getInteger('votevalues');
        if (voteThreshold) {
            ServerSettings.updateSetting(interaction.guildId, 'vote_skip_threshold', voteThreshold);
            // Assuming same threshold for stop for simplicity unless specified otherwise in command expansion
            ServerSettings.updateSetting(interaction.guildId, 'vote_stop_threshold', Math.min(100, Math.floor(voteThreshold * 1.3)));

            await interaction.reply(`✅ Vote thresholds updated. Skip: **${voteThreshold}%**`);
        }
    }
};
