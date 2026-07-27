import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { PersonalPlaylists } from '../../database/PersonalPlaylists';

export class PlaylistsView {
    public static async render(userId: string): Promise<{ embeds: any[], components: any[] }> {
        const playlists = PersonalPlaylists.list(userId);

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle('📂 My Playlists')
            .setDescription(playlists.length > 0
                ? `You have **${playlists.length}** playlist${playlists.length !== 1 ? 's' : ''}. Select one to view.`
                : 'You have no playlists yet. Create one below!'
            );

        if (playlists.length > 0) {
            const list = playlists.map((p: any, i: number) => {
                const tracks = PersonalPlaylists.getTracks(p.id);
                return `**${i + 1}.** ${p.name} • ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
            }).join('\n');
            embed.addFields({ name: 'Your Playlists', value: list });
        }

        const rows: any[] = [];

        // Select menu for playlists
        if (playlists.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('lib:playlist_select')
                .setPlaceholder('Select a playlist')
                .addOptions(playlists.map(p => ({
                    label: p.name,
                    value: `${p.id}`
                })));
            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Buttons
        const btnRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lib:create_playlist')
                    .setLabel('➕ Create Playlist')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('lib:view:favorites')
                    .setLabel('❤️ Back to Favorites')
                    .setStyle(ButtonStyle.Secondary)
            );
        rows.push(btnRow);

        return { embeds: [embed], components: rows };
    }
}
