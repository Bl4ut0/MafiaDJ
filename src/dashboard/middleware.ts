import { Request, Response, NextFunction } from 'express';
import { DashboardRole, getDashboardRole } from './roles';
import crypto from 'crypto';

const ROLE_REVALIDATION_MS = 60 * 1000;

export async function refreshRole(req: Request): Promise<DashboardRole> {
    const session = req.session as any;
    const now = Date.now();
    if (session.role && session.lastRoleCheck && now - session.lastRoleCheck < ROLE_REVALIDATION_MS) {
        return session.role;
    }

    const role = await getDashboardRole(session.userId);
    session.role = role;
    session.lastRoleCheck = now;
    return role;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        await refreshRole(req);
        next();
    } catch {
        req.session.destroy(() => undefined);
        return res.status(401).json({ error: 'Discord membership could not be verified. Please sign in again.' });
    }
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

export function ensureCsrfToken(req: Request): string {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
    }
    return req.session.csrfToken;
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.session?.userId) {
        return next();
    }

    const expected = Buffer.from(ensureCsrfToken(req));
    const supplied = Buffer.from(req.get('X-CSRF-Token') ?? '');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
        return res.status(403).json({ error: 'Invalid request token. Refresh the page and try again.' });
    }
    next();
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
        csrfToken: string;
        oauthState: string;
    }
}
