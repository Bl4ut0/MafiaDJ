import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import PlayerManager from '../player/PlayerManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the voice channel'),
    async execute(interaction: ChatInputCommandInteraction) {
        const player = PlayerManager.getPlayer(interaction.guildId!);

        if (!player.connection) {
            await interaction.reply({ content: '❌ I am not connected to a voice channel!', ephemeral: true });
            return;
        }

        player.stop();
        if (player.connection) {
            player.connection.destroy();
            player.connection = null;
        }
        await interaction.reply('👋 Goodbye!');
    },
};
