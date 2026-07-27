import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Favorites } from '../../database/Favorites';
import { formatDuration } from '../../utils/formatters';

export class SearchView {
    public static async render(userId: string, query: string): Promise<{ embeds: any[], components: any[] }> {
        const results = Favorites.search(userId, query);

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle(`🔍 Search: "${query}"`)
            .setDescription(results.length > 0
                ? `Found **${results.length}** result${results.length !== 1 ? 's' : ''} in your favorites.`
                : 'No matches found in your favorites.'
            );

        if (results.length > 0) {
            const list = results.slice(0, 15).map((t: any, i) =>
                `**${i + 1}.** [${t.title}](${t.url}) - ${t.artist} • \`${formatDuration(t.duration)}\``
            ).join('\n');
            embed.addFields({ name: 'Results', value: list + (results.length > 15 ? `\n*...and ${results.length - 15} more*` : '') });
        }

        const rows: any[] = [];

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
