import { Request, Response, NextFunction } from 'express';
import { DashboardRole, getDashboardRole } from './roles';

const ROLE_REVALIDATION_MS = 5 * 60 * 1000;

async function refreshRole(req: Request): Promise<DashboardRole> {
    const session = req.session as any;
    const now = Date.now();
    if (session.lastRoleCheck && now - session.lastRoleCheck < ROLE_REVALIDATION_MS) {
        return session.role;
    }

    const role = await getDashboardRole(session.userId);
    session.role = role;
    session.lastRoleCheck = now;
    return role;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

export async function requireDJ(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const role = await refreshRole(req);
        if (role !== 'dj' && role !== 'admin') {
            return res.status(403).json({ error: 'DJ or Admin role required' });
        }
        next();
    } catch {
        return res.status(503).json({ error: 'Unable to verify Discord permissions. Please try again.' });
    }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const role = await refreshRole(req);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Admin role required' });
        }
        next();
    } catch {
        return res.status(503).json({ error: 'Unable to verify Discord permissions. Please try again.' });
    }
}

// Extend express-session types
declare module 'express-session' {
    interface SessionData {
        userId: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        role: 'admin' | 'dj' | 'everyone';
        lastRoleCheck: number;
    }
}
