import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { formatDuration } from '../utils/formatters';

export const command = {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('Show currently playing song'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const player = PlayerManager.getPlayer(interaction.guildId!);
        const currentTrack = player.currentTrack;

        if (!currentTrack) {
            await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#7C3AED') // Deep purple
            .setTitle('Now Playing 🎵')
            .setDescription(`[**${currentTrack.title}**](${currentTrack.url})`)
            .setThumbnail(currentTrack.thumbnail)
            .addFields(
                { name: 'Artist', value: currentTrack.artist, inline: true },
                { name: 'Duration', value: formatDuration(currentTrack.duration), inline: true },
                { name: 'Requested By', value: `<@${currentTrack.requesterId}>`, inline: true }
            )
            .setFooter({ text: 'MafiaDJ' });

        await interaction.reply({ embeds: [embed] });
    },
};
