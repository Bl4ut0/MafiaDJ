import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, PermissionFlagsBits } from 'discord.js';
import { ControllerMessage } from '../ui/ControllerMessage';
import client from '../bot/client';

export const command = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Set up the persistent music controller in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const channel = interaction.channel;
        if (!channel || !(channel instanceof TextChannel)) {
            await interaction.reply({ content: 'Please run this command in a text channel.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const controller = ControllerMessage.getInstance(client, interaction.guildId);
            await controller.setup(channel);
            await interaction.editReply('✅ **Music Controller** has been set up! The embed should appear below.');
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Failed to set up the controller. Check permissions.');
        }
    },
};
