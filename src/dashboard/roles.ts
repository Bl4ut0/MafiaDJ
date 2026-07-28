import client from '../bot/client';
import { config } from '../config';
import { PermissionManager, UserRole } from '../permissions/PermissionManager';

export type DashboardRole = 'admin' | 'dj' | 'everyone';

/** Resolve the role from the bot's current guild view, not an OAuth payload. */
export async function getDashboardRole(userId: string): Promise<DashboardRole> {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
        throw new Error('Discord guild is not ready yet. Please try again shortly.');
    }

    const member = await guild.members.fetch(userId);
    switch (PermissionManager.getUserRole(member)) {
        case UserRole.Admin:
            return 'admin';
        case UserRole.DJ:
            return 'dj';
        default:
            return 'everyone';
    }
}
