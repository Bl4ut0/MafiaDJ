import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { formatDuration } from '../utils/formatters';

export const command = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const player = PlayerManager.getPlayer(interaction.guildId!);
        const queueTracks = player.queue.getTracks();
        const currentTrack = player.currentTrack;

        if (!currentTrack && queueTracks.length === 0) {
            await interaction.reply({ content: 'The queue is currently empty.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle('Music Queue 🎶');

        if (currentTrack) {
            embed.addFields({
                name: 'Now Playing',
                value: `[${currentTrack.title}](${currentTrack.url}) | \`${formatDuration(currentTrack.duration)}\` | <@${currentTrack.requesterId}>`
            });
        }

        if (queueTracks.length > 0) {
            const trackList = queueTracks.slice(0, 10).map((track, index) =>
                `**${index + 1}.** [${track.title}](${track.url}) | \`${formatDuration(track.duration)}\` | <@${track.requesterId}>`
            ).join('\n');

            embed.setDescription(`**Up Next:**\n${trackList}${queueTracks.length > 10 ? `\n\n*...and ${queueTracks.length - 10} more*` : ''}`);
        } else {
            embed.setDescription('**Up Next:**\n*No tracks in queue.*');
        }

        await interaction.reply({ embeds: [embed] });
    },
};
