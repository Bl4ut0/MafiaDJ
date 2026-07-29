const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mafiadj-cookie-test-'));
process.env.YOUTUBE_COOKIES_PATH = path.join(tempDir, 'cookies.txt');
const auth = require('../dist/sources/youtubeAuth');

test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('cookie upload requires Netscape format and a YouTube cookie', () => {
    assert.equal(auth.saveYouTubeCookies('not a cookie file'), false);
    assert.equal(
        auth.saveYouTubeCookies('# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tTRUE\t0\tSID\tvalue'),
        false
    );
});

test('cookie upload filters unrelated domains before writing', () => {
    const content = [
        '# Netscape HTTP Cookie File',
        '.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tyoutube-value',
        '.google.com\tTRUE\t/\tTRUE\t0\tHSID\tgoogle-value',
        '.evil.example\tTRUE\t/\tTRUE\t0\tSTEAL\tshould-not-survive',
    ].join('\n');

    assert.equal(auth.saveYouTubeCookies(content), true);
    const stored = fs.readFileSync(process.env.YOUTUBE_COOKIES_PATH, 'utf8');
    assert.match(stored, /\.youtube\.com/);
    assert.match(stored, /\.google\.com/);
    assert.doesNotMatch(stored, /evil\.example|should-not-survive/);
    assert.equal(auth.isYouTubeAuthenticated(), true);
});
