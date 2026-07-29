import express from 'express';
import session from 'express-session';
import { createServer, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { authRouter } from './auth';
import { apiRouter } from './api';
import { buildState } from './state';
import PlayerManager from '../player/PlayerManager';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SqliteSessionStore } from './SqliteSessionStore';
import { requireCsrf } from './middleware';
import { getDashboardRole } from './roles';

import fs from 'fs';

// Safely locate static public directory
let publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
    publicDir = path.join(__dirname, '../../src/dashboard/public');
}

const PORT = parseInt(process.env.PORT || process.env.DASHBOARD_PORT || '3000');
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';

let wss: WebSocketServer;

/** Broadcast current player state to all connected WebSocket clients */
function broadcast() {
    if (!wss) return;
    try {
        const payload = JSON.stringify({ type: 'stateUpdate', data: buildState() });
        for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    } catch (err) {
        logger.warn('[Dashboard WS] Broadcast error:', err);
    }
}

/** Broadcast a custom event to all connected WebSocket clients */
export function broadcastEvent(eventData: any) {
    if (!wss) return;
    try {
        const payload = JSON.stringify(eventData);
        for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    } catch (err) {
        logger.warn('[Dashboard WS] Broadcast event error:', err);
    }
}

/** Subscribe to player events so dashboard stays in sync */
function subscribeToPlayer() {
    const player = PlayerManager.getPlayer(config.guildId);
    const events = ['stateChange', 'trackStart', 'queueEnd', 'autoDisconnect'];
    events.forEach(evt => player.on(evt, broadcast));
    logger.info('[Dashboard] Subscribed to player events for WebSocket broadcast.');
}

export function startDashboard() {
    if (process.env.DASHBOARD_ENABLED !== 'true') {
        logger.info('[Dashboard] Disabled (DASHBOARD_ENABLED != true). Skipping.');
        return;
    }

    const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
        logger.error('[Dashboard] DASHBOARD_SESSION_SECRET must be set to at least 32 characters. Dashboard disabled.');
        return;
    }

    const app = express();
    const server = createServer(app);
    const secureCookies = process.env.DASHBOARD_COOKIE_SECURE === 'true';
    const isLoopback = HOST === '127.0.0.1' || HOST === '::1' || HOST === 'localhost';
    const allowInsecureHttp = process.env.DASHBOARD_ALLOW_INSECURE_HTTP === 'true';

    if (!isLoopback && !secureCookies && !allowInsecureHttp) {
        logger.error('[Dashboard] Refusing a non-loopback listener without secure cookies or an explicit local-only HTTP override.');
        return;
    }
    if (!secureCookies && allowInsecureHttp) {
        logger.warn('[Dashboard] Insecure HTTP override enabled. Keep the published port bound to host loopback only.');
    }

    if (process.env.DASHBOARD_TRUST_PROXY === 'true') {
        app.set('trust proxy', 1);
    }

    const sessionMiddleware = session({
        name: 'mafiadj.sid',
        secret: sessionSecret,
        store: new SqliteSessionStore(),
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: secureCookies,
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        },
    });

    // Middleware
    app.use(sessionMiddleware);
    app.use(express.json({ limit: '256kb' }));
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://discord.com; img-src 'self' https: data:; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
        );
        next();
    });
    app.use(requireCsrf);

    // Static files (public folder)
    app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
    app.use(express.static(publicDir));

    // Routes
    app.use('/auth', authRouter);
    app.use('/api', apiRouter);

    // Fallback: serve index.html for SPA
    app.get(/.*/, (_req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    // WebSocket server — attached to the HTTP server
    wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        if (request.url !== '/ws') {
            socket.destroy();
            return;
        }

        const origin = request.headers.origin;
        let originIsValid = false;
        try {
            originIsValid = !!origin && new URL(origin).host === request.headers.host;
        } catch {
            originIsValid = false;
        }
        if (!originIsValid) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
        }

        const sessionResponse = new ServerResponse(request);
        sessionMiddleware(request as any, sessionResponse as any, async (err) => {
            if (err || !(request as any).session?.userId) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            try {
                const currentSession = (request as any).session;
                currentSession.role = await getDashboardRole(currentSession.userId);
                currentSession.lastRoleCheck = Date.now();
            } catch {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(request, socket, head, ws => {
                wss.emit('connection', ws, request);
            });
        });
    });

    wss.on('connection', (ws) => {
        // Send current state immediately on connect
        try {
            ws.send(JSON.stringify({ type: 'stateUpdate', data: buildState() }));
        } catch { /* ignore */ }

        ws.on('error', (err) => logger.warn('[Dashboard WS] Client error:', err));
    });

    // Subscribe to player events
    subscribeToPlayer();

    server.listen(PORT, HOST, () => {
        logger.info(`[Dashboard] Running at http://${HOST}:${PORT}`);
    });

    server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`[Dashboard] Port ${PORT} already in use. Dashboard will not start.`);
        } else {
            logger.error('[Dashboard] Server error:', err);
        }
    });
}
