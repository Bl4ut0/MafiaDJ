import { Message, ActionRowBuilder, StringSelectMenuBuilder, TextChannel, GuildMember, ButtonBuilder, ButtonStyle, ButtonInteraction, StringSelectMenuInteraction, escapeMarkdown } from 'discord.js';
import db from '../database/Database';
import { resolveUrl } from '../sources/index';
import PlayerManager from '../player/PlayerManager';
import { joinVoiceChannel } from '@discordjs/voice';
import { runYtDlp } from '../utils/ytdlp';

interface SearchResult {
    title: string;
    url: string;
    duration: string;
    channel: string;
}

/** Search YouTube for multiple results using yt-dlp */
export async function searchYouTubeMultiple(query: string, count: number = 5): Promise<SearchResult[]> {
    try {
        const safeCount = Math.max(1, Math.min(10, count));
        const { stdout } = await runYtDlp([
            '--dump-json',
            '--skip-download',
            '--flat-playlist',
            '--playlist-end', String(safeCount),
            '--no-warnings',
            `ytsearch${safeCount}:${query.slice(0, 200)}`,
        ]);
        return stdout.split(/\r?\n/).filter(Boolean).flatMap(line => {
            try {
                const item = JSON.parse(line);
                const url = item.webpage_url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : '');
                return url ? [{
                    title: String(item.title || 'Unknown').slice(0, 300),
                    url,
                    duration: item.duration_string || String(item.duration || 0),
                    channel: String(item.channel || item.uploader || 'Unknown').slice(0, 300),
                }] : [];
            } catch {
                return [];
            }
        });
    } catch {
        return [];
    }
}

/** Get the configured music_channel_id for a guild */
function getMusicChannelId(guildId: string): string | null {
    const row = db.prepare('SELECT music_channel_id FROM server_settings WHERE guild_id = ?').get(guildId) as any;
    return row?.music_channel_id || null;
}

export async function handleMessage(message: Message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const musicChannelId = getMusicChannelId(guildId);

    // Only handle messages in the music controller channel
    if (!musicChannelId || message.channel.id !== musicChannelId) return;

    // Grab the content before we delete the message
    const query = message.content.trim();

    // Delete the user's message immediately to keep the channel clean
    try {
        await message.delete();
    } catch { /* Missing permissions or already deleted */ }

    // Ignore empty messages, links (let slash commands handle those), and command prefixes
    if (!query || query.startsWith('/') || query.startsWith('!')) return;



    const member = message.member as GuildMember;
    const channel = message.channel as TextChannel;

    // Check if user is in a voice channel
    if (!member?.voice?.channel) {
        const warning = await channel.send({
            content: `⚠️ <@${message.author.id}> You need to be in a voice channel to request songs.`
        });
        setTimeout(() => { warning.delete().catch(() => { }); }, 8000);
        return;
    }



    // Check if the query is a URL or URI
    if (query.match(/^(http|https|www\.|spotify:)/i)) {
        // Direct URL processing (Playlists, Mixes, Direct Links)
        const loadingMsg = await channel.send({ content: `⏳ Processing URL...` });

        try {
            const member = message.member as GuildMember;
            const player = PlayerManager.getPlayer(message.guildId!);

            // Ensure connected
            if (!player.connection) {
                const voiceChannel = member.voice.channel;
                if (!voiceChannel) {
                    await loadingMsg.edit('❌ You must be in a voice channel.');
                    return;
                }
                player.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
                });
                player.connection.subscribe(player.audioPlayer);
            }

            // Resolve tracks (supports playlists!)
            const result = await resolveUrl(query, member.id);

            if (Array.isArray(result)) {
                const added = player.queue.enqueueMany(result);
                if (added === 0) {
                    await loadingMsg.edit('The queue is full.');
                    return;
                }
                await loadingMsg.edit(`Added **${added}** playlist tracks${added < result.length ? ` (${result.length - added} skipped: queue full)` : ''}.`);
            } else {
                if (!player.queue.enqueue(result)) {
                    await loadingMsg.edit('The queue is full.');
                    return;
                }
                if (!player.currentTrack) {
                    await loadingMsg.edit(`Now playing: **${escapeMarkdown(result.title)}**`);
                } else {
                    await loadingMsg.edit(`Added to queue: **${escapeMarkdown(result.title)}**`);
                }
            }

            player.emit('stateChange');

            if (!player.currentTrack && !player.queue.isEmpty()) {
                player.playNext();
            }

            // Auto-cleanup confirmation
            setTimeout(() => { loadingMsg.delete().catch(() => { }); }, 15000);

        } catch (error) {
            console.error('[MessageHandler] URL processing error:', error);
            await loadingMsg.edit('❌ Failed to load URL. (Is it a private playlist or invalid?)');
            setTimeout(() => { loadingMsg.delete().catch(() => { }); }, 10000);
        }
        return;
    }

    // Send a button prompt to search privately (for text queries)
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`search_start:${query.substring(0, 80)}`)
                .setLabel('View Search Results')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Primary)
        );

    const promptMsg = await channel.send({
        content: `<@${message.author.id}>, click below to search for **"${escapeMarkdown(query.substring(0, 50))}"**`,
        components: [buttonRow as any],
        allowedMentions: { users: [message.author.id] },
    });

    // Auto-delete the prompt after 30 seconds to keep channel clean
    setTimeout(() => {
        promptMsg.delete().catch(() => { });
    }, 30000);
}

export async function handleSearchInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
    if (!interaction.guild || !interaction.guildId) return;

    if (interaction.isButton() && interaction.customId.startsWith('search_start:')) {
        const query = interaction.customId.slice('search_start:'.length).trim();
        await interaction.deferReply({ ephemeral: true });
        const results = await searchYouTubeMultiple(query, 5);
        if (results.length === 0) {
            await interaction.editReply('No playable YouTube results were found.');
            return;
        }
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`search_select:${interaction.user.id}`)
            .setPlaceholder('Choose a track')
            .addOptions(results.map(result => ({
                label: result.title.slice(0, 100),
                description: `${result.channel} - ${result.duration}`.slice(0, 100),
                value: result.url.slice(0, 100),
            })));
        await interaction.editReply({
            content: `Results for **${escapeMarkdown(query.slice(0, 100))}**`,
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu) as any],
        });
        return;
    }

    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('search_select:')) return;
    const ownerId = interaction.customId.slice('search_select:'.length);
    if (ownerId !== interaction.user.id) {
        await interaction.reply({ content: 'Run your own search to request a track.', ephemeral: true });
        return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
        await interaction.reply({ content: 'Join a voice channel before requesting music.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });
    const player = PlayerManager.getPlayer(interaction.guildId);
    const connectedChannelId = player.connection?.joinConfig.channelId;
    if (connectedChannelId && connectedChannelId !== voiceChannel.id) {
        await interaction.editReply('The bot is already playing in another voice channel.');
        return;
    }

    if (!player.connection) {
        player.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
        });
        player.connection.subscribe(player.audioPlayer);
    }

    const resolved = await resolveUrl(interaction.values[0], interaction.user.id);
    const tracks = Array.isArray(resolved) ? resolved : [resolved];
    const added = player.queue.enqueueMany(tracks);
    if (added === 0) {
        await interaction.editReply('The queue is full.');
        return;
    }
    if (!player.currentTrack) player.playNext();
    player.emit('stateChange');
    await interaction.editReply(`Queued **${tracks[0].title}**.`);
}
