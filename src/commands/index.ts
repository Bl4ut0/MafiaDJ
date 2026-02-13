import { Collection } from 'discord.js';
import { Command } from '../types';
import fs from 'fs';
import path from 'path';

// Create a collection to hold commands
export const commands = new Collection<string, Command>();

export async function loadCommands() {
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') && file !== 'index.ts');

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        // Dynamic import
        const commandModule = await import(filePath);
        // Access default export or named export 'command'
        const command = commandModule.default || commandModule.command;

        if (command && 'data' in command && 'execute' in command) {
            commands.set(command.data.name, command);
            console.log(`[INFO] Loaded command ${command.data.name}`);
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}
