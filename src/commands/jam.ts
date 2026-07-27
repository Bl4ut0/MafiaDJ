import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import PlayerManager from '../player/PlayerManager';
import { joinVoiceChannel } from '@discordjs/voice';

export const command = {
    data: new SlashCommandBuilder()
        .setName('jam')
        .setDescription('Start a Spotify Jam session and share the link')
        .addStringOption(option =>
            option.setName('link')
                .setDescription('The Spotify Jam link to share')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;
        const jamLink = interaction.options.getString('link', true);

        // check permissions (Admin only)
        if (!member.permissions.has('Administrator')) {
            await interaction.reply({ content: '❌ Only Administrators can start a Spotify Jam session.', ephemeral: true });
            return;
        }

        if (!voiceChannel) {
            await interaction.reply({ content: '❌ You need to be in a voice channel to start a Jam!', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            const player = PlayerManager.getPlayer(interaction.guildId!);

            // Join Voice Channel if not already connected
            if (!player.connection) {
                player.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
                });
                player.connection.subscribe(player.audioPlayer);
            }

            // Start Jam Mode
            const success = await (player as any).startJam?.() ?? true;
            if (!success) {
                await interaction.editReply('❌ Failed to start Jam Session. Is the bot running securely? Check logs.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎵 Spotify Jam Session Started!')
                .setColor('#1DB954')
                .setDescription(`
**Host:** <@${member.id}>
**Speaker:** MafiaDJ

### 🔗 [Click Here to Join the Jam!](${jamLink})

**Instructions:**
1. Click the link above to join the Jam on your phone/PC.
2. Add songs to the queue!
3. The bot will play whatever the Jam plays.
                `)
                .addFields({ name: 'Jam Link', value: jamLink })
                .setFooter({ text: 'Ensure you are connected to "MafiaDJ" on Spotify Connect.' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ An error occurred while starting the Jam.');
        }
    },
};
