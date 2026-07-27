
import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
    console.error('❌ Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in your .env file.');
    process.exit(1);
}

const spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: clientSecret,
    redirectUri: 'http://127.0.0.1:8888/callback' // Using explicit IPv4 loopback (allowed over HTTP)
});

const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'user-read-email',
    'user-read-private'
];

const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'state');

console.log('\n🎵 Spotify "Remote Control" Authorization 🎵');
console.log('==============================================');
console.log('To allow MafiaDJ to control playback, you need to authorize it via the Web API.');
console.log('1. Click the link below (or copy-paste it into your browser).');
console.log('2. Log in with your Premium Spotify account.');
console.log('3. After redirecting to "localhost", copy the "code" parameter from the URL bar.');
console.log('   (e.g., http://localhost:8888/callback?code=AQCd...&state=state)');
console.log('\n🔗 Authorization URL:\n');
console.log(authorizeURL);
console.log('\n==============================================');

import http from 'http';
import fs from 'fs';
import path from 'path';

// Create a local server to capture the code automatically
const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');

        if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authorization Successful!</h1><p>You can close this window and check your terminal.</p>');

            console.log('\n✅ Authorization Code received automatically!');
            server.close(); // Stop server

            // Exchange code for token
            spotifyApi.authorizationCodeGrant(code)
                .then(data => {
                    const refreshToken = data.body['refresh_token'];
                    console.log('\n✅ Refresh Token retrieved successfully.');

                    // Automatically update .env
                    const envPath = path.join(__dirname, '../.env');
                    if (fs.existsSync(envPath)) {
                        let envContent = fs.readFileSync(envPath, 'utf8');
                        if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
                            envContent = envContent.replace(/SPOTIFY_REFRESH_TOKEN=.*/, `SPOTIFY_REFRESH_TOKEN=${refreshToken}`);
                        } else {
                            envContent += `\nSPOTIFY_REFRESH_TOKEN=${refreshToken}\n`;
                        }
                        fs.writeFileSync(envPath, envContent);
                        console.log('📝 Automatically updated your .env file with the new token.');
                    } else {
                        console.log('\n⚠️  Could not find .env file to update automatically.');
                        console.log(`SPOTIFY_REFRESH_TOKEN=${refreshToken}`);
                    }

                    console.log('\n🚀 Please run .\\scripts\\build-windows.ps1 to update the release folder.');
                    process.exit(0);
                })
                .catch(err => {
                    console.error('\n❌ Authorization failed:', err.message);
                    process.exit(1);
                });

        } else {
            res.writeHead(400);
            res.end('No code found.');
        }
    }
});

server.listen(8888, '127.0.0.1', () => {
    console.log(`\n👂 Waiting for callback on http://127.0.0.1:8888/callback ...`);
    console.log('Use this URL to authorize:');
    console.log(authorizeURL);
});
