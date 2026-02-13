import client from './bot/client';
import { config } from './config';
import { initDatabase } from './database/Database';
import { Events } from 'discord.js';
import { loadCommands } from './commands';
import { handleInteraction } from './events/interactionCreate';
import { logger } from './utils/logger';

async function main() {
    try {
        logger.info('Starting MafiaDJ...');

        // Initialize Database
        initDatabase();

        // Load Commands
        await loadCommands();

        // Register Events
        client.on(Events.InteractionCreate, handleInteraction);

        // Ready event
        import('./events/ready').then(module => module.default(client));

        // Global Error Handling
        process.on('unhandledRejection', (error) => {
            logger.error('Unhandled promise rejection:');
            logger.error(error);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:');
            logger.error(error);
        });

        // Login to Discord
        await client.login(config.discordToken);

    } catch (error) {
        logger.fatal('Fatal error during startup:', error);
        process.exit(1);
    }
}

main();
