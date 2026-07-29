import { ButtonInteraction, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { ControllerMessage } from '../ui/ControllerMessage';
import { Favorites } from '../database/Favorites';
import { LibraryManager } from '../ui/library/LibraryManager';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';
import VoteManager from '../permissions/VoteManager';

const DJ_ONLY_ACTIONS = new Set(['loop', 'shuffle', 'vol_up', 'vol_down']);

export async function handleButtonInteraction(interaction: ButtonInteraction, controller: ControllerMessage) {
    if (!interaction.customId.startsWith('controller:') || !interaction.guildId || !interaction.guild) return;

    const action = interaction.customId.split(':')[1];
    const player = PlayerManager.getPlayer(interaction.guildId);

    try {
        if (action === 'like') {
            await interaction.deferUpdate();
            if (!player.currentTrack) {
                await interaction.followUp({ content: 'Nothing is playing.', ephemeral: true });
            } else {
                const added = Favorites.add(interaction.user.id, player.currentTrack);
                await interaction.followUp({
                    content: added
                        ? `Added to favorites: **${player.currentTrack.title}**`
                        : `Already in favorites: **${player.currentTrack.title}**`,
                    ephemeral: true,
                });
            }
            return;
        }

        if (action === 'favorites') {
            await interaction.deferUpdate();
            await interaction.followUp({ content: 'Opening your library in DMs...', ephemeral: true });
            await LibraryManager.openLibrary(interaction.user);
            return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const memberChannel = member.voice.channel;
        const botChannelId = player.connection?.joinConfig.channelId;
        if (!memberChannel || !botChannelId || memberChannel.id !== botChannelId) {
            await interaction.reply({
                content: 'Join the bot in its voice channel before using playback controls.',
                ephemeral: true,
            });
            return;
        }

        const role = PermissionManager.getUserRole(member);
        const privileged = role === UserRole.Admin || role === UserRole.DJ;
        if (DJ_ONLY_ACTIONS.has(action) && !privileged) {
            await interaction.reply({ content: 'Only DJs and administrators can use that control.', ephemeral: true });
            return;
        }

        if (['pause', 'skip', 'stop'].includes(action) && !privileged) {
            const voteAction = action === 'pause' && player.audioPlayer.state.status === 'paused'
                ? 'resume'
                : action as 'pause' | 'skip' | 'stop';
            const result = await VoteManager.requestVote(
                interaction.guildId,
                member as GuildMember,
                voteAction,
                memberChannel,
                () => executePlaybackAction(action, player)
            );
            const message = result.type === 'error'
                ? result.message
                : result.type === 'started'
                    ? `Vote started: ${(result as any).vote.votes.size}/${(result as any).vote.required}. Other listeners can press the same control to vote.`
                    : result.type === 'updated'
                        ? `Vote recorded: ${(result as any).vote.votes.size}/${(result as any).vote.required}.`
                        : 'Action approved.';
            await interaction.reply({ content: message, ephemeral: true });
            await controller.update();
            return;
        }

        await interaction.deferUpdate();
        executePlaybackAction(action, player);
        await controller.update();
    } catch (error) {
        console.error(`Error handling button ${action}:`, error);
        const response = { content: 'That control could not be completed.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(response);
        else await interaction.reply(response);
    }
}

function executePlaybackAction(action: string, player: ReturnType<typeof PlayerManager.getPlayer>): void {
    switch (action) {
        case 'pause':
            player.audioPlayer.state.status === 'paused' ? player.resume() : player.pause();
            break;
        case 'skip':
            player.playNext();
            break;
        case 'stop':
            player.stop();
            player.connection?.destroy();
            player.connection = null;
            break;
        case 'loop':
            player.cycleLoopMode();
            break;
        case 'shuffle':
            player.queue.shuffle();
            player.emit('stateChange');
            break;
        case 'vol_up':
            player.setVolume(player.volume + 10);
            break;
        case 'vol_down':
            player.setVolume(player.volume - 10);
            break;
    }
}
