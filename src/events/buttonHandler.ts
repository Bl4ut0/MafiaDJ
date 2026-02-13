import { ButtonInteraction, Interaction } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { ControllerMessage } from '../ui/ControllerMessage';
import { Favorites } from '../database/Favorites';
import { LibraryManager } from '../ui/library/LibraryManager';

export async function handleButtonInteraction(interaction: ButtonInteraction, controller: ControllerMessage) {
    const customId = interaction.customId;

    // Safety check
    if (!customId.startsWith('controller:')) return;

    const action = customId.split(':')[1];
    const player = PlayerManager.getPlayer(interaction.guildId!);

    if (!player) {
        // Should ideally check if player exists before interacting, but controller persists.
        // If no player active but controller exists, some buttons might fail.
        // However, 'play' isn't on controller.
        await interaction.reply({ content: 'Player not active.', ephemeral: true });
        return;
    }

    try {
        // Handle non-deferrable actions first? 
        // Actually, deferUpdate confirms reception. 
        // BUT for 'like' and 'favorites' we send followUps.

        switch (action) {
            case 'pause':
                await interaction.deferUpdate();
                if (player.audioPlayer.state.status === 'paused') {
                    player.resume();
                } else {
                    player.pause();
                }
                break;
            case 'skip':
                await interaction.deferUpdate();
                player.playNext();
                break;
            case 'stop':
                await interaction.deferUpdate();
                player.stop();
                if (player.connection) {
                    player.connection.destroy();
                    player.connection = null;
                }
                break;
            case 'loop':
                await interaction.deferUpdate();
                player.isLooping = !player.isLooping;
                break;
            case 'shuffle':
                await interaction.deferUpdate();
                player.queue.shuffle();
                break;
            case 'vol_up':
                await interaction.deferUpdate();
                player.setVolume(player.volume + 10);
                break;
            case 'vol_down':
                await interaction.deferUpdate();
                player.setVolume(player.volume - 10);
                break;
            case 'like':
                // Don't defer update here because we want to reply with ephemeral success
                // Actually we can deferUpdate AND followUp ephemeral.
                await interaction.deferUpdate();
                if (player.currentTrack) {
                    const success = Favorites.add(interaction.user.id, player.currentTrack);
                    if (success) {
                        await interaction.followUp({ content: `❤️ **Added to Favorites:** ${player.currentTrack.title}`, ephemeral: true });
                    } else {
                        await interaction.followUp({ content: `⚠️ **Already in Favorites:** ${player.currentTrack.title}`, ephemeral: true });
                    }
                } else {
                    await interaction.followUp({ content: 'Nothing playing to like!', ephemeral: true });
                }
                break;
            case 'favorites':
                await interaction.deferUpdate(); // Acknowledge button click on controller
                await interaction.followUp({ content: '📬 Opening library in DMs...', ephemeral: true });
                await LibraryManager.openLibrary(interaction.user);
                break;
            case 'prev':
                await interaction.deferUpdate();
                break;
        }

        // Update controller state
        await controller.update();
    } catch (error) {
        console.error(`Error handling button ${action}:`, error);
    }
}
