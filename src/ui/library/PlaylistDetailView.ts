import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { PersonalPlaylists } from '../../database/PersonalPlaylists';
import { formatDuration } from '../../utils/formatters';

export class PlaylistDetailView {
    public static async render(userId: string, playlistId: number, page: number = 1): Promise<{ embeds: any[], components: any[] }> {
        const playlists = PersonalPlaylists.list(userId);
        const playlist = playlists.find(p => p.id === playlistId);

        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#F43F5E')
                .setTitle('❌ Playlist Not Found')
                .setDescription('This playlist no longer exists.');
            return { embeds: [embed], components: [] };
        }

        const allTracks = PersonalPlaylists.getTracks(playlistId);
        const limit = 10;
        const offset = (page - 1) * limit;
        const tracks = allTracks.slice(offset, offset + limit);
        const totalPages = Math.ceil(allTracks.length / limit) || 1;
        const totalDuration = allTracks.reduce((acc, t) => acc + (t.duration || 0), 0);

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle(`📂 ${playlist.name}`)
            .setDescription(`**${allTracks.length}** tracks • ${formatDuration(totalDuration)}`)
            .setFooter({ text: `Page ${page} of ${totalPages}` });

        if (tracks.length > 0) {
            const list = tracks.map((t: any, i) =>
                `**${offset + i + 1}.** [${t.title}](${t.url}) - ${t.artist}`
            ).join('\n');
            embed.addFields({ name: 'Tracks', value: list });
        } else {
            embed.addFields({ name: 'Tracks', value: '*No tracks yet. Add favorites to this playlist!*' });
        }

        const rows: any[] = [];

        // Action buttons
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lib:playlist_import:${playlistId}`)
                    .setLabel('▶️ Import to Queue')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(allTracks.length === 0),
                new ButtonBuilder()
                    .setCustomId(`lib:playlist_shuffle:${playlistId}`)
                    .setLabel('🔀 Import Shuffled')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(allTracks.length === 0),
                new ButtonBuilder()
                    .setCustomId(`lib:playlist_delete:${playlistId}`)
                    .setLabel('🗑️ Delete')
                    .setStyle(ButtonStyle.Danger)
            );
        rows.push(actionRow);

        // Navigation
        const navRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lib:playlist_page:${playlistId}:${page - 1}`)
                    .setLabel('◀ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId(`lib:playlist_page:${playlistId}:${page + 1}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages),
                new ButtonBuilder()
                    .setCustomId('lib:view:playlists')
                    .setLabel('◀ Back to Playlists')
                    .setStyle(ButtonStyle.Secondary)
            );
        rows.push(navRow);

        return { embeds: [embed], components: rows };
    }
}
