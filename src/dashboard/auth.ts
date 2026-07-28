import { Router, Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { getDashboardRole } from './roles';

export const authRouter = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const OAUTH_SCOPES = 'identify guilds.members.read';

// GET /auth/login — redirect to Discord OAuth2
authRouter.get('/login', (req: Request, res: Response) => {
    const state = crypto.randomBytes(32).toString('hex');
    (req.session as any).oauthState = state;
    const params = new URLSearchParams({
        client_id: config.discordClientId,
        redirect_uri: process.env.DASHBOARD_REDIRECT_URI || `http://localhost:${process.env.PORT || process.env.DASHBOARD_PORT || 3000}/auth/callback`,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        state,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// GET /auth/callback — exchange code, verify guild membership, store session
authRouter.get('/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const session = req.session as any;
    if (!code || !state || !session.oauthState || state !== session.oauthState) {
        return res.redirect('/auth/error?msg=Invalid+login+state');
    }
    delete session.oauthState;

    try {
        // 1. Exchange code for access token
        const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.discordClientId,
                client_secret: process.env.DISCORD_CLIENT_SECRET || '',
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.DASHBOARD_REDIRECT_URI || `http://localhost:${process.env.PORT || process.env.DASHBOARD_PORT || 3000}/auth/callback`,
            }),
        });

        if (!tokenRes.ok) {
            logger.warn('[Dashboard Auth] Token exchange failed:', await tokenRes.text());
            return res.redirect('/auth/error?msg=Token+exchange+failed');
        }

        const tokenData: any = await tokenRes.json();
        const accessToken: string = tokenData.access_token;

        // 2. Get user info
        const userRes = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userRes.ok) return res.redirect('/auth/error?msg=Failed+to+get+user+info');
        const user: any = await userRes.json();

        // 3. Check guild membership
        const memberRes = await fetch(`${DISCORD_API}/users/@me/guilds/${config.guildId}/member`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!memberRes.ok) {
            // Not a member of the guild
            return res.redirect('/auth/not-member');
        }
        const member: any = await memberRes.json();

        // 4. Resolve permissions from the connected bot's guild member object.
        // OAuth's Guild Member response does not contain computed permissions.
        const role = await getDashboardRole(user.id);

        // 5. Store in session
        session.userId = user.id;
        session.username = user.username;
        session.discriminator = user.discriminator;
        session.avatar = user.avatar;
        session.role = role;
        session.lastRoleCheck = Date.now();

        logger.info(`[Dashboard] Login: ${user.username} (${user.id}) role=${role}`);
        res.redirect('/');

    } catch (err) {
        logger.error('[Dashboard Auth] Callback error:', err);
        res.redirect('/auth/error?msg=Internal+error');
    }
});

// GET /auth/logout
authRouter.get('/logout', (req: Request, res: Response) => {
    req.session.destroy(() => res.redirect('/'));
});

// GET /auth/not-member — shown when user is not in the guild
authRouter.get('/not-member', (_req: Request, res: Response) => {
    res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MafiaDJ — Access Denied</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d0d14; color: #fff; font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a2e; border-radius: 16px; padding: 48px; text-align: center; max-width: 420px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #9999bb; line-height: 1.6; margin-bottom: 24px; }
    a { display: inline-block; background: #7C3AED; color: #fff; text-decoration: none;
        padding: 12px 24px; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>Access Denied</h1>
    <p>This MafiaDJ instance is private.<br>You need to be a member of its Discord server to access it.</p>
    <a href="/auth/logout">Back to Login</a>
  </div>
</body>
</html>`);
});

// GET /auth/error
authRouter.get('/error', (req: Request, res: Response) => {
    const msg = (req.query.msg as string) ?? 'An error occurred during login.';
    res.status(500).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MafiaDJ — Login Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d0d14; color: #fff; font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a2e; border-radius: 16px; padding: 48px; text-align: center; max-width: 420px; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #F43F5E; }
    p { color: #9999bb; margin-bottom: 24px; }
    a { display: inline-block; background: #7C3AED; color: #fff; text-decoration: none;
        padding: 12px 24px; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Login Error</h1>
    <p>${msg.replace(/</g, '&lt;')}</p>
    <a href="/auth/login">Try Again</a>
  </div>
</body>
</html>`);
});
