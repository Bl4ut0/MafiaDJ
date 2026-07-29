import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { joinVoiceChannel } from '@discordjs/voice';
import { config } from '../config';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('jam')
        .setDescription('Follow the instance owner Spotify playback and autoplay')
        .addStringOption(option =>
            option.setName('link')
                .setDescription('Optional Spotify Jam invite link to share')
                .setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        if (PermissionManager.getUserRole(member) !== UserRole.Admin) {
            await interaction.reply({ content: 'Only administrators can start owner Spotify sync.', ephemeral: true });
            return;
        }
        if (!config.spotifyOwnerSyncAvailable || !config.spotifyOwnerSyncRiskAcknowledged || !config.spotifyRefreshToken) {
            await interaction.reply({
                content: 'Owner Spotify sync is disabled in the server configuration.',
                ephemeral: true,
            });
            return;
        }

        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'Join a voice channel before starting owner Spotify sync.', ephemeral: true });
            return;
        }

        let jamLink: string | null = null;
        const suppliedLink = interaction.options.getString('link');
        if (suppliedLink) {
            try {
                const parsed = new URL(suppliedLink);
                const host = parsed.hostname.toLowerCase();
                if (parsed.protocol !== 'https:' || !['open.spotify.com', 'spotify.link'].includes(host)) {
                    throw new Error('invalid host');
                }
                jamLink = parsed.href;
            } catch {
                await interaction.reply({ content: 'The Jam link must be an HTTPS Spotify link.', ephemeral: true });
                return;
            }
        }

        await interaction.deferReply();
        const player = PlayerManager.getPlayer(interaction.guildId!);
        const connectedChannelId = player.connection?.joinConfig.channelId;
        if (connectedChannelId && connectedChannelId !== voiceChannel.id) {
            await interaction.editReply('The bot is already connected to another voice channel.');
            return;
        }
        if (!player.connection) {
            player.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
            });
            player.connection.subscribe(player.audioPlayer);
        }
        player.setSpotifyOwnerSyncEnabled(true);
        if (!await player.startJam()) {
            await interaction.editReply('Spotify sync could not start. Check the refresh token and server logs.');
            return;
        }

        const description = [
            `**Host:** <@${member.id}>`,
            '**Mode:** Owner Spotify playback state with YouTube audio fallback',
            jamLink ? `**Invite:** [Open Spotify Jam](${jamLink})` : '',
        ].filter(Boolean).join('\n');
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Spotify Owner Sync Active')
                    .setColor('#1DB954')
                    .setDescription(description)
                    .setFooter({ text: 'Only the instance administrator can enable this mode.' }),
            ],
        });
    },
};
