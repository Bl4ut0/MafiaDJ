import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, escapeMarkdown } from 'discord.js';
import { searchYouTubeMultiple } from '../events/messageHandler';
import SpotifyAPI from '../spotify/SpotifyAPI';
import { config } from '../config';

interface SearchChoice {
    title: string;
    url: string;
    duration: string;
    artist: string;
    source: 'YouTube' | 'Spotify';
}

export const command = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search YouTube and Spotify for a song')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('What to search for')
                .setMaxLength(200)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('source')
                .setDescription('Catalog to search')
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'Spotify', value: 'spotify' }
                )),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const query = interaction.options.getString('query', true);
        const source = interaction.options.getString('source') || 'all';

        try {
            const results: SearchChoice[] = [];
            if (source === 'all' || source === 'youtube') {
                const youtube = await searchYouTubeMultiple(query, 5);
                results.push(...youtube.map(item => ({
                    title: item.title,
                    url: item.url,
                    duration: item.duration,
                    artist: item.channel,
                    source: 'YouTube' as const,
                })));
            }
            if ((source === 'all' || source === 'spotify') && config.spotifyClientId && config.spotifyClientSecret) {
                const spotify = await SpotifyAPI.searchTracks(query, 5);
                results.push(...spotify.map(item => ({
                    title: item.name,
                    url: item.external_urls.spotify,
                    duration: `${Math.floor(item.duration_ms / 60_000)}:${String(Math.floor(item.duration_ms / 1000) % 60).padStart(2, '0')}`,
                    artist: item.artists.map(artist => artist.name).join(', '),
                    source: 'Spotify' as const,
                })));
            }

            if (results.length === 0) {
                await interaction.editReply(source === 'spotify'
                    ? 'Spotify search is unavailable or returned no results.'
                    : 'No results found.');
                return;
            }

            const choices = results.slice(0, 10);
            const embed = new EmbedBuilder()
                .setColor('#7C3AED')
                .setTitle('Search Results')
                .setDescription(choices.map((item, index) =>
                    `**${index + 1}.** [${escapeMarkdown(item.title)}](${item.url})\n${item.source} - ${escapeMarkdown(item.artist)} - ${item.duration}`
                ).join('\n\n'))
                .setFooter({ text: 'Spotify selections use YouTube audio fallback.' });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`search_select:${interaction.user.id}`)
                .setPlaceholder('Choose a track')
                .addOptions(choices.map((item, index) => ({
                    label: `${index + 1}. ${item.title}`.slice(0, 100),
                    description: `${item.source} - ${item.artist}`.slice(0, 100),
                    value: item.url.slice(0, 100),
                })));

            await interaction.editReply({
                embeds: [embed],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu) as any],
            });
        } catch (error) {
            console.error('Search error:', error);
            await interaction.editReply('Search failed. Please try again shortly.');
        }
    },
};
