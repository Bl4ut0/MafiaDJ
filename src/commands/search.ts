import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { searchYouTubeMultiple } from '../events/messageHandler';

export const command = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search YouTube for a song')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('What to search for')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        // Use ephemeral reply to keep search private
        await interaction.deferReply({ ephemeral: true });

        const query = interaction.options.getString('query', true);

        try {
            // Search for top 5 results
            const results = await searchYouTubeMultiple(query, 5);

            if (!results || results.length === 0) {
                await interaction.editReply('❌ No results found.');
                // Auto-delete error
                setTimeout(() => { interaction.deleteReply().catch(() => { }); }, 8000);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#7C3AED')
                .setTitle(`🔍 Search Results`)
                .setDescription(`Requested by <@${interaction.user.id}>\n\n` +
                    results.map((r, i) => `**${i + 1}.** [${r.title}](${r.url})\n　　⏱ ${r.duration} • ${r.channel}`).join('\n\n'))
                .setFooter({ text: 'Select a track below • Auto-expires in 60s' });

            // Use the same custom ID format as the working text-search: quicksearch:select:USER_ID
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`quicksearch:select:${interaction.user.id}`)
                .setPlaceholder('Pick a track to play')
                .addOptions(results.map((r, i) => ({
                    label: `${i + 1}. ${r.title}`.substring(0, 100),
                    description: `${r.duration} • ${r.channel}`.substring(0, 100),
                    value: r.url
                })));

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            await interaction.editReply({
                content: '', // Clear any loading text
                embeds: [embed],
                components: [row as any]
            });

            // Auto-cleanup after 60 seconds (matching message handler behavior)
            setTimeout(() => {
                interaction.deleteReply().catch(() => { });
            }, 60000);

        } catch (error) {
            console.error('Search error:', error);
            await interaction.editReply('❌ Search failed. Please try again.');
        }
    }
};

