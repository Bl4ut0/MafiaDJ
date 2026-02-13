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

### Option A: Windows (Standalone Executable)

We provide a self-contained build script that packages everything you need.

1.  **Clone the Repository**:
    ```bash
    git clone <your-repo-url>
    cd MafiaDJ
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Build the Executable**:
    Run the PowerShell build script:
    ```powershell
    .\scripts\build-windows.ps1
    ```
    This will create a `release/` folder containing `mafiadj.exe` and necessary config files.

4.  **Configure**:
    - Navigate to the `release/` folder.
    - Rename `.env.example` to `.env` and fill in your **Discord Bot Token**, **Spotify Credentials**, etc.
    - (Optional) Edit `config.json` to customize bot behavior.

5.  **Run**:
    Double-click `mafiadj.exe` or run it from the terminal.

### Option B: Linux (Debian/Ubuntu)

Use the automated setup script to provision a server (e.g., a VPS or Proxmox container).

1.  **Clone the Repository**:
    ```bash
    git clone <your-repo-url>
    cd MafiaDJ
    ```
2.  **Run Setup Script**:
    ```bash
    sudo bash scripts/setup.sh
    ```
    This script will:
    - Install system dependencies (Node.js 20, FFmpeg, Python/yt-dlp, Rust/Librespot).
    - Set up a `mafiadj` system user.
    - Install the bot as a systemd service (`systemctl start mafiadj`).

### Option C: Manual / Source

1.  **Prerequisites**:
    - Node.js 20+
    - FFmpeg (added to System PATH)
    - Rust (if building librespot from source) OR a pre-built `librespot` binary.

2.  **Install**:
    ```bash
    npm install
    npm run build
    ```

3.  **Configure**:
    - Copy `.env.example` to `.env` and configure it.

4.  **Run**:
    ```bash
    npm start
    ```

---

## 🎮 Usage Guide

### text Commands (Slash Commands)

- **/setup**: Initialize the persistent controller channel (Admin only).
- **/play <query|url>**: Add a song or playlist to the queue.
- **/search <query>**: Search YouTube and select a track.
- **/library**: Open your personal music library in DMs.
- **/favorites play**: Quick-play all your liked songs.
- **/queue**: View the current queue.

### Controller Buttons

- ⏯️ **Pause/Resume**: Toggle playback.
- ⏭️ **Skip**: Vote to skip (or force skip if DJ).
- ⏹️ **Stop**: Vote to stop (or force stop if DJ).
- ❤️ **Like**: Add current track to your Favorites.
- 🔀 **Shuffle**: Shuffle the current queue.
- 🔁 **Loop**: Cycle between Off, Track, and Queue loop modes.

---

## 🛠️ Configuration (`.env`)

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
GUILD_ID=your_server_id

# Spotify (Required for Spotify playback)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_USERNAME=your_spotify_username
SPOTIFY_PASSWORD=your_spotify_password
```

## 📝 License

ISC License. Created for personal use.
