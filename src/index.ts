import client from './bot/client';
import { config } from './config';
import { initDatabase } from './database/Database';
import { Events } from 'discord.js';
import { loadCommands } from './commands';
import { handleInteraction } from './events/interactionCreate';
import { logger } from './utils/logger';
import { startDashboard } from './dashboard/server';
import { handleMessage } from './events/messageHandler';
import { handleVoiceStateUpdate } from './events/voiceStateHandler';
import { startPlayerHealthCheck } from './events/playerHealthCheck';
import ready from './events/ready';
import { checkYtDlpHealth } from './utils/ytdlp';

async function main() {
    try {
        logger.info('Starting MafiaDJ...');

        // Initialize Database
        initDatabase();

        // Load Commands
        await loadCommands();

        // Verify the server-side YouTube provider/plugin path before accepting requests.
        await checkYtDlpHealth();

        // Register Events
        client.on(Events.InteractionCreate, handleInteraction);
        client.on(Events.MessageCreate, handleMessage);
        client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);
        client.once(Events.ClientReady, () => {
            startDashboard();
            startPlayerHealthCheck();
        });

        // Ready event
        ready(client);

        // Global Error Handling
        process.on('unhandledRejection', (error) => {
            logger.error('Unhandled promise rejection:');
            logger.error(error);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:');
            logger.error(error);
        });

        // Graceful Shutdown Signals
        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM. Shutting down gracefully...');
            client.destroy();
            process.exit(0);
        });

        process.on('SIGINT', () => {
            logger.info('Received SIGINT. Shutting down gracefully...');
            client.destroy();
            process.exit(0);
        });

        // Login to Discord
        await client.login(config.discordToken);

    } catch (error) {
        logger.fatal({ err: error }, 'Fatal error during startup');
        process.exit(1);
    }
}

main();
