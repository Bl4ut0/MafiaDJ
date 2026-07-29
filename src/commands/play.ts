import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, escapeMarkdown } from 'discord.js';
import { resolveUrl } from '../sources/index';
import PlayerManager from '../player/PlayerManager';
import { joinVoiceChannel } from '@discordjs/voice';

export const command = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist from YouTube, Spotify, or SoundCloud')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The URL of the song/playlist')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const url = interaction.options.getString('url', true);
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.editReply('You need to be in a voice channel to play music!');
            return;
        }

        try {
            const result = await resolveUrl(url, member.id);
            const player = PlayerManager.getPlayer(interaction.guildId!);

            if (!player.connection) {
                player.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
                });
                player.connection.subscribe(player.audioPlayer);
            }

            if (Array.isArray(result)) {
                // Playlist
                const added = player.queue.enqueueMany(result);
                if (added === 0) {
                    await interaction.editReply('The queue is full.');
                    return;
                }
                await interaction.editReply(`Added **${added}** tracks to the queue${added < result.length ? ` (${result.length - added} skipped: queue full)` : ''}.`);
            } else {
                // Single Track
                if (!player.queue.enqueue(result)) {
                    await interaction.editReply('The queue is full.');
                    return;
                }
                if (!player.currentTrack) {
                    await interaction.editReply(`Now playing: **${escapeMarkdown(result.title)}**`);
                } else {
                    await interaction.editReply(`Added to queue: **${escapeMarkdown(result.title)}**`);
                }
            }

            if (!player.currentTrack && !player.queue.isEmpty()) {
                player.playNext();
            } else if (!player.currentTrack && Array.isArray(result)) {
                // Should have started? 
                // playNext only works if queue has items. 
                // We enqueued, so it should work.
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Failed to load track(s). Please check the URL.');
        }
    },
};
