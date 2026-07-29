const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test-client';
process.env.GUILD_ID = process.env.GUILD_ID || 'test-guild';

const ytdlp = require('../dist/utils/ytdlp');

test('yt-dlp enables the bundled Node challenge runtime', () => {
    const args = ytdlp.getYtDlpBaseArgs();
    const runtimeIndex = args.indexOf('--js-runtimes');

    assert.notEqual(runtimeIndex, -1);
    assert.equal(args[runtimeIndex + 1], 'node');
});

test('yt-dlp configures the bgutil HTTP provider when supplied', () => {
    const previous = process.env.YOUTUBE_POT_PROVIDER_URL;
    process.env.YOUTUBE_POT_PROVIDER_URL = 'http://pot-provider:4416';

    try {
        const args = ytdlp.getYtDlpBaseArgs();
        assert.ok(args.includes('youtube:player_client=mweb'));
        assert.ok(args.includes('youtubepot-bgutilhttp:base_url=http://pot-provider:4416'));
    } finally {
        if (previous === undefined) delete process.env.YOUTUBE_POT_PROVIDER_URL;
        else process.env.YOUTUBE_POT_PROVIDER_URL = previous;
    }
});

test('yt-dlp uses only an instance data-directory Chromium profile', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const previous = process.env.YOUTUBE_BROWSER_PROFILE;
    const originalCwd = process.cwd();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'mafiadj-browser-profile-'));
    const profile = path.join(workspace, 'data', 'youtube-browser', '.config', 'chromium');
    fs.mkdirSync(path.join(profile, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(profile, 'Default', 'Cookies'), 'test');

    try {
        process.chdir(workspace);
        process.env.YOUTUBE_BROWSER_PROFILE = 'data/youtube-browser/.config/chromium';
        const args = ytdlp.getYtDlpBaseArgs();
        const cookieIndex = args.indexOf('--cookies-from-browser');
        assert.notEqual(cookieIndex, -1);
        assert.equal(args[cookieIndex + 1], `chromium:${profile}`);
    } finally {
        process.chdir(originalCwd);
        if (previous === undefined) delete process.env.YOUTUBE_BROWSER_PROFILE;
        else process.env.YOUTUBE_BROWSER_PROFILE = previous;
        fs.rmSync(workspace, { recursive: true, force: true });
    }
});
