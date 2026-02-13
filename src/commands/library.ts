import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { LibraryManager } from '../ui/library/LibraryManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('library')
        .setDescription('Open your personal music library in DMs'),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: '📬 Sent you a DM with your library!', ephemeral: true });

        try {
            await LibraryManager.openLibrary(interaction.user);
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: '❌ Could not send DM. Please allow DMs from server members.', ephemeral: true });
        }
    }
};
