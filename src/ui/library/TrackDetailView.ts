import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { Favorites } from '../../database/Favorites';
import { PersonalPlaylists } from '../../database/PersonalPlaylists';
import { formatDuration } from '../../utils/formatters';

export class TrackDetailView {
    public static async render(userId: string, favoriteId: number): Promise<{ embeds: any[], components: any[] }> {
        const track = Favorites.getById(favoriteId, userId);
        if (!track) {
            return {
                embeds: [new EmbedBuilder()
                    .setColor('#F43F5E')
                    .setTitle('Track Not Found')
                    .setDescription('This track is no longer in your favorites.')],
                components: [],
            };
        }

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle(track.title)
            .setDescription(`**Artist:** ${track.artist}\n**Duration:** ${formatDuration(track.duration)}\n**Source:** ${track.source}`)
            .setThumbnail(track.thumbnail || null)
            .addFields({ name: 'URL', value: `[Open](${track.url})`, inline: true });

        const rows: any[] = [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`lib:play_track:${favoriteId}`)
                    .setLabel('Play')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`lib:remove_fav:${favoriteId}`)
                    .setLabel('Remove Favorite')
                    .setStyle(ButtonStyle.Danger)
            ),
        ];

        const playlists = PersonalPlaylists.list(userId);
        if (playlists.length > 0) {
            rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`lib:add_to_playlist:${favoriteId}`)
                    .setPlaceholder('Add to playlist...')
                    .addOptions(playlists.slice(0, 25).map(playlist => ({
                        label: playlist.name.slice(0, 100),
                        value: String(playlist.id),
                    })))
            ));
        }
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('lib:view:favorites')
                .setLabel('Back to Favorites')
                .setStyle(ButtonStyle.Secondary)
        ));
        return { embeds: [embed], components: rows };
    }
}
