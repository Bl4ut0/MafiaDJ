import fs from 'fs';
import path from 'path';

export function getYtDlpBaseArgs(): string[] {
    const args: string[] = [
        '--extractor-args', 'youtube:player_client=ios,mweb,web',
        '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ];

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
