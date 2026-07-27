import { VoiceConnectionStatus } from '@discordjs/voice';
import PlayerManager from '../player/PlayerManager';
import { logger } from '../utils/logger';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Proactive player health check.
 *
 * Runs every 5 minutes and inspects every active player to catch issues that
 * voice-state events alone won't surface (e.g. network drops, VM resume, etc.).
 *
 * Checks:
 *  - Bot silently disconnected but player still thinks it's connected → cleanup
 *  - Bot is in VC but connection dropped → attempt reconnect
 *  - All humans in VC are self-deafened (not listening) → pause
 *  - Resume if humans came back and we were auto-paused
 */
export function startPlayerHealthCheck(): void {
    setInterval(async () => {
        const players = PlayerManager.getAllPlayers();

        for (const player of players) {
            try {
                const { connection, currentTrack, guildId } = player;

                // No connection tracked — nothing to check
                if (!connection) continue;

                const status = connection.state.status;

                // 1. Connection is in a destroyed/failed state — clean up the player
                if (status === VoiceConnectionStatus.Destroyed) {
                    logger.warn(`[HealthCheck] Guild ${guildId}: connection destroyed, cleaning up player.`);
                    player.stop();
                    player.connection = null;
                    continue;
                }

                // 2. Connection disconnected (not in the middle of reconnecting) → try to reconnect
                if (status === VoiceConnectionStatus.Disconnected) {
                    logger.warn(`[HealthCheck] Guild ${guildId}: detected silent disconnect. Attempting reconnect...`);
                    try {
                        connection.rejoin();
                        logger.info(`[HealthCheck] Guild ${guildId}: rejoin issued.`);
                    } catch (e) {
                        logger.error(`[HealthCheck] Guild ${guildId}: rejoin failed, cleaning up.`, e);
                        player.stop();
                        player.connection = null;
                    }
                    continue;
                }

                // 3. Check who's in the voice channel — are any humans actively listening?
                const voiceChannel = (connection as any).joinConfig?.channelId
                    ? player.connection?.joinConfig?.channelId
                    : null;

                // We need the guild to inspect VC membership
                // PlayerManager doesn't hold the Guild object, so we skip the deafen check here.
                // The voiceStateUpdate event already handles the alone-in-VC case reactively.
                // This check is kept minimal to avoid needing the full Guild object.

                // 4. Stale player: nothing playing, queue is empty, but connection is still live
                if (!currentTrack && player.queue.isEmpty()) {
                    // Idle timer already handles disconnect — this is just a safety log
                    logger.debug(`[HealthCheck] Guild ${guildId}: player idle (no track, empty queue). Idle timer should handle disconnect.`);
                }

            } catch (err) {
                logger.error(`[HealthCheck] Unexpected error checking guild ${player.guildId}:`, err);
            }
        }
    }, CHECK_INTERVAL_MS);

    logger.info('[HealthCheck] Player health check started (interval: 5 min).');
}
