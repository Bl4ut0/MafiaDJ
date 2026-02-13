import { Events, Interaction } from 'discord.js';
import { commands } from '../commands';
import { handleButtonInteraction } from './buttonHandler';
import { ControllerMessage } from '../ui/ControllerMessage'; // Import locally if needed or reuse instance
import client from '../bot/client';
import { LibraryManager } from '../ui/library/LibraryManager';

export async function handleInteraction(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) { // Handle Select Menus too

        // Controller Interactions
        if (interaction.customId.startsWith('controller:')) {
            if (interaction.guildId && interaction.isButton()) {
                const controller = ControllerMessage.getInstance(client, interaction.guildId);
                await handleButtonInteraction(interaction, controller);
            }
        }
        // Library Interactions (DM)
        else if (interaction.customId.startsWith('lib:')) {
            if (interaction.isButton() || interaction.isStringSelectMenu()) { // Explicit check for TS
                await LibraryManager.handleInteraction(interaction);
            }
        }
    }
}
