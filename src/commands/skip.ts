import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'You must be in the voice channel.', ephemeral: true });
            return;
        }

        const player = PlayerManager.getPlayer(interaction.guildId);
        if (!player || !player.currentTrack) {
            await interaction.reply({ content: 'Nothing to skip.', ephemeral: true });
            return;
        }

        // Check if user is DJ or Admin
        const role = PermissionManager.getUserRole(member);

        if (role === UserRole.Admin || role === UserRole.DJ) {
            player.playNext();
            await interaction.reply('⏭ **Skipped!** (DJ Action)');
            return;
        }

        // Vote Logic Import Dynamic to avoid circular dependency issues if any
        const VoteManager = (await import('../permissions/VoteManager')).default;

        const result = await VoteManager.requestVote(
            interaction.guildId,
            member,
            'skip',
            voiceChannel,
            () => {
                player.playNext();
                if (interaction.replied) interaction.channel?.send('⏭ **Vote Passed!** Skipped the track.');
            }
        );

        if (result.type === 'instant') {
            await interaction.reply('⏭ **Skipped!**');
        } else if (result.type === 'started') {
            await interaction.reply({
                content: '🗳️ **Vote Started!**',
                embeds: [VoteManager.createVoteEmbed(result.vote!)]
            });
        } else if (result.type === 'success') {
            // Vote cast successfully but didn't trigger end (shouldn't happen on 'started')
            await interaction.reply('🗳️ **Vote Cast!**');
        } else if (result.type === 'error') {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
        }
    },
};
