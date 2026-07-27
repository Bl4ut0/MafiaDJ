import { VoiceState, Client } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { logger } from '../utils/logger';

export function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guildId = oldState.guild.id || newState.guild.id;
    const player = PlayerManager.getPlayer(guildId);

    if (!player.connection) return;

    // Check if a user left the voice channel
    if (oldState.channelId && (!newState.channelId || newState.channelId !== oldState.channelId)) {
        const botChannel = oldState.guild.members.me?.voice.channel;
        if (!botChannel) return;

        // Count human members in bot's channel
        const humanMembers = botChannel.members.filter(m => !m.user.bot);

        if (humanMembers.size === 0) {
            // Bot is alone — disconnect after a short delay
            logger.info(`[VoiceState] Bot alone in VC in guild ${guildId}. Disconnecting in 30s...`);

            setTimeout(() => {
                // Re-check in case someone joined
                const channel = oldState.guild.members.me?.voice.channel;
                if (channel) {
                    const stillAlone = channel.members.filter(m => !m.user.bot).size === 0;
                    if (stillAlone && player.connection) {
                        logger.info(`[VoiceState] Still alone. Disconnecting.`);
                        player.stop();
                        player.connection.destroy();
                        player.connection = null;
                    }
                }
            }, 30000);
        }
    }
}
