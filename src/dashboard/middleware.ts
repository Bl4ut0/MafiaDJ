import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

export function requireDJ(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const role = (req.session as any).role;
    if (role !== 'dj' && role !== 'admin') {
        return res.status(403).json({ error: 'DJ or Admin role required' });
    }
    next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const role = (req.session as any).role;
    if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required' });
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
        accessToken: string;
    }
}
