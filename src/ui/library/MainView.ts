import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder, Utils } from 'discord.js';
import { Favorites } from '../../database/Favorites';
import { LibraryManager } from './LibraryManager'; // Will create this next
import { QueueItem } from '../../types';

export class MainView {
    public static async render(userId: string, page: number = 1): Promise<{ embeds: any[], components: any[] }> {
        const limit = 10;
        const offset = (page - 1) * limit;
        const favorites = Favorites.get(userId, limit, offset);
        const total = Favorites.count(userId);
        const totalPages = Math.ceil(total / limit);

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle('📚 My Music Library')
            .setDescription(`**Favorites (${total} tracks)**\nClick a track ID to view details or play.`)
            .setFooter({ text: `Page ${page} of ${totalPages || 1}` });

        if (favorites.length === 0) {
            embed.addFields({ name: 'Empty', value: 'You have no favorites yet. Click the ❤️ button on the player controller to add some!' });
        } else {
            const list = favorites.map((t: any, i) => `**${offset + i + 1}.** [${t.title}](${t.url}) - ${t.artist}`).join('\n');
            embed.setDescription(`**Favorites**\n${list}`);
        }

        // Navigation Components
        // Row 1: Select track (StringSelectMenu is limited to 25 items, we display 10. Perfect.)
        const trackOptions = favorites.map((t: any, i) => ({
            label: `${offset + i + 1}. ${t.title.substring(0, 25)}`,
            description: t.artist.substring(0, 50),
            value: `view_track:${t.url}` // Using URL as unique ID for now, ideally ID
        }));

        const rows: any[] = [];

        if (trackOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('lib:select_track')
                .setPlaceholder('Select a track to play or view details') // Fixed: setPlaceholder is typically chainable
                .addOptions(trackOptions);

            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Row 2: Helper Buttons (Pages, View Playlists)
        const btnRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lib:page:${page - 1}`)
                    .setLabel('◀ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId('lib:view:playlists')
                    .setLabel('📂 Playlists')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('lib:search')
                    .setLabel('🔍 Search')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`lib:page:${page + 1}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages || totalPages === 0)
            );

        rows.push(btnRow);

        return { embeds: [embed], components: rows };
    }
}
