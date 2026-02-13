import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config';
import path from 'path';
import fs from 'fs';

// Define the extended client interface to include commands
export interface ExtendedClient extends Client {
    commands: Collection<string, any>;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Optional, for member display
    ]
}) as ExtendedClient;

client.commands = new Collection();

// Command loading logic would go here
// ...

client.login(config.discordToken).catch(err => {
    console.error('Failed to login:', err);
});

export default client;
