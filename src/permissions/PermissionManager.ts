import { GuildMember, PermissionsBitField } from 'discord.js';
import ServerSettings from '../database/ServerSettings';

export enum UserRole {
    Admin = 'admin',
    DJ = 'dj',
    User = 'user'
}

export class PermissionManager {
    public static getUserRole(member: GuildMember): UserRole {
        // 1. Check for Admin permissions
        if (member.permissions.has(PermissionsBitField.Flags.Administrator) || member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return UserRole.Admin;
        }

        // 2. Check for DJ Role
        const settings = ServerSettings.getSettings(member.guild.id);
        if (settings.dj_role_id && member.roles.cache.has(settings.dj_role_id)) {
            return UserRole.DJ;
        }

        // 3. User is alone with bot? (Handled in VoteManager logic usually, but here role is just role)
        return UserRole.User;
    }

    public static canPerformAction(member: GuildMember, action: 'skip' | 'stop' | 'pause' | 'volume' | 'loop' | 'shuffle' | 'seek' | 'autoplay'): boolean {
        const role = this.getUserRole(member);

        // Admins and DJs can do everything
        if (role === UserRole.Admin || role === UserRole.DJ) return true;

        // Users restrictions
        switch (action) {
            case 'volume':
            case 'seek':
            case 'autoplay':
                return false; // DJ only
            default:
                return true; // Vote enabled actions (handled by VoteManager) or harmless
        }
    }
}
