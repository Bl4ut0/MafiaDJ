import { ActivityType, Client, Events, REST, Routes } from 'discord.js';
import { ControllerMessage } from '../ui/ControllerMessage';
import { logger } from '../utils/logger';
import { commands } from '../commands';
import { config } from '../config';

export default function ready(client: Client) {
    client.once(Events.ClientReady, async (c) => {
        logger.info(`Ready! Logged in as ${c.user.tag}`);

        // Automatically deploy / register slash commands with Discord
        try {
            const rest = new REST({ version: '10' }).setToken(config.discordToken);
            const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

            if (config.guildId) {
                await rest.put(
                    Routes.applicationGuildCommands(config.discordClientId, config.guildId),
                    { body: commandData }
                );
                logger.info(`[Slash Commands] Deployed ${commandData.length} commands to guild: ${config.guildId}`);
            } else {
                await rest.put(
                    Routes.applicationCommands(config.discordClientId),
                    { body: commandData }
                );
                logger.info(`[Slash Commands] Deployed ${commandData.length} global commands.`);
            }
        } catch (err) {
            logger.error('[Slash Commands] Failed to deploy commands:', err);
        }

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
