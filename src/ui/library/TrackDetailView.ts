import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { Favorites } from '../../database/Favorites';
import { PersonalPlaylists } from '../../database/PersonalPlaylists';
import { formatDuration } from '../../utils/formatters';

export class TrackDetailView {
    public static async render(userId: string, trackUrl: string): Promise<{ embeds: any[], components: any[] }> {
        const favorites = Favorites.get(userId, 200, 0);
        const track = favorites.find((t: any) => t.url === trackUrl);

        if (!track) {
            const embed = new EmbedBuilder()
                .setColor('#F43F5E')
                .setTitle('❌ Track Not Found')
                .setDescription('This track is no longer in your favorites.');
            return { embeds: [embed], components: [] };
        }

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle(`🎵 ${track.title}`)
            .setDescription(`**Artist:** ${track.artist}\n**Duration:** ${formatDuration(track.duration)}\n**Source:** ${track.source}`)
            .setThumbnail(track.thumbnail || null);

        if (track.url) {
            embed.addFields({ name: 'URL', value: `[Open](${track.url})`, inline: true });
        }

        const rows: any[] = [];

        // Action buttons
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lib:play_track:${encodeURIComponent(track.url)}`)
                    .setLabel('▶️ Play Now')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`lib:remove_fav:${encodeURIComponent(track.url)}`)
                    .setLabel('🗑️ Remove from Favorites')
                    .setStyle(ButtonStyle.Danger)
            );
        rows.push(actionRow);

        // Add to playlist (if user has playlists)
        const playlists = PersonalPlaylists.list(userId);
        if (playlists.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`lib:add_to_playlist:${encodeURIComponent(track.url)}`)
                .setPlaceholder('📋 Add to playlist...')
                .addOptions(playlists.map(p => ({
                    label: p.name,
                    value: `${p.id}`
                })));
            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Back button
        const navRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lib:view:favorites')
                    .setLabel('◀ Back to Favorites')
                    .setStyle(ButtonStyle.Secondary)
            );
        rows.push(navRow);

        return { embeds: [embed], components: rows };
    }
}
