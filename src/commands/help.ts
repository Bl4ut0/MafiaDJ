import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all commands and your permissions'),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const role = PermissionManager.getUserRole(member);

        const roleEmoji = role === UserRole.Admin ? '👑' : role === UserRole.DJ ? '🎧' : '👤';
        const roleName = role === UserRole.Admin ? 'Admin' : role === UserRole.DJ ? 'DJ' : 'User';

        const embed = new EmbedBuilder()
            .setColor('#7C3AED')
            .setTitle('🎵 MafiaDJ — Help')
            .setDescription(`Your role: ${roleEmoji} **${roleName}**`)
            .addFields(
                {
                    name: '🎶 Playback',
                    value: [
                        '`/play <url>` — Play a song or playlist (YouTube, Spotify, SoundCloud)',
                        '`/search <query>` — Search YouTube and pick from results',
                        '`/np` — Show what\'s currently playing',
                        '`/queue` — View the queue',
                        '`/skip` — Skip current track',
                        '`/pause` — Pause/resume playback',
                        '`/stop` — Stop all playback and disconnect',
                    ].join('\n')
                },
                {
                    name: '📚 Library',
                    value: [
                        '`/library` — Open your music library in DMs',
                        '`/favorites play` — Queue all your favorites',
                        '`/favorites shuffle` — Queue favorites shuffled',
                    ].join('\n')
                },
                {
                    name: '⚙️ Settings' + (role !== UserRole.User ? '' : ' *(Admin/DJ only)*'),
                    value: [
                        '`/setup` — Set up the music controller in a channel',
                        '`/dj role <role>` — Set the DJ role',
                        '`/dj reset` — Reset DJ role config',
                        '`/dj purge` — Refresh the controller message',
                        '`/settings view` — View current settings',
                        '`/settings votevalues <n>` — Set vote threshold',
                    ].join('\n')
                },
                {
                    name: '🎮 Controller Buttons',
                    value: [
                        '⏮ **Prev** — Play previous track',
                        '⏸ **Pause/Resume** — Toggle playback',
                        '⏭ **Skip** — Skip to next track',
                        '❤️ **Like** — Add to favorites',
                        '🔁 **Loop** — Cycle: Off → Track → Queue',
                        '🔀 **Shuffle** — Shuffle the queue',
                        '🔊🔉 **Volume** — Adjust volume *(DJ only)*',
                        '⭐ **Favorites** — Open library DM',
                        '⏹ **End Session** — Stop and disconnect',
                    ].join('\n')
                }
            )
            .setFooter({ text: 'MafiaDJ • Use /setup to create a controller' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
