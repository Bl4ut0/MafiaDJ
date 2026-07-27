import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { Favorites } from '../database/Favorites';
import { joinVoiceChannel } from '@discordjs/voice';

export const command = {
    data: new SlashCommandBuilder()
        .setName('favorites')
        .setDescription('Play your favorite tracks')
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Queue all your favorites'))
        .addSubcommand(sub =>
            sub.setName('shuffle')
                .setDescription('Queue your favorites in random order')),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const favorites = Favorites.get(interaction.user.id, 200, 0);

        if (favorites.length === 0) {
            await interaction.editReply('You have no favorites yet. Click ❤️ on the controller to add some!');
            return;
        }

        const player = PlayerManager.getPlayer(interaction.guildId!);

        // Ensure voice connection
        if (!player.connection) {
            player.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
            });
            player.setConnection(player.connection);
            player.connection.subscribe(player.audioPlayer);
        }

        // Shuffle if requested
        let tracks = [...favorites];
        if (subcommand === 'shuffle') {
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
        }

        // Queue all favorites
        tracks.forEach(track => player.queue.enqueue(track));

        // Start playing if nothing is playing
        if (!player.currentTrack && !player.queue.isEmpty()) {
            player.playNext();
        }

        const emoji = subcommand === 'shuffle' ? '🔀' : '▶️';
        await interaction.editReply(`${emoji} Queued **${tracks.length}** favorites${subcommand === 'shuffle' ? ' (shuffled)' : ''}.`);
    }
};
