import { Client, GatewayIntentBits, Collection } from 'discord.js';

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

export default client;
