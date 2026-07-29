# MafiaDJ

MafiaDJ is a self-hosted Discord music bot with a persistent controller, a
Discord-authenticated web dashboard, YouTube playback, Spotify catalog search,
and per-user favorites, history, and playlists.

## Playback Model

- YouTube is the default audio source.
- Spotify client credentials enable Spotify catalog and link metadata.
- Spotify links resolve their metadata through Spotify and play a matching
  YouTube result.
- Owner Spotify Sync is optional, disabled by default, and admin-only. It reads
  the instance owner's current Spotify playback/autoplay state and follows it
  using YouTube audio fallback.
- Direct Spotify audio rebroadcast through librespot is intentionally not
  included. Spotify's current policy prohibits non-interactive webcasting to
  multiple listeners and combining Spotify content with another service.

Google OAuth cannot provide YouTube browser cookies or official audio relay
access. Public YouTube playback should be tried without an account first.

## Docker Setup

1. Copy `.env.example` to `.env` and set the three required Discord values.
2. Keep `DASHBOARD_ENABLED=false` unless the dashboard is needed.
3. Start the service:

```bash
docker compose up --build -d
```

The Compose port is bound to host loopback at `127.0.0.1:3000`. Put an HTTPS
reverse proxy in front before making the dashboard remotely accessible.

For remote dashboard access:

```env
DASHBOARD_ENABLED=true
DASHBOARD_SESSION_SECRET=generate-at-least-32-random-characters
DISCORD_CLIENT_SECRET=your-discord-oauth-client-secret
DASHBOARD_REDIRECT_URI=https://music.example.com/auth/callback
DASHBOARD_COOKIE_SECURE=true
DASHBOARD_TRUST_PROXY=true
```

Remove the Compose `DASHBOARD_ALLOW_INSECURE_HTTP` override when the container
is exposed through a public network path.

## Spotify Search

Spotify catalog search does not use a user's Spotify account:

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

When these are absent, YouTube continues to work and the Spotify search tab is
hidden.

## Owner Spotify Sync

This capability uses one instance-owner account. Users do not link their own
Spotify accounts. It is unavailable unless the server owner sets every value:

```env
SPOTIFY_OWNER_SYNC_AVAILABLE=true
SPOTIFY_OWNER_SYNC_RISK_ACKNOWLEDGED=true
SPOTIFY_REFRESH_TOKEN=
```

An administrator must still enable it in the dashboard or run `/jam`. Treat the
refresh token as a password. This integration can expose the owner's listening
activity and may create Spotify policy or account-enforcement risk.

## YouTube Authentication

Do not install a cookie extension as part of the server. Most public playback
should work without cookies. A current yt-dlp PO-token provider can be configured
with `YOUTUBE_POT_PROVIDER_URL`.

For account-required videos only, an administrator may upload a Netscape
`cookies.txt` through the dashboard. MafiaDJ filters the file to YouTube and
Google domains and writes it with restrictive Unix permissions. Use a dedicated
browser profile/account, upload only over HTTPS, and remove any cookie-export
extension afterward.

The host file still needs a restrictive Windows ACL. Run:

```powershell
.\scripts\harden-windows-secrets.ps1
```

## Local Development

The repository includes Windows binaries under `bin`. Bare executable names are
resolved to that directory automatically on Windows.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
```

`npm.cmd start` connects the real Discord bot. Tests do not log in or start
playback.

## Security Defaults

- Dashboard sessions are stored in SQLite, not process memory.
- Discord guild membership and roles are revalidated.
- Mutating dashboard requests require CSRF tokens.
- OAuth, search, playback, and cookie uploads are rate limited.
- The dashboard binds to loopback by default.
- WebSocket upgrades validate both session and same-origin headers.
- Queue size, playlist size, media duration, yt-dlp output, process concurrency,
  and subprocess lifetime are bounded.
- Docker runs as an unprivileged user with a read-only root filesystem, dropped
  capabilities, and a host-loopback-only published port.
- The bundled and container yt-dlp release is pinned to `2026.06.09` and checked
  against its published SHA-256.

## Service Policies

Self-hosting does not override YouTube or Spotify terms. Review their current
terms before deployment. This project does not represent YouTube, Google,
Spotify, Discord, yt-dlp, or librespot.
