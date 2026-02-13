import { ActivityType, Client, Events } from 'discord.js';
import { ControllerMessage } from '../ui/ControllerMessage';
import { logger } from '../utils/logger';

export default function ready(client: Client) {
    client.once(Events.ClientReady, async (c) => {
        logger.info(`Ready! Logged in as ${c.user.tag}`);

        // Set Activity
        client.user?.setActivity('Music', { type: ActivityType.Listening });

        // Restore controller state for all guilds
        for (const [id, guild] of c.guilds.cache) {
            try {
                // Initialize controller (attaches listeners)
                ControllerMessage.getInstance(client, id);
                logger.info(`Restored controller for guild: ${guild.name} (${id})`);
            } catch (err) {
                logger.error(`Failed to restore controller for guild ${id}:`, err);
            }
        }
    });
}
