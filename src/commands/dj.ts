import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role } from 'discord.js';
import ServerSettings from '../database/ServerSettings';

export const command = {
    data: new SlashCommandBuilder()
        .setName('dj')
        .setDescription('Manage DJ settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('role')
                .setDescription('Set the DJ role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to grant DJ permissions')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset DJ role configuration')),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'role') {
            const role = interaction.options.getRole('role') as Role;
            ServerSettings.updateSetting(interaction.guildId, 'dj_role_id', role.id);
            await interaction.reply(`✅ DJ Role set to **${role.name}**.`);
        } else if (subcommand === 'reset') {
            ServerSettings.updateSetting(interaction.guildId, 'dj_role_id', null);
            await interaction.reply('✅ DJ Role configuration reset. Only Admins have overridden permissions now.');
        }
    }
};
