import fs from 'fs';
import path from 'path';

export function getYtDlpBaseArgs(): string[] {
    const args: string[] = [
        '--extractor-args', 'youtube:player_client=android,web_embedded,mweb,tv_embedded',
        '--no-check-certificates',
        '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ];

    // Check for youtube_oauth.json
    const oauthPaths = [
        path.join(__dirname, '../../data/youtube_oauth.json'),
        '/app/data/youtube_oauth.json',
        './data/youtube_oauth.json',
        './youtube_oauth.json'
    ];

    for (const p of oauthPaths) {
        if (fs.existsSync(p)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(p, 'utf-8'));
                if (tokenData.access_token) {
                    args.push('--add-header', `Authorization: Bearer ${tokenData.access_token}`);
                    break;
                }
            } catch {}
        }
    }

    // Check for cookies.txt in /app/data or data directory
    const cookiePaths = [
        path.join(__dirname, '../../data/cookies.txt'),
        '/app/data/cookies.txt',
        './data/cookies.txt',
        './cookies.txt'
    ];

    for (const p of cookiePaths) {
        if (fs.existsSync(p)) {
            args.push('--cookies', p);
            break;
        }
    }

    return args;
}
