import session from 'express-session';
import db from '../database/Database';

export class SqliteSessionStore extends session.Store {
    private cleanupTimer: NodeJS.Timeout;

    constructor() {
        super();
        this.cleanupTimer = setInterval(() => this.cleanup(), 15 * 60 * 1000);
        this.cleanupTimer.unref();
    }

    get(sid: string, callback: (err: any, session?: session.SessionData | null) => void): void {
        try {
            const row = db.prepare(`
                SELECT session_json
                FROM dashboard_sessions
                WHERE sid = ? AND expires_at > ?
            `).get(sid, Date.now()) as { session_json: string } | undefined;
            callback(null, row ? JSON.parse(row.session_json) : null);
        } catch (error) {
            callback(error);
        }
    }

    set(sid: string, value: session.SessionData, callback?: (err?: any) => void): void {
        try {
            const expiresAt = value.cookie.expires?.getTime()
                ?? Date.now() + (value.cookie.maxAge ?? 24 * 60 * 60 * 1000);
            db.prepare(`
                INSERT INTO dashboard_sessions (sid, session_json, expires_at)
                VALUES (?, ?, ?)
                ON CONFLICT(sid) DO UPDATE SET
                    session_json = excluded.session_json,
                    expires_at = excluded.expires_at
            `).run(sid, JSON.stringify(value), expiresAt);
            callback?.();
        } catch (error) {
            callback?.(error);
        }
    }

    destroy(sid: string, callback?: (err?: any) => void): void {
        try {
            db.prepare('DELETE FROM dashboard_sessions WHERE sid = ?').run(sid);
            callback?.();
        } catch (error) {
            callback?.(error);
        }
    }

    touch(sid: string, value: session.SessionData, callback?: (err?: any) => void): void {
        this.set(sid, value, callback);
    }

    private cleanup(): void {
        try {
            db.prepare('DELETE FROM dashboard_sessions WHERE expires_at <= ?').run(Date.now());
        } catch {
            // A cleanup failure should not interrupt active sessions.
        }
    }
}
