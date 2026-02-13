import { EmbedBuilder, QueueItem } from 'discord.js'; // Importing QueueItem from discord.js is wrong. QueueItem is custom type.
import { QueueItem as CustomQueueItem } from '../../types'; // Fix aliasing
import { formatDuration, createProgressBar } from '../../utils/formatters';

export function createNowPlayingEmbed(track: CustomQueueItem | null, queue: CustomQueueItem[], isPaused: boolean = false, isLooping: boolean = false, volume: number = 50) {
    const embed = new EmbedBuilder()
        .setColor('#7C3AED')
        .setTimestamp();

    if (!track) {
        embed.setTitle('Passive Mode 💤')
            .setDescription('Queue is empty. Use `/play` or buttons to add music.')
            .setFooter({ text: 'MafiaDJ • Waiting for requests' });
        return embed;
    }

    const duration = formatDuration(track.duration);

    // Status line with simple icons
    const statusLine = `Volume: **${volume}%** | Loop: **${isLooping ? 'On' : 'Off'}** | ${isPaused ? 'Paused ⏸' : 'Playing ▶'}`;

    embed.setTitle('Now Playing 🎵')
        .setDescription(`[**${track.title}**](${track.url})\n${track.artist}\n\n${statusLine}`) // Combined description
        .setThumbnail(track.thumbnail || null)
        .addFields(
            { name: 'Duration', value: duration, inline: true },
            { name: 'Requested By', value: `<@${track.requesterId}>`, inline: true },
            { name: 'Source', value: track.source, inline: true }
        );

    // Queue preview (first 5 tracks)
    if (queue.length > 0) {
        const nextTracks = queue.slice(0, 5).map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) | <@${t.requesterId}>`).join('\n');
        embed.addFields({ name: 'Up Next', value: nextTracks + (queue.length > 5 ? `\n...and ${queue.length - 5} more` : '') });
    } else {
        embed.addFields({ name: 'Up Next', value: 'Queue is empty.' });
    }

    embed.setFooter({ text: `MafiaDJ Player` });

    return embed;
}
