import { Message, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, TextChannel, GuildMember, ButtonBuilder, ButtonStyle } from 'discord.js';
import { spawn } from 'child_process';
import { config } from '../config';
import db from '../database/Database';
import { resolveUrl } from '../sources/index';
import PlayerManager from '../player/PlayerManager';
import { joinVoiceChannel } from '@discordjs/voice';

interface SearchResult {
    title: string;
    url: string;
    duration: string;
    channel: string;
}

/** Search YouTube for multiple results using yt-dlp */
export function searchYouTubeMultiple(query: string, count: number = 5): Promise<SearchResult[]> {
    return new Promise((resolve) => {
        const ytDlpPath = config.paths?.ytdlp || 'yt-dlp';
        const proc = spawn(ytDlpPath, [
            '--print', '%(title)s\t%(webpage_url)s\t%(duration_string)s\t%(channel)s',
            '--no-playlist',
            '--flat-playlist',
            `ytsearch${count}:${query}`
        ]);

        let output = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0 || !output.trim()) {
                resolve([]);
                return;
            }

            const results = output.trim().split('\n').map(line => {
                const [title, url, duration, channel] = line.split('\t');
                return { title: title || 'Unknown', url: url || '', duration: duration || '?:??', channel: channel || 'Unknown' };
            }).filter(r => r.url);

            resolve(results);
        });

        proc.on('error', () => resolve([]));
    });
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
                player.setConnection(player.connection);
                player.connection.subscribe(player.audioPlayer);
            }

            // Resolve tracks (supports playlists!)
            const result = await resolveUrl(query, member.id, message.guildId!);

            if (Array.isArray(result)) {
                result.forEach(track => player.queue.enqueue(track));
                await loadingMsg.edit(`✅ Added **${result.length}** tracks from playlist to queue.`);
            } else {
                player.queue.enqueue(result);
                if (!player.currentTrack) {
                    await loadingMsg.edit(`▶️ Now playing: **${result.title}**`);
                } else {
                    await loadingMsg.edit(`✅ Added to queue: **${result.title}**`);
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
        content: `<@${message.author.id}>, click below to search for **"${query.substring(0, 50)}..."**`,
        components: [buttonRow as any]
    });

    // Auto-delete the prompt after 30 seconds to keep channel clean
    setTimeout(() => {
        promptMsg.delete().catch(() => { });
    }, 30000);
}
