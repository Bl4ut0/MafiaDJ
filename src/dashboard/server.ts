import express from 'express';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { authRouter } from './auth';
import { apiRouter } from './api';
import { buildState } from './state';
import PlayerManager from '../player/PlayerManager';
import { config } from '../config';
import { logger } from '../utils/logger';

// pkg-safe path to the public folder
const isPkg = (process as any).pkg;
const publicDir = isPkg
    ? path.join(__dirname, '../../src/dashboard/public')   // virtual snapshot path
    : path.join(__dirname, 'public');

const PORT = parseInt(process.env.PORT || process.env.DASHBOARD_PORT || '3000');
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || 'mafiadj-change-me';

const sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,  // set true behind HTTPS proxy in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
});

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

    const app = express();
    const server = createServer(app);

    // Middleware
    app.use(sessionMiddleware);
    app.use(express.json());

    // Static files (public folder)
    app.use(express.static(publicDir));

    // Routes
    app.use('/auth', authRouter);
    app.use('/api', apiRouter);

    // Fallback: serve index.html for SPA
    app.get(/.*/, (_req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    // WebSocket server — attached to the HTTP server
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
        // Send current state immediately on connect
        try {
            ws.send(JSON.stringify({ type: 'stateUpdate', data: buildState() }));
        } catch { /* ignore */ }

        ws.on('error', (err) => logger.warn('[Dashboard WS] Client error:', err));
    });

    // Subscribe to player events
    subscribeToPlayer();

    server.listen(PORT, () => {
        logger.info(`[Dashboard] Running at http://localhost:${PORT}`);
    });

    server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`[Dashboard] Port ${PORT} already in use. Dashboard will not start.`);
        } else {
            logger.error('[Dashboard] Server error:', err);
        }
    });
}
