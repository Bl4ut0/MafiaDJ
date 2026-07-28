import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export function getCookiesFilePath(): string {
    const paths = [
        path.join(__dirname, '../../data/cookies.txt'),
        '/app/data/cookies.txt',
        './data/cookies.txt'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, '../../data/cookies.txt');
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
        const filePath = getCookiesFilePath();
        const dataDir = path.dirname(filePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(filePath, content.trim(), 'utf-8');
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
