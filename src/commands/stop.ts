import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue'),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'You must be in the voice channel.', ephemeral: true });
            return;
        }

        const player = PlayerManager.getPlayer(interaction.guildId);
        if (!player || !player.connection) {
            await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
            return;
        }

        const role = PermissionManager.getUserRole(member);
        if (role === UserRole.Admin || role === UserRole.DJ) {
            player.stop();
            if (player.connection) player.connection.destroy();
            player.connection = null;
            await interaction.reply('⏹ **Stopped!** (DJ Action)');
            return;
        }

        const VoteManager = (await import('../permissions/VoteManager')).default;

        const result = await VoteManager.requestVote(
            interaction.guildId,
            member,
            'stop',
            voiceChannel,
            () => {
                player.stop();
                if (player.connection) player.connection.destroy();
                player.connection = null;
                if (interaction.replied && interaction.channel && 'send' in interaction.channel) (interaction.channel as any).send('⏹ **Vote Passed!** Stopped playback.');
            }
        );

        if (result.type === 'instant') {
            await interaction.reply('⏹ **Stopped!**');
        } else if (result.type === 'started' && (result as any).vote) {
            await interaction.reply({
                content: '🗳️ **Vote Started to Stop!**',
                embeds: [VoteManager.createVoteEmbed((result as any).vote)]
            });
        } else if (result.type === 'error') {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
        }
    },
};
