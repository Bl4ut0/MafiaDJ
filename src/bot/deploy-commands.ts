import { REST, Routes } from 'discord.js';
import { config } from '../config';
import { loadCommands, commands } from '../commands';

async function deploy() {
    await loadCommands();

    const commandsData = commands.map(command => command.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    try {
        console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(config.discordClientId, config.guildId),
            { body: commandsData },
        );

        console.log(`Successfully reloaded application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}

deploy();
