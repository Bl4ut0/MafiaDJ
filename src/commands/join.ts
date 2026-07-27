import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import PlayerManager from '../player/PlayerManager';

export const command = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Summon the bot to your voice channel'),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: '❌ You need to be in a voice channel to summon the bot!', ephemeral: true });
            return;
        }

        const player = PlayerManager.getPlayer(interaction.guildId!);

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
            });

            player.connection = connection;
            connection.subscribe(player.audioPlayer);

            await interaction.reply(`✅ Joined **${voiceChannel.name}**!`);
        } catch (error) {
            console.error(error);
            await interaction.reply('❌ Failed to join the voice channel.');
        }
    },
};
