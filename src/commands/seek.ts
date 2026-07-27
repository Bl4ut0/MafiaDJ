import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { PermissionManager } from '../permissions/PermissionManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a position in the current track')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time to seek to (e.g., 1:30, 90, 2:15)')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;

        if (!PermissionManager.canPerformAction(member, 'seek')) {
            await interaction.reply({ content: '🔒 Only DJs can use seek.', ephemeral: true });
            return;
        }

        const player = PlayerManager.getPlayer(interaction.guildId!);

        if (!player.currentTrack) {
            await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
            return;
        }

        const timeStr = interaction.options.getString('time', true);
        const seconds = parseTimeString(timeStr);

        if (seconds === null || seconds < 0) {
            await interaction.reply({ content: '❌ Invalid time format. Use `1:30`, `90`, or `2:15:00`.', ephemeral: true });
            return;
        }

        if (seconds > player.currentTrack.duration) {
            await interaction.reply({ content: '❌ Time exceeds track duration.', ephemeral: true });
            return;
        }

        // For yt-dlp streams, seeking requires restarting the stream from the position
        // This is a limitation — we acknowledge the seek but restart playback
        await interaction.reply({
            content: `⏩ Seek is not yet supported for live streams. This feature will work once stream-level seeking is implemented.`,
            ephemeral: true
        });
    }
};

/** Parse time string like "1:30", "90", "2:15:00" into seconds */
function parseTimeString(input: string): number | null {
    // Try pure number (seconds)
    if (/^\d+$/.test(input)) {
        return parseInt(input);
    }

    // Try M:SS or H:MM:SS
    const parts = input.split(':').map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return null;
}
