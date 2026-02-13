import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume playback'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.guildId) return;
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'You must be in the voice channel.', ephemeral: true });
            return;
        }

        const player = PlayerManager.getPlayer(interaction.guildId);

        if (!player.audioPlayer.state.status || player.audioPlayer.state.status === 'idle') {
            await interaction.reply('Nothing is playing.');
            return;
        }

        const isPaused = player.audioPlayer.state.status === 'paused';
        const action = isPaused ? 'resume' : 'pause';

        const role = PermissionManager.getUserRole(member);
        if (role === UserRole.Admin || role === UserRole.DJ) {
            if (isPaused) player.resume(); else player.pause();
            await interaction.reply(isPaused ? '▶️ **Resumed!** (DJ Action)' : '⏸️ **Paused!** (DJ Action)');
            return;
        }

        const VoteManager = (await import('../permissions/VoteManager')).default;

        const result = await VoteManager.requestVote(
            interaction.guildId,
            member,
            action,
            voiceChannel,
            () => {
                if (isPaused) player.resume(); else player.pause();
                if (interaction.replied) interaction.channel?.send(isPaused ? '▶️ **Vote Passed!** Resumed.' : '⏸️ **Vote Passed!** Paused.');
            }
        );

        if (result.type === 'instant') {
            await interaction.reply(isPaused ? '▶️ **Resumed!**' : '⏸️ **Paused!**');
        } else if (result.type === 'started') {
            await interaction.reply({
                content: `🗳️ **Vote Started to ${action.toUpperCase()}!**`,
                embeds: [VoteManager.createVoteEmbed(result.vote!)]
            });
        } else if (result.type === 'error') {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
        }
    },
};
