# 🎵 MafiaDJ

> **A high-quality, self-hosted Discord music bot for personal servers.**

MafiaDJ is a robust, self-hosted music bot designed for high-fidelity playback from multiple sources. It features a persistent "Now Playing" controller, a personal music library system, and seamless Spotify integration.

## ✨ Features

- **Multi-Source Playback**: 
  - **Spotify**: Direct streaming via `librespot` (Spotify Connect) for premium audio quality.
  - **YouTube**: Video and playlist support with high-quality audio extraction.
  - **SoundCloud**: Track and set support.
  - **Direct URL**: Play valid audio files directly from the web.
- **Interactive Controller**: A persistent, real-time updated message channel that acts as your music dashboard. Control playback with buttons (Pause, Skip, Loop, Shuffle, etc.).
- **Personal Library**: Managing your music has never been easier. Use the `/library` command to open a private DM interface where you can manage your **Favorites** and **Playlists**.
- **DJ System**: robust permission system. Assign a **DJ Role** for full control, while other users participate via a democratic **Voting System** for skips and stops.
- **Self-Contained**: Runs entirely on your own hardware. No external premium subscriptions (other than your own Spotify Premium).

---

## ⚠️ IMPORTANT DISCLAIMER: Spotify & Account Safety

This bot utilizes `librespot` to interface with Spotify's servers. This library functions by emulating a Spotify Connect device (like a smart speaker). While this is a widely used library:

> **Use at your own risk.**
> 
> 1. We **do not** guarantee that your Spotify account will remain safe from potential restrictions or bans by Spotify.
> 2. We **strongly recommend** using a dedicated **secondary Spotify account** for this bot. Do **NOT** use your main personal account if you cannot afford to lose it.
> 3. The developers of MafiaDJ assume **no liability** for any account actions taken by Spotify against accounts used with this software.

---

## 🚀 Installation & Setup

### Option A: Docker / Dockge Deployment (Recommended)

The recommended production setup is via **Docker Compose** or **Dockge**.

1. **Pull and Deploy via `docker-compose.yml`**:
   ```yaml
   version: '3.8'

   services:
     mafiadj:
       image: bl4ut0/mafiadj:latest
       container_name: mafiadj
       restart: unless-stopped
       ports:
         - "3001:3000"  # Put an HTTPS reverse proxy in front for remote access.
       env_file:
         - .env
       volumes:
         - ./data:/app/data
         - ./spotify_cache:/app/spotify_cache
   ```

2. **Environment File (`.env`)**:
   ```env
   # Discord Configuration
   DISCORD_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_client_id
   GUILD_ID=your_guild_id

   # Spotify Configuration (Web API)
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token

   # Web Dashboard Configuration
   DASHBOARD_ENABLED=true
   DASHBOARD_PORT=3000
   DASHBOARD_SESSION_SECRET=generate_a_random_32_character_minimum_secret
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   DASHBOARD_REDIRECT_URI=https://your-dashboard-domain/auth/callback
   DASHBOARD_COOKIE_SECURE=true
   DASHBOARD_TRUST_PROXY=true

   # Executable Paths (Docker)
   YTDLP_PATH=yt-dlp
   FFMPEG_PATH=ffmpeg
   LIBRESPOT_PATH=librespot

   # Optional: allow direct media from only these HTTPS hosts.
   DIRECT_MEDIA_HOSTS=media.example.com

   LOG_LEVEL=info
   ```

3. **Start the Container**:
   ```bash
   docker compose pull
   docker compose up -d
   ```

---

## 🎮 Usage Guide

### Discord Slash Commands

Slash commands are **automatically registered** with Discord API on bot startup.

- **/setup**: Initialize the persistent controller channel (Admin only).
- **/play <query|url>**: Add a song or playlist to the queue (YouTube, Spotify, SoundCloud).
- **/search <query>**: Search YouTube and select a track.
- **/library**: Open your personal music library in Discord DMs.
- **/favorites play**: Quick-play all your liked songs.
- **/queue**: View the current queue.

### Web Companion Dashboard (`http://your-server-ip:3001`)

- **Live Player Controls**: Real-time track progress, play/pause, skip, volume control, and shuffle.
- **Universal Search**: Search YouTube & Spotify directly from the browser and queue tracks with one click.
- **Favorites & Playlists**: Manage your personal library and server playlists with instant sync to Discord.
- **Discord OAuth2 Login**: Secure role-based login matching your server permissions.

### Security notes

- Expose the Web Companion through HTTPS only. Configure the two dashboard cookie/proxy variables above when TLS terminates at a reverse proxy.
- The optional `data/cookies.txt` is an instance-owner credential, not a user login. Keep it out of source control and Docker build contexts, restrict access to the host, and use a dedicated non-sensitive account if you retain unsupported YouTube playback.
- Google/YouTube Data API OAuth authorizes metadata and account-management APIs; it does not grant the bot an official audio-stream relay permission.

---

## 📝 License

ISC License. Created for personal use.
