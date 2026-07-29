import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export function getCookiesFilePath(): string {
    return path.resolve(process.env.YOUTUBE_COOKIES_PATH || path.join(process.cwd(), 'data', 'cookies.txt'));
}

/**
 * The browser profile is deliberately constrained to the instance data
 * directory. This prevents an environment typo from making yt-dlp inspect an
 * arbitrary Chromium profile or the host's credential store.
 */
export function getYouTubeBrowserProfilePath(): string | null {
    const configuredPath = process.env.YOUTUBE_BROWSER_PROFILE?.trim();
    if (!configuredPath) return null;

    const dataDirectory = path.resolve(process.cwd(), 'data');
    const profilePath = path.resolve(configuredPath);
    if (profilePath !== dataDirectory && !profilePath.startsWith(`${dataDirectory}${path.sep}`)) {
        logger.warn('[YouTube Browser] Ignoring profile path outside the instance data directory.');
        return null;
    }
    return profilePath;
}

export function isYouTubeBrowserProfileAvailable(): boolean {
    const profilePath = getYouTubeBrowserProfilePath();
    return Boolean(profilePath && fs.existsSync(path.join(profilePath, 'Default', 'Cookies')));
}

/**
 * A remote desktop is a separate security boundary. Do not present its URL
 * until the administrator has placed it behind Cloudflare Access (or an
 * equivalent identity-aware gateway) and explicitly acknowledged that fact.
 */
export function getYouTubeBrowserLaunchUrl(): string | null {
    if (process.env.YOUTUBE_BROWSER_ACCESS_PROTECTED !== 'true') return null;

    const value = process.env.YOUTUBE_BROWSER_URL?.trim();
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
            return null;
        }
        return url.href;
    } catch {
        return null;
    }
}

export function isYouTubeAuthenticated(): boolean {
    const cookiePath = getCookiesFilePath();
    if (!fs.existsSync(cookiePath)) return false;
    try {
        const stats = fs.statSync(cookiePath);
        return stats.size > 10;
    } catch {
        return false;
    }
}

export function saveYouTubeCookies(content: string): boolean {
    try {
        if (Buffer.byteLength(content, 'utf8') > 256 * 1024) {
            logger.warn('[YouTube Cookies] Rejected file larger than 256 KiB.');
            return false;
        }

        if (content.includes('\0') || !/^# Netscape HTTP Cookie File/im.test(content)) {
            logger.warn('[YouTube Cookies] Rejected a non-Netscape cookie file.');
            return false;
        }

        const allowedDomain = /(^|\.)(youtube\.com|google\.com|googlevideo\.com)$/i;
        let hasYouTubeCookie = false;
        const sanitizedLines = ['# Netscape HTTP Cookie File'];
        for (const rawLine of content.split(/\r?\n/)) {
            const httpOnly = rawLine.startsWith('#HttpOnly_');
            if (!rawLine || (rawLine.startsWith('#') && !httpOnly)) continue;
            const line = httpOnly ? rawLine.slice('#HttpOnly_'.length) : rawLine;
            const columns = line.split('\t');
            if (columns.length !== 7) continue;
            const [domain, includeSubdomains, cookiePath, secure, expires, name] = columns;
            if (!allowedDomain.test(domain)
                || !['TRUE', 'FALSE'].includes(includeSubdomains.toUpperCase())
                || !cookiePath.startsWith('/')
                || !['TRUE', 'FALSE'].includes(secure.toUpperCase())
                || !/^\d+$/.test(expires)
                || !name) {
                continue;
            }
            if (/(^|\.)youtube\.com$/i.test(domain)) hasYouTubeCookie = true;
            sanitizedLines.push(`${httpOnly ? '#HttpOnly_' : ''}${columns.join('\t')}`);
        }

        if (!hasYouTubeCookie) {
            logger.warn('[YouTube Cookies] Rejected invalid or non-YouTube cookie file.');
            return false;
        }

        const filePath = getCookiesFilePath();
        const dataDir = path.dirname(filePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const temporaryPath = `${filePath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
        fs.writeFileSync(temporaryPath, `${sanitizedLines.join('\n')}\n`, { encoding: 'utf-8', mode: 0o600 });
        fs.renameSync(temporaryPath, filePath);
        fs.chmodSync(filePath, 0o600);
        logger.info('[YouTube Auth] Saved a filtered cookies.txt file.');
        return true;
    } catch (err) {
        logger.error('[YouTube Auth] Failed to save cookies:', err);
        return false;
    }
}

export function deleteYouTubeCookies(): boolean {
    try {
        const filePath = getCookiesFilePath();
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return true;
    } catch (err) {
        logger.error('[YouTube Auth] Failed to delete cookies:', err);
        return false;
    }
}
