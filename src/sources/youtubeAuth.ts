import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const CLIENT_ID = '864082046890-50d4i64vhhnd9gudbg3u5iip03gsq1h4.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export interface DeviceAuthInitResponse {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
}

export function getOAuthFilePath(): string {
    const paths = [
        path.join(__dirname, '../../data/youtube_oauth.json'),
        '/app/data/youtube_oauth.json',
        './data/youtube_oauth.json'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, '../../data/youtube_oauth.json');
}

export function isYouTubeAuthenticated(): boolean {
    const tokenPath = getOAuthFilePath();
    const cookiePath = path.join(path.dirname(tokenPath), 'cookies.txt');
    return fs.existsSync(tokenPath) || fs.existsSync(cookiePath);
}

export async function initYouTubeDeviceAuth(): Promise<DeviceAuthInitResponse> {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        scope: SCOPE
    });

    const res = await fetch('https://oauth2.googleapis.com/device/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    if (!res.ok) {
        const text = await res.text();
        logger.error('[YouTube Auth] Device code init failed:', text);
        throw new Error('Failed to start YouTube authentication with Google.');
    }

    return await res.json() as DeviceAuthInitResponse;
}

export async function pollYouTubeDeviceAuth(deviceCode: string): Promise<{ status: 'pending' | 'complete' | 'expired' | 'error'; tokens?: any }> {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const data = await res.json() as any;

    if (res.ok && data.access_token) {
        // Save tokens
        const filePath = getOAuthFilePath();
        const dataDir = path.dirname(filePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.info('[YouTube Auth] Successfully authenticated YouTube account! Token saved.');
        return { status: 'complete', tokens: data };
    }

    if (data.error === 'authorization_pending') {
        return { status: 'pending' };
    }

    if (data.error === 'slow_down') {
        return { status: 'pending' };
    }

    if (data.error === 'expired_token') {
        return { status: 'expired' };
    }

    logger.error('[YouTube Auth] Poll error response:', data);
    return { status: 'error' };
}
