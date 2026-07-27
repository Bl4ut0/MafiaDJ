import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { History } from '../../database/History';
import { Favorites } from '../../database/Favorites';
import client from '../../bot/client';

export class HistoryView {
    public static async render(userId: string, guildId?: string, page: number = 1): Promise<{ embeds: any[], components: any[] }> {
        const limit = 10;
        const offset = (page - 1) * limit;

        // Fetch history based on context
        let history = [];
        let title = '📜 My Play History';
        let description = 'Tracks you have listened to recently.';

        if (guildId) {
            history = History.getRecent(guildId, limit, offset);
            const guild = client.guilds.cache.get(guildId);
            title = `📜 Server History: ${guild?.name || 'Unknown Server'}`;
            description = `Recent tracks played in **${guild?.name || 'this server'}**.\nSelect a track below to add it to your **Favorites**!`;
        } else {
            history = History.getUserRecent(userId, limit, offset);
        }

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: `Page ${page}` });

        if (history.length === 0) {
            embed.addFields({ name: 'Empty', value: 'No playback history found.' });
        } else {
            const list = history.map((t: any, i) => {
                const isFav = Favorites.isFavorite(userId, t.url);
                return `**${offset + i + 1}.** [${t.title}](${t.url}) ${isFav ? '❤️' : ''}`;
            }).join('\n');
            embed.setDescription(`${description}\n\n${list}`);
        }

        const rows: any[] = [];

        // Row 1: Select track to favorite
        if (history.length > 0) {
            const trackOptions = history.map((t: any, i) => ({
                label: `${offset + i + 1}. ${t.title.substring(0, 50)}`,
                description: t.artist.substring(0, 50),
                value: t.url.substring(0, 100) // Ensure max length
            }));

            // Filter out duplicates in the dropdown if any (select menu requires unique values)
            const uniqueOptions = trackOptions.filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('lib:history_add_fav')
                .setPlaceholder('❤️ Select a track to Favorite...')
                .addOptions(uniqueOptions);

            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Row 2: Navigation
        const btnRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lib:history_page:${page - 1}`)
                    .setLabel('◀ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId('lib:view:favorites')
                    .setLabel('🏠 Library Home')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`lib:history_page:${page + 1}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(history.length < limit) // Simple check, exact count not strictly needed
            );

        rows.push(btnRow);

        return { embeds: [embed], components: rows };
    }
}
