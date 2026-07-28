import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export function getCookiesFilePath(): string {
    return path.resolve(process.env.YOUTUBE_COOKIES_PATH || path.join(process.cwd(), 'data', 'cookies.txt'));
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

        const lines = content.split(/\r?\n/);
        const hasYouTubeCookie = lines.some(line => {
            const columns = line.split('\t');
            return columns.length >= 7 && /(^|\.)youtube\.com$/i.test(columns[0]);
        });
        if (!hasYouTubeCookie) {
            logger.warn('[YouTube Cookies] Rejected invalid or non-YouTube cookie file.');
            return false;
        }

        const filePath = getCookiesFilePath();
        const dataDir = path.dirname(filePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const temporaryPath = `${filePath}.tmp`;
        fs.writeFileSync(temporaryPath, content.trim(), { encoding: 'utf-8', mode: 0o600 });
        fs.renameSync(temporaryPath, filePath);
        fs.chmodSync(filePath, 0o600);
        logger.info('[YouTube Auth] Saved cookies.txt successfully!');
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
