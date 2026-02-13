import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { resolveUrl } from '../sources/index';
import PlayerManager from '../player/PlayerManager';
import { joinVoiceChannel } from '@discordjs/voice';
import { QueueItem } from '../types';

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
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });
                player.connection.subscribe(player.audioPlayer);
            }

            if (Array.isArray(result)) {
                // Playlist
                result.forEach(track => player.queue.enqueue(track));
                await interaction.editReply(`✅ Added **${result.length}** tracks to the queue.`);
            } else {
                // Single Track
                player.queue.enqueue(result);
                if (!player.currentTrack) {
                    await interaction.editReply(`▶️ Now playing: **${result.title}**`);
                } else {
                    await interaction.editReply(`✅ Added to queue: **${result.title}**`);
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
