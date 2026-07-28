import fs from 'fs';
import { getCookiesFilePath, isYouTubeAuthenticated } from '../sources/youtubeAuth';

export function getYtDlpBaseArgs(): string[] {
    const args: string[] = [
        '--extractor-args', 'youtube:player_client=android,web_embedded,mweb,tv_embedded',
        '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ];

    // A cookie file is optional and instance-owned. Never disable TLS
    // verification when using it; it is a sensitive account credential.
    if (isYouTubeAuthenticated()) {
        const cookiePath = getCookiesFilePath();
        if (fs.existsSync(cookiePath)) args.push('--cookies', cookiePath);
    }

    return args;
}
