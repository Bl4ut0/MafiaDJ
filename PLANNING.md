# 🎵 MafiaDJ — Project Planning Document

> **Self-hosted Discord music bot with multi-source playback, interactive controls, and DJ role permissions.**
> Created: 2026-02-12 | Status: **Planning**

---

## 1. Project Overview

**MafiaDJ** is a personal-use, self-hosted Discord music bot for a single server. It supports playback from multiple sources (YouTube, Spotify via librespot, SoundCloud, direct URLs), features an interactive persistent "Now Playing" controller embed with button controls, and implements a DJ role permission system with vote-based controls for regular users.

### Design Goals
- **Musico-inspired persistent controller** — Rich, auto-updating embed with full metadata, buttons, and source links
- **Slash commands only** — Clean, modern Discord interactions
- **Direct Spotify streaming** — Via librespot (Spotify Connect), with YouTube fallback
- **Playlist support** — From all platforms (YouTube, Spotify, SoundCloud)
- **DJ permission system** — Vote-based actions for regular users, full control for DJs
- **Self-hosted** — Single server, personal use, runs on a Linux VM (Proxmox)

---

## 2. Feature Set

### 2.1 Multi-Source Playback

| Source | Supported Inputs | Streaming Method |
|--------|-----------------|-----------------|
| **YouTube** | Video URL, Playlist URL, Search query | `yt-dlp` direct audio stream |
| **Spotify** | Track URL, Album URL, Playlist URL | **Primary:** `librespot` direct stream / **Fallback:** metadata → YouTube search |
| **SoundCloud** | Track URL, Playlist URL | `yt-dlp` direct audio stream |
| **Direct URL** | `.mp3`, `.m4a`, `.ogg`, `.wav`, HLS streams | Direct FFmpeg stream |

#### Spotify Streaming via Librespot

**Primary approach — Direct Spotify audio streaming:**

Two integration options (we'll implement the more stable one first, with the other as fallback):

**Option A: `librespot` binary with pipe backend (Recommended)**
```
librespot --backend pipe --name "MafiaDJ" --username <user> --password <pass>
    │  (raw PCM s16le, 44.1kHz, stereo)
    ▼
FFmpeg  (transcode PCM → Opus)
    │
    ▼
@discordjs/voice AudioResource → Discord VC
```
- Spawn `librespot` as a child process with `--backend pipe`
- Outputs raw PCM audio to stdout
- Pipe through FFmpeg for Opus encoding
- Feed into `@discordjs/voice` AudioPlayer
- Bot control sends commands to librespot via its API/stdin
- **Pros:** Battle-tested, well-documented, full Spotify Connect protocol
- **Cons:** Requires librespot binary installed on system

**Option B: `@lox-audioserver/node-librespot` (Native Node.js bindings)**
```
node-librespot.streamTrack(trackId, accessToken)
    │  (PCM buffers directly in Node.js)
    ▼
@discordjs/voice AudioResource → Discord VC
```
- Native N-API bindings, no external binary needed
- `streamTrack()` returns PCM buffers directly in JS
- **Pros:** No external binary, tighter integration
- **Cons:** Less mature, may have compatibility issues on Windows

**Fallback approach — Metadata extraction → YouTube:**
If librespot fails or for tracks not available on Spotify:
```
Spotify URL → Spotify Web API → { title, artist, album, artwork }
    → YouTube search "{title} {artist}" → stream from YouTube
```

#### Playlist Support (All Platforms)

| Platform | Playlist Handling |
|----------|------------------|
| **YouTube** | Extract all video IDs from playlist → queue each as individual tracks |
| **Spotify** | Extract all tracks from playlist/album → stream each via librespot (or YouTube fallback) |
| **SoundCloud** | Extract all tracks from set/playlist → queue each via yt-dlp |

- Playlists show a loading message with progress: "Loading playlist... 12/50 tracks added"
- Large playlists (50+ tracks) show a confirmation prompt before adding
- Each track in the queue retains full metadata from its source

### 2.2 Playback Controls

All controls available as **slash commands** and **interactive buttons** on the persistent controller.

| Control | Button | Command | Description |
|---------|--------|---------|-------------|
| Pause/Resume | ⏸/▶ | `/pause` | Toggle pause state |
| Skip | ⏭ | `/skip` | Skip to next track (DJ) or vote-skip (everyone) |
| Previous | ⏮ | `/previous` | Restart current track or go to previous |
| Stop | ⏹ | `/stop` | Stop playback, clear queue, disconnect (DJ only) |
| Loop | 🔁 | `/loop [off\|track\|queue]` | Cycle loop mode |
| Shuffle | 🔀 | `/shuffle` | Shuffle the current queue |
| Volume Up | 🔊 | `/volume <0-100>` | Set playback volume |
| Volume Down | 🔉 | — | Decrease volume by 10% |
| Like/Favorite | ❤️ | `/like` | Save current track to personal favorites |

### 2.3 Persistent Controller Message

A **permanent, auto-updating message** in a designated text channel. This is the primary interface for the bot — it shows the current state and provides interactive controls.

#### Active State (Now Playing):
```
┌──────────────────────────────────────────────────┐
│  🎵 MafiaDJ                                     │
│                                                  │
│  [Album Art / Video Thumbnail]                   │
│                                                  │
│  **Song Title**                                  │
│  Artist Name — Album Name                        │
│                                                  │
│  ▶ 2:34 ━━━━━━━━━━━○──────── 4:12               │
│                                                  │
│  📎 Source: [YouTube](https://youtu.be/xxxx)     │
│  🎵 Spotify: [Open in Spotify](https://open...)  │
│  👤 Requested by @User                           │
│  🔁 Loop: Off  |  🔊 Volume: 65%                │
│  🎶 Up Next: "Next Song Name" by Artist          │
│                                                  │
│  ────────── Queue: 5 tracks (18:42 total) ─────  │
│                                                  │
│  [⏮ Prev] [⏸ Pause] [⏭ Skip] [❤️ Like]       │
│  [🔁 Loop] [🔀 Shuffle] [🔊 Vol+] [🔉 Vol-]   │
│  [⭐ Favorites] [⏹ End Session]                 │
└──────────────────────────────────────────────────┘
```

#### Metadata Displayed:
- **Song title**, artist, album name
- **Album art / thumbnail** — Either Spotify album art or YouTube video thumbnail
- **Source link** — Clickable link to the original YouTube video or Spotify track
- **Spotify link** — If track was resolved from Spotify, show "Open in Spotify" link
- **Progress bar** — Visual progress with elapsed/total duration
- **Requester** — Who added the track
- **Loop status** and **volume level**
- **Up next** — Preview of the next track in queue
- **Queue summary** — Total tracks and total duration

#### Idle State (Nothing Playing):
```
┌──────────────────────────────────────────────────┐
│  🎵 MafiaDJ                                     │
│                                                  │
│  **Nothing is Playing**                          │
│                                                  │
│  No track is currently playing.                  │
│  Join a voice channel and use /play to           │
│  add songs by name or URL.                       │
│                                                  │
│  Use /help to see all commands                   │
└──────────────────────────────────────────────────┘
```

#### Controller Behavior:
- Created via `/setup` command (Admin) — sends the controller to a specific channel
- Message ID is persisted in the database; bot edits the same message on track changes
- If the message is deleted, bot re-creates it on next playback
- Button interactions trigger the same permission checks as slash commands
- Embed updates on: track change, pause/resume, loop toggle, volume change, queue change

### 2.4 Queue Management

| Command | Description | Permission |
|---------|-------------|------------|
| `/play <query or URL>` | Add track/playlist to queue (starts playing if idle) | Everyone |
| `/play <spotify playlist URL>` | Add entire Spotify playlist | Everyone |
| `/play <youtube playlist URL>` | Add entire YouTube playlist | Everyone |
| `/queue` | View current queue (paginated, 10 per page) | Everyone |
| `/queue remove <position>` | Remove a specific track | DJ |
| `/queue move <from> <to>` | Reorder a track in the queue | DJ |
| `/queue clear` | Clear the entire queue | DJ |
| `/queue save <name>` | Save current queue as a named playlist | Everyone |
| `/queue load <name>` | Load a saved playlist into the queue | Everyone |
| `/queue list` | List all saved playlists | Everyone |

### 2.5 Permission System

#### Three Tiers:

| Tier | Who | Permissions |
|------|-----|-------------|
| **Everyone** | All server members | Play songs, view queue, like tracks, view now playing, save playlists, vote-skip, vote-stop |
| **DJ** | Members with the configured DJ role | **All of the above** + instant skip, stop, pause, volume, clear queue, remove/move tracks, shuffle, loop, seek, force disconnect, purge controller |
| **Admin** | Server owner / `Administrator` perm | **All of the above** + `/setup`, `/settings`, `/dj` configure, set bot channels, manage all settings |

#### Vote System (for Everyone tier):

When a non-DJ member tries a restricted action (skip, stop, pause), it triggers a **vote**:

| Action | Vote Threshold | Behavior |
|--------|---------------|----------|
| **Vote Skip** | 50% of listeners in VC | "⏭ Vote to skip: 2/4 needed — React ✅ to vote" |
| **Vote Stop** | 66% of listeners in VC | "⏹ Vote to stop: 3/4 needed" |
| **Vote Pause** | 50% of listeners in VC | "⏸ Vote to pause: 2/4 needed" |

- Votes are tracked via button interactions on a temporary vote message
- Vote expires after 30 seconds if threshold not reached
- The bot (itself) is not counted in listener total
- If only 1 other person is in VC with the bot, that person gets instant control (no vote needed)

#### DJ Purge Abilities:
- `/dj purge` — Delete and re-create the controller message
- `/dj reset` — Clear queue, stop playback, reset volume to default
- DJs can remove any track from queue regardless of who added it

### 2.6 Server Configuration

| Setting | Command | Default | Description |
|---------|---------|---------|-------------|
| DJ Role | `/settings dj-role <@role>` | None (everyone is DJ) | Role required for DJ permissions |
| Default Volume | `/settings volume <0-100>` | `50` | Starting volume when bot joins |
| Bot Text Channel | `/settings channel <#channel>` | Any | Restrict bot commands to specific channel |
| Controller Channel | `/setup <#channel>` | None | Where the persistent controller lives |
| Max Queue | `/settings max-queue <number>` | `200` | Maximum tracks in queue |
| Max Duration | `/settings max-duration <minutes>` | `180` | Maximum track duration |
| Auto-Disconnect | `/settings auto-dc <minutes\|off>` | `5 min` | Disconnect after inactivity |
| Disconnect When Alone | `/settings alone-dc <on\|off>` | `on` | Leave VC if bot is alone |
| Duplicate Prevention | `/settings no-dupes <on\|off>` | `off` | Prevent same track in queue |
| Vote Skip Threshold | `/settings vote-skip <percent>` | `50` | % of listeners needed for vote-skip |
| Vote Stop Threshold | `/settings vote-stop <percent>` | `66` | % of listeners needed for vote-stop |
| Spotify Mode | `/settings spotify <librespot\|youtube>` | `librespot` | Spotify playback method |

### 2.7 Personal Music Library (DM-Based Interactive UI)

Every user gets a **personal music library** managed through **DMs from the bot**. This keeps the library private, persistent, and doesn't clutter the server channel. All interactions within the library are **button and select-menu driven** — no typing commands.

#### Entry Points

| Action | How | Where |
|--------|-----|-------|
| **Like a song** | ❤️ button on the Now Playing controller | Server channel (ephemeral confirmation) |
| **Open library** | `/library` slash command | Bot sends/updates a DM to the user |
| **Quick play favorites** | `/favorites play` slash command | Server channel (queues all favorites) |

#### Library DM — Main View

When a user runs `/library`, the bot sends (or edits) a **DM message** with their personal library:

```
┌──────────────────────────────────────────────────┐
│  📚 Your Music Library                          │
│                                                  │
│  ❤️ Favorites: 47 songs                         │
│  📁 Playlists: 5                                │
│                                                  │
│  ── Recent Favorites ────────────────────────    │
│  1. 🎵 Blinding Lights — The Weeknd    (3:20)   │
│  2. 🎵 Levitating — Dua Lipa           (3:23)   │
│  3. 🎵 Bohemian Rhapsody — Queen       (5:55)   │
│  4. 🎵 Circles — Post Malone           (3:35)   │
│  5. 🎵 Starboy — The Weeknd            (3:50)   │
│                                                  │
│  Page 1 of 10                                    │
│                                                  │
│  [◀️ Prev] [▶️ Next] [🔢 Go to Page]            │
│  [❤️ Favorites] [📁 Playlists] [🔍 Search]      │
│  [▶️ Play All] [🔀 Shuffle All]                  │
└──────────────────────────────────────────────────┘
```

**Buttons on Main View:**
- **◀️ Prev / ▶️ Next** — Paginate through favorites (5 per page)
- **🔢 Go to Page** — Opens a modal to type a page number
- **❤️ Favorites** — Show favorites list (current view)
- **📁 Playlists** — Switch to playlists view
- **🔍 Search** — Opens a modal to search within your library
- **▶️ Play All** — Queue all favorites in the server (bot confirms which server/VC)
- **🔀 Shuffle All** — Queue all favorites shuffled

**Select Menu (below buttons):**
- A select menu listing the 5 currently visible songs
- Selecting a song opens the **Track Detail View**

#### Library DM — Track Detail View

When a user selects a specific track from any list:

```
┌──────────────────────────────────────────────────┐
│  🎵 Track Details                                │
│                                                  │
│  [Album Art Thumbnail]                           │
│                                                  │
│  **Blinding Lights**                             │
│  The Weeknd — After Hours                        │
│  Duration: 3:20                                  │
│                                                  │
│  📎 Source: YouTube                              │
│  🔗 [Open Link](https://youtu.be/xxxx)          │
│  🎵 [Open in Spotify](https://open.spotify...)   │
│                                                  │
│  Added to favorites: Jan 15, 2026                │
│  In playlists: Chill Vibes, Late Night           │
│                                                  │
│  [▶️ Play Now] [📋 Add to Playlist]              │
│  [🗑️ Remove from Favorites] [◀️ Back]           │
└──────────────────────────────────────────────────┘
```

**Buttons on Track Detail:**
- **▶️ Play Now** — Queue this track in the server immediately
- **📋 Add to Playlist** — Shows a select menu of your playlists to add this track to
- **🗑️ Remove from Favorites** — Remove from favorites (with confirmation)
- **◀️ Back** — Return to the previous list view

#### Library DM — Playlists View

When the user clicks **📁 Playlists**:

```
┌──────────────────────────────────────────────────┐
│  📁 Your Playlists                               │
│                                                  │
│  1. 📁 Chill Vibes          12 songs  (42:30)   │
│  2. 📁 Workout Mix          8 songs   (28:15)   │
│  3. 📁 Late Night           15 songs  (55:42)   │
│  4. 📁 Road Trip            22 songs  (1:18:30) │
│  5. 📁 Throwbacks           34 songs  (2:05:12) │
│                                                  │
│  [➕ Create New Playlist]                        │
│  [❤️ Back to Favorites]                          │
└──────────────────────────────────────────────────┘
```

**Select menu** to pick a playlist → opens **Playlist Detail View**.

**Buttons:**
- **➕ Create New Playlist** — Opens a modal to name the new playlist
- **❤️ Back to Favorites** — Return to favorites view

#### Library DM — Playlist Detail View

When a user selects a specific playlist:

```
┌──────────────────────────────────────────────────┐
│  📁 Chill Vibes                                  │
│  12 songs • 42:30 total • Created Jan 10, 2026   │
│                                                  │
│  1. 🎵 Blinding Lights — The Weeknd    (3:20)   │
│  2. 🎵 Circles — Post Malone           (3:35)   │
│  3. 🎵 Sunflower — Post Malone         (2:38)   │
│  4. 🎵 Heat Waves — Glass Animals      (3:59)   │
│  5. 🎵 Watermelon Sugar — Harry Styles (2:54)   │
│                                                  │
│  Page 1 of 3                                     │
│                                                  │
│  [◀️ Prev] [▶️ Next]                             │
│  [▶️ Import to Queue] [🔀 Import Shuffled]       │
│  [➕ Add from Favorites] [✏️ Rename]             │
│  [🗑️ Delete Playlist] [◀️ Back to Playlists]    │
└──────────────────────────────────────────────────┘
```

**Select menu** to pick a track → opens **Track Detail View** with context of this playlist.

**Buttons:**
- **▶️ Import to Queue** — Add all tracks from this playlist to the server queue (in order)
- **🔀 Import Shuffled** — Add all tracks shuffled
- **➕ Add from Favorites** — Shows a select menu of favorites not yet in this playlist
- **✏️ Rename** — Opens a modal to rename the playlist
- **🗑️ Delete Playlist** — Delete with confirmation ("Are you sure? This cannot be undone" with ✅/❌ buttons)
- **◀️ Back to Playlists** — Return to playlists list

#### Library DM — Add to Playlist Flow

From Track Detail → **📋 Add to Playlist**:

```
┌──────────────────────────────────────────────────┐
│  📋 Add "Blinding Lights" to a playlist:         │
│                                                  │
│  [Select a playlist          ▼]                  │
│  ┌──────────────────────────┐                    │
│  │ 📁 Chill Vibes     (12)  │                    │
│  │ 📁 Workout Mix      (8)  │                    │
│  │ 📁 Late Night      (15)  │                    │
│  │ 📁 Road Trip       (22)  │                    │
│  │ ➕ Create New Playlist    │                    │
│  └──────────────────────────┘                    │
│                                                  │
│  [❌ Cancel]                                     │
└──────────────────────────────────────────────────┘
```

- User selects a playlist → track is added → confirmation message → return to Track Detail
- "➕ Create New Playlist" option → opens modal → creates playlist with this track as first entry

#### Library DM — Search Within Library

From Main View → **🔍 Search**:
- Opens a Discord **modal** with a text input field
- User types a search query (e.g., "weeknd")
- Bot updates the DM with search results filtered from favorites:

```
┌──────────────────────────────────────────────────┐
│  🔍 Search Results for "weeknd"                  │
│                                                  │
│  Found 3 matches in your library:                │
│                                                  │
│  1. 🎵 Blinding Lights — The Weeknd    (3:20)   │
│  2. 🎵 Starboy — The Weeknd            (3:50)   │
│  3. 🎵 Save Your Tears — The Weeknd    (3:36)   │
│                                                  │
│  [◀️ Back to Library]                            │
└──────────────────────────────────────────────────┘
```

#### Import to Queue Flow

When a user clicks **▶️ Import to Queue** (from favorites or a playlist) in the DM:

```
User clicks "Import to Queue" in DM
    │
    ├── Bot checks: Is the user in a voice channel in the server?
    │   ├── Yes → Queue all tracks, join VC if needed, start playing
    │   └── No → "❌ You need to be in a voice channel to import tracks!"
    │
    ├── DM confirmation: "✅ Imported 12 tracks from 'Chill Vibes' to the queue!"
    └── Server controller embed updates to reflect new queue
```

#### Liking a Song (Server → Library)

```
User clicks ❤️ on Now Playing controller
    │
    ├── Track already in favorites?
    │   ├── Yes → ephemeral: "⭐ This track is already in your favorites!"
    │   └── No → Add to favorites → ephemeral: "❤️ Added to favorites!"
    │
    └── If user has their Library DM open → auto-refresh the DM
```

The ❤️ button is **add-only** — it does not remove. Since the controller has no visual indicator of whether a track is already favorited, a toggle would be confusing. Removing tracks from favorites is done exclusively from the **Favorites DM** (via the 🗑️ Remove button on the Track Detail view).

### 2.8 Additional Features

| Feature | Command | Description |
|---------|---------|-------------|
| **Search** | `/search <query>` | Search YouTube, return top 5 results with select menu |
| **Seek** | `/seek <timestamp>` | Jump to position in track (e.g., `/seek 1:30`) — DJ only |
| **Now Playing** | `/np` | Show current track info (ephemeral) |
| **Autoplay** | `/autoplay` | Toggle auto-queue similar tracks when queue ends — DJ only |
| **Help** | `/help` | Command overview with categories and permissions |

### 2.9 Features Explicitly NOT Included
- ❌ Lyrics — Not needed
- ❌ Audio filters (bass boost, nightcore, etc.) — Not needed
- ❌ Prefix commands — Slash only
- ❌ Multi-server scaling — Single server, personal use
- ❌ Web dashboard — Not in scope

---

## 3. Technical Architecture

### 3.1 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Language** | TypeScript | Type safety |
| **Discord** | `discord.js` v14 | Bot framework, slash commands, embeds, buttons |
| **Voice** | `@discordjs/voice` | Voice connection management |
| **Opus Codec** | `@discordjs/opus` | Audio encoding for Discord |
| **YouTube/SC** | `yt-dlp` (binary) | YouTube & SoundCloud audio extraction |
| **FFmpeg** | `ffmpeg` (binary) | Audio transcoding |
| **Spotify Stream** | `librespot` (binary) | Direct Spotify audio streaming via Spotify Connect |
| **Spotify API** | `spotify-web-api-node` | Metadata extraction, playlist/album resolution |
| **Database** | `better-sqlite3` | Server config, playlists, favorites |
| **Logging** | `pino` | Structured logging |

### 3.2 External Dependencies (Binaries)

Must be installed on the Linux VM:

| Binary | Purpose | Install (Debian/Ubuntu) |
|--------|---------|-------------------------|
| **yt-dlp** | YouTube/SoundCloud audio extraction | `sudo apt install yt-dlp` or `pip install yt-dlp` |
| **FFmpeg** | Audio transcoding | `sudo apt install ffmpeg` |
| **librespot** | Spotify Connect streaming | `cargo install librespot` (see below) |

#### Librespot Setup (Linux)
```bash
# Install Rust toolchain (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install build dependencies
sudo apt install build-essential pkg-config libasound2-dev

# Build and install librespot
cargo install librespot

# Verify installation
librespot --version
```

**Librespot will run as a managed child process:**
```bash
librespot \
  --name "MafiaDJ" \
  --backend pipe \
  --format S16 \
  --username <SPOTIFY_USERNAME> \
  --password <SPOTIFY_PASSWORD> \
  --bitrate 320 \
  --disable-audio-cache
```

### 3.3 Project Structure

```
MafiaDJ/
├── PLANNING.md                  # This document
├── package.json
├── tsconfig.json
├── .env                         # Secrets only — tokens, passwords (gitignored)
├── .env.example                 # Template for .env
├── config.json                  # Bot behavior settings (editable via CLI)
├── config.default.json          # Default config (committed to git, reference)
├── .gitignore
├── data/                        # SQLite database (gitignored)
│   └── mafiadj.db
│
├── scripts/                     # Operations & deployment scripts
│   ├── setup.sh                 # One-shot VM provisioning (installs everything)
│   ├── mafiadj.sh               # CLI wrapper (installed to /usr/local/bin/mafiadj)
│   ├── mafiadj.service          # systemd unit file template
│   └── check-deps.sh            # Verify all external dependencies are installed
│
├── src/
│   ├── index.ts                 # Entry point — bot startup
│   ├── config.ts                # Config loader — merges .env + config.json
│   ├── types.ts                 # Shared TypeScript types/interfaces
│   │
│   ├── bot/
│   │   ├── client.ts            # Discord client setup, event binding
│   │   └── deploy-commands.ts   # Slash command registration script
│   │
│   ├── commands/                # Slash command definitions & handlers
│   │   ├── index.ts             # Command registry (auto-loader)
│   │   ├── play.ts              # /play — add track or playlist
│   │   ├── skip.ts              # /skip — skip or vote-skip
│   │   ├── stop.ts              # /stop — stop or vote-stop
│   │   ├── pause.ts             # /pause — pause/resume or vote-pause
│   │   ├── queue.ts             # /queue — view, remove, move, clear, save, load
│   │   ├── volume.ts            # /volume — set volume (DJ)
│   │   ├── loop.ts              # /loop — cycle loop mode
│   │   ├── shuffle.ts           # /shuffle — shuffle queue (DJ)
│   │   ├── seek.ts              # /seek — jump to timestamp (DJ)
│   │   ├── search.ts            # /search — YouTube search + select
│   │   ├── library.ts           # /library — open DM-based music library
│   │   ├── favorites.ts         # /favorites play — quick play all favorites
│   │   ├── np.ts                # /np — now playing info
│   │   ├── autoplay.ts          # /autoplay — toggle autoplay (DJ)
│   │   ├── dj.ts                # /dj — DJ role config, purge, reset
│   │   ├── settings.ts          # /settings — server config
│   │   ├── setup.ts             # /setup — create controller message
│   │   └── help.ts              # /help — command reference
│   │
│   ├── events/                  # Discord gateway event handlers
│   │   ├── interactionCreate.ts # Slash commands + button interactions
│   │   ├── voiceStateUpdate.ts  # Auto-disconnect, alone detection
│   │   └── ready.ts             # Bot ready, restore controller state
│   │
│   ├── player/                  # Audio playback engine
│   │   ├── PlayerManager.ts     # Singleton: manages the guild's player
│   │   ├── MusicPlayer.ts       # Core: queue, playback state, controls
│   │   ├── Queue.ts             # Queue data structure & operations
│   │   ├── Track.ts             # Track model (source, metadata, URLs)
│   │   └── AudioStream.ts       # Creates audio streams (yt-dlp, librespot, direct)
│   │
│   ├── sources/                 # URL → Track[] resolvers
│   │   ├── index.ts             # Source router (detect URL type → resolver)
│   │   ├── youtube.ts           # YouTube video & playlist resolver
│   │   ├── spotify.ts           # Spotify track, album, playlist resolver
│   │   ├── soundcloud.ts        # SoundCloud track & playlist resolver
│   │   └── direct.ts            # Direct audio URL resolver
│   │
│   ├── spotify/                 # Librespot integration
│   │   ├── LibrespotProcess.ts  # Manage librespot child process lifecycle
│   │   ├── SpotifyAPI.ts        # Spotify Web API wrapper (metadata, search)
│   │   └── SpotifyResolver.ts   # Resolve Spotify URLs → track metadata
│   │
│   ├── ui/                      # Discord UI components
│   │   ├── NowPlayingEmbed.ts   # Build the Now Playing embed
│   │   ├── QueueEmbed.ts        # Paginated queue display
│   │   ├── SearchEmbed.ts       # Search results with select menu
│   │   ├── VoteEmbed.ts         # Vote-skip/stop/pause embed
│   │   ├── ButtonRows.ts        # Button component builders
│   │   ├── ControllerMessage.ts # Persistent controller CRUD & update logic
│   │   └── library/             # DM-based personal music library UI
│   │       ├── LibraryManager.ts    # Manages the DM message lifecycle
│   │       ├── MainView.ts          # Favorites list embed + buttons
│   │       ├── TrackDetailView.ts   # Single track detail embed
│   │       ├── PlaylistsView.ts     # Playlists list embed
│   │       ├── PlaylistDetailView.ts # Playlist contents + management
│   │       ├── AddToPlaylistView.ts # Playlist picker select menu
│   │       └── SearchView.ts        # Library search results
│   │
│   ├── permissions/             # Permission enforcement
│   │   ├── PermissionManager.ts # Check DJ/Admin/Everyone perms per action
│   │   └── VoteManager.ts       # Vote tracking, threshold checks, expiry
│   │
│   ├── database/                # Data persistence (SQLite)
│   │   ├── Database.ts          # Connection, migrations, schema setup
│   │   ├── ServerSettings.ts    # Per-server settings CRUD
│   │   ├── ServerPlaylists.ts   # Server-level saved playlists
│   │   ├── Favorites.ts         # User favorites CRUD
│   │   └── PersonalPlaylists.ts # User personal playlists CRUD
│   │
│   └── utils/                   # Shared utilities
│       ├── logger.ts            # Pino logger configuration
│       ├── formatters.ts        # Duration formatting, progress bar
│       ├── constants.ts         # Embed colors, emojis, default values
│       └── errors.ts            # Custom error classes
│
└── dist/                        # Compiled JS output (gitignored)
```

### 3.4 Database Schema

```sql
-- Server settings
CREATE TABLE server_settings (
    guild_id TEXT PRIMARY KEY,
    dj_role_id TEXT,
    default_volume INTEGER DEFAULT 50,
    bot_channel_id TEXT,
    controller_channel_id TEXT,
    controller_message_id TEXT,
    max_queue_length INTEGER DEFAULT 200,
    max_duration_seconds INTEGER DEFAULT 10800,
    auto_disconnect_seconds INTEGER DEFAULT 300,
    disconnect_when_alone INTEGER DEFAULT 1,
    duplicate_prevention INTEGER DEFAULT 0,
    vote_skip_threshold INTEGER DEFAULT 50,
    vote_stop_threshold INTEGER DEFAULT 66,
    spotify_mode TEXT DEFAULT 'librespot',   -- 'librespot' | 'youtube'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Server-level saved playlists (from /queue save — shared, guild-scoped)
CREATE TABLE server_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(guild_id, name)
);

-- Server playlist tracks (ordered)
CREATE TABLE server_playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES server_playlists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT,
    url TEXT NOT NULL,
    source TEXT NOT NULL,          -- 'youtube' | 'spotify' | 'soundcloud' | 'direct'
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    spotify_uri TEXT,
    position INTEGER NOT NULL
);

-- User favorites (personal, cross-guild — tied to user_id)
CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    url TEXT NOT NULL,
    source TEXT NOT NULL,          -- 'youtube' | 'spotify' | 'soundcloud' | 'direct'
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    spotify_uri TEXT,
    spotify_url TEXT,              -- Original Spotify URL for "Open in Spotify" link
    youtube_url TEXT,              -- YouTube URL for source link
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, url)
);

-- Personal playlists (user-owned, curated from favorites)
CREATE TABLE personal_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
);

-- Personal playlist tracks (references favorites)
CREATE TABLE personal_playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES personal_playlists(id) ON DELETE CASCADE,
    favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE(playlist_id, favorite_id)
);

-- Tracks the DM message ID for each user's library (so we can edit it)
CREATE TABLE library_dm_state (
    user_id TEXT PRIMARY KEY,
    dm_channel_id TEXT NOT NULL,
    dm_message_id TEXT NOT NULL,
    current_view TEXT DEFAULT 'favorites',  -- 'favorites' | 'playlists' | 'playlist_detail' | 'track_detail' | 'search'
    current_page INTEGER DEFAULT 1,
    current_playlist_id INTEGER,            -- Which playlist is being viewed
    current_track_id INTEGER,               -- Which track is being viewed
    search_query TEXT,                      -- Active search query
    updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. Key Implementation Details

### 4.1 Audio Pipeline (per source)

#### YouTube / SoundCloud:
```
/play <youtube URL>
    → yt-dlp --get-url (extract direct audio stream URL)
    → FFmpeg (pipe audio → Opus)
    → createAudioResource() → AudioPlayer → Voice Connection
```

#### Spotify (Librespot — Primary):
```
/play <spotify URL>
    → Spotify Web API: resolve URI → get track metadata
    → librespot child process: play spotify:track:xxxxx
    → stdout raw PCM (s16le, 44100Hz, stereo)
    → FFmpeg (PCM → Opus)
    → createAudioResource() → AudioPlayer → Voice Connection
```

#### Spotify (YouTube Fallback):
```
/play <spotify URL>
    → Spotify Web API: resolve URI → { title, artist, artwork }
    → YouTube search: "{title} {artist}"
    → yt-dlp → FFmpeg → AudioPlayer (same as YouTube pipeline)
    → Embed shows Spotify metadata + artwork (not YouTube thumbnail)
```

#### Direct URL:
```
/play <https://example.com/song.mp3>
    → FFmpeg (direct download → Opus)
    → createAudioResource() → AudioPlayer → Voice Connection
```

### 4.2 Librespot Process Management

The `LibrespotProcess` class manages a long-running librespot child process:

```
Bot Start → Spawn librespot (--backend pipe, stays running)
    │
    ├── On /play spotify:track → Send play command via Spotify Connect API
    │       → librespot outputs PCM audio to stdout
    │       → Pipe stdout → FFmpeg → Discord
    │
    ├── On /skip → Send next command
    ├── On /pause → Send pause command
    ├── On /stop → Send stop command
    │
    ├── On crash → Auto-restart librespot process
    └── On bot shutdown → Kill librespot process
```

**Key considerations:**
- librespot acts as a Spotify Connect receiver — we control it via the Spotify Web API
- The bot authenticates as a Spotify Connect device, then uses the Web API to command playback
- PCM audio streams through stdout pipe → FFmpeg → Discord
- Process health monitoring with automatic restart on crash

### 4.3 Controller Message Lifecycle

```
/setup #music-channel
    → Send idle embed to #music-channel
    → Save channel_id + message_id to database
    │
    ├── /play "song" → Edit embed → Now Playing state
    ├── Track ends → Edit embed → Next track or idle state
    ├── Button press → Permission check → Execute action → Edit embed
    ├── /dj purge → Delete message → Resend fresh embed → Save new message_id
    │
    └── Bot restart → Load message_id from DB → Continue editing same message
```

### 4.4 Vote System Flow

```
Non-DJ presses ⏭ Skip button (or /skip)
    │
    ├── Only 1 listener + bot in VC? → Instant skip (no vote needed)
    │
    └── Multiple listeners →
        → Create vote embed: "⏭ Vote to skip — 1/3 needed"
        → Show ✅ Vote button
        → Track votes by user ID (no duplicate votes)
        → On each vote → Update embed count
        │
        ├── Threshold reached → Execute skip → Delete vote embed
        └── 30 seconds elapsed → Vote failed → Delete vote embed
```

### 4.5 Personal Music Library — DM Message Lifecycle

Each user has **one library DM message** that the bot edits in place as they navigate.

```
User runs /library (in server)
    │
    ├── First time?
    │   ├── Yes → Bot sends a new DM → Save dm_channel_id + dm_message_id to library_dm_state
    │   └── No → Bot edits the existing DM message (fetched from library_dm_state)
    │           └── If message was deleted → Send new DM, update state
    │
    └── DM shows: Main View (favorites list, page 1)
```

**Navigation flow (all within the same DM message):**

```
Main View (Favorites)
    │
    ├── [◀️ Prev] / [▶️ Next] → Edit embed with new page
    ├── [📁 Playlists] → Edit embed → Playlists View
    ├── [🔍 Search] → Modal → Edit embed → Search Results View
    ├── [▶️ Play All] → Queue all favorites in server → Confirmation in DM
    ├── [🔀 Shuffle All] → Queue shuffled → Confirmation in DM
    └── [Select a track] → Edit embed → Track Detail View
            │
            ├── [▶️ Play Now] → Queue track in server
            ├── [📋 Add to Playlist] → Edit embed → Add to Playlist View
            │       │
            │       ├── [Select playlist] → Add track → Confirmation → Back to Track Detail
            │       └── [➕ Create New] → Modal (name) → Create + add → Back to Track Detail
            │
            ├── [🗑️ Remove] → Confirmation buttons → Remove → Back to list
            └── [◀️ Back] → Edit embed → Previous view

Playlists View
    │
    ├── [➕ Create New Playlist] → Modal (name) → Create → Refresh
    ├── [❤️ Back to Favorites] → Edit embed → Main View
    └── [Select a playlist] → Edit embed → Playlist Detail View
            │
            ├── [▶️ Import to Queue] → Queue all in server
            ├── [🔀 Import Shuffled] → Queue shuffled
            ├── [➕ Add from Favorites] → Select menu of favorites → Add → Refresh
            ├── [✏️ Rename] → Modal → Rename → Refresh
            ├── [🗑️ Delete Playlist] → Confirmation → Delete → Back to Playlists
            ├── [Select a track] → Edit embed → Track Detail (with playlist context)
            │       │
            │       └── Additional button: [🗑️ Remove from Playlist]
            │
            └── [◀️ Back to Playlists] → Edit embed → Playlists View
```

**Key design principles:**
- **Single message, edited in place** — No message spam. The bot edits one DM message.
- **Navigation state tracked in DB** — So if the user closes Discord and reopens, the library DM still works.
- **Button custom IDs encode state** — e.g., `library:favorites:page:3`, `library:track:42`, `library:playlist:7:page:2`
- **Import to Queue crosses boundaries** — DM button triggers an action in the server (queue tracks, join VC). Bot verifies the user is in a VC before importing.
- **Auto-refresh on like** — If a user ❤️ likes a song from the server controller, and their library DM is on the favorites view, the DM auto-updates to include the new track.

---

## 5. Implementation Phases

### Phase 1: Foundation ⚡
**Goal:** Bot connects, joins VC, plays YouTube audio with basic commands.

- [x] Create planning document
- [ ] Project scaffolding (TypeScript, package.json, tsconfig)
- [ ] Environment config (.env, config loader, validation)
- [ ] Discord client setup (discord.js v14, gateway intents)
- [ ] Slash command framework (registration, command loader)
- [ ] Voice connection management (@discordjs/voice)
- [ ] YouTube playback via yt-dlp + FFmpeg
- [ ] Basic commands: `/play`, `/skip`, `/stop`, `/pause`, `/np`
- [ ] Simple in-memory queue with `/queue` view
- [ ] Dependency checker script (yt-dlp, ffmpeg, etc.)

### Phase 2: Persistent Controller & Rich UI 🎨
**Goal:** Full Musico-style controller embed with buttons and metadata.

- [ ] Now Playing embed builder (full metadata, progress bar, source links)
- [ ] Idle state embed
- [ ] Interactive button rows (all controls)
- [ ] Controller message manager (create, edit, persist, restore)
- [ ] `/setup` command
- [ ] Queue pagination embed
- [ ] Volume control
- [ ] Loop mode (off/track/queue)
- [ ] Shuffle

### Phase 3: Multi-Source & Playlists 🎵
**Goal:** Spotify, SoundCloud, direct URLs, and playlist support.

- [ ] Source URL detection router
- [ ] Spotify Web API integration (metadata resolver)
- [ ] Librespot process manager (spawn, health check, restart)
- [ ] Spotify track streaming via librespot
- [ ] Spotify → YouTube fallback
- [ ] YouTube playlist support
- [ ] Spotify playlist/album support
- [ ] SoundCloud support (via yt-dlp)
- [ ] Direct URL support
- [ ] `/search` with select menu

### Phase 4: Permissions & Voting 🔐
**Goal:** DJ role system and vote-based controls.

- [ ] Database setup (SQLite, migrations)
- [ ] Server settings CRUD
- [ ] Permission manager (Everyone/DJ/Admin checks)
- [ ] Vote manager (skip/stop/pause voting)
- [ ] Vote embeds with button interaction
- [ ] `/dj` commands (role set, purge, reset)
- [ ] `/settings` commands
- [ ] Auto-disconnect (inactivity, alone in VC)
- [ ] Bot channel restriction

### Phase 5: Personal Music Library 📚
**Goal:** Full DM-based interactive music library with favorites and personal playlists.

- [ ] Favorites database CRUD (add, remove, list, search)
- [ ] ❤️ toggle on Now Playing controller (like/unlike)
- [ ] `/library` command — send/edit library DM
- [ ] Library DM — Main View (favorites list, pagination, buttons)
- [ ] Library DM — Track Detail View (metadata, play, add to playlist, remove)
- [ ] Library DM — Playlists View (list all, create new)
- [ ] Library DM — Playlist Detail View (track list, import, manage)
- [ ] Library DM — Add to Playlist flow (select menu with playlist picker)
- [ ] Library DM — Search within library (modal + filtered results)
- [ ] Import to queue from DM (favorites or playlist → server queue)
- [ ] `/favorites play` — Quick queue all favorites
- [ ] Auto-refresh library DM on like/unlike
- [ ] Library DM message state persistence (survives bot restart)
- [ ] Server playlists (`/queue save`, `/queue load`)
- [ ] Seek command
- [ ] Autoplay (YouTube recommendations after queue ends)
- [ ] Queue move/remove operations

### Phase 6: Operations Tooling 🔧
**Goal:** One-command setup, management, and deployment.

- [ ] `setup.sh` — One-shot VM provisioning script
- [ ] `mafiadj` CLI — start/stop/restart/status/logs/debug/config/update
- [ ] `config.json` + `config.default.json` — Bot behavior config
- [ ] `config.ts` — Merged config loader (.env secrets + config.json settings)
- [ ] `mafiadj.service` — systemd unit file
- [ ] `check-deps.sh` — Dependency verification script
- [ ] Install script (copies CLI to `/usr/local/bin/mafiadj`)

### Phase 7: Polish & Hardening 🛡️
**Goal:** Production-ready reliability.

- [ ] Error handling for all edge cases
- [ ] Graceful voice reconnection on network drops
- [ ] Librespot crash recovery and auto-restart
- [ ] Rate limit handling
- [ ] Structured logging throughout
- [ ] README with full setup instructions
- [ ] `/help` command with permission-aware display

---

## 6. Operations & Configuration

### 6.1 Configuration System

**Two files, clean separation:**

| File | Contains | Editable Via | Committed to Git |
|------|----------|-------------|------------------|
| **`.env`** | Secrets only (tokens, passwords) | `mafiadj config secrets` | ❌ Never |
| **`config.json`** | All bot behavior settings | `mafiadj config edit` or by hand | ✅ Optional |

#### `.env` — Secrets Only
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
GUILD_ID=your_server_id
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_USERNAME=your_spotify_username
SPOTIFY_PASSWORD=your_spotify_password
```

#### `config.json` — Bot Behavior Settings
```json
{
  "bot": {
    "name": "MafiaDJ",
    "embedColor": "#7C3AED",
    "logLevel": "info"
  },
  "playback": {
    "defaultVolume": 50,
    "maxQueueLength": 200,
    "maxDurationSeconds": 10800,
    "duplicatePrevention": false,
    "spotifyMode": "librespot"
  },
  "voice": {
    "autoDisconnectSeconds": 300,
    "disconnectWhenAlone": true,
    "twentyFourSeven": false
  },
  "permissions": {
    "voteSkipThreshold": 50,
    "voteStopThreshold": 66
  },
  "paths": {
    "ytdlp": "yt-dlp",
    "ffmpeg": "ffmpeg",
    "librespot": "librespot",
    "database": "./data/mafiadj.db"
  }
}
```

The `config.ts` module merges both sources at startup:
- `.env` → loaded via `dotenv`
- `config.json` → loaded and validated against `config.default.json`
- Missing keys fall back to defaults
- Invalid values logged as warnings, defaults used

### 6.2 `setup.sh` — One-Shot VM Provisioning

Run once on a fresh Debian/Ubuntu VM to install everything:

```bash
curl -sSL https://raw.githubusercontent.com/<repo>/main/scripts/setup.sh | sudo bash
# Or locally:
sudo bash scripts/setup.sh
```

**What it does:**
```
setup.sh
    │
    ├── 1. System update (apt update && upgrade)
    ├── 2. Install Node.js 20+ (NodeSource)
    ├── 3. Install FFmpeg
    ├── 4. Install yt-dlp (pip3 or direct download)
    ├── 5. Install build-essential, python3 (for native npm modules)
    ├── 6. Install Rust toolchain + build librespot
    ├── 7. Create 'mafiadj' system user
    ├── 8. Create /opt/mafiadj directory structure
    ├── 9. Clone/copy project files
    ├── 10. npm install (production dependencies)
    ├── 11. npm run build (compile TypeScript)
    ├── 12. Interactive prompt: enter Discord token, Spotify creds → writes .env
    ├── 13. Copy config.default.json → config.json
    ├── 14. Install systemd service file
    ├── 15. Install 'mafiadj' CLI to /usr/local/bin
    ├── 16. Run check-deps.sh to verify everything
    ├── 17. Enable + start the service
    │
    └── Done! "MafiaDJ is running. Use 'mafiadj status' to check."
```

### 6.3 `mafiadj` CLI — Management Tool

Installed to `/usr/local/bin/mafiadj` — usable from anywhere on the VM.

```bash
$ mafiadj help

  🎵 MafiaDJ — Bot Management CLI

  USAGE:  mafiadj <command> [options]

  SERVICE COMMANDS:
    start               Start the bot service
    stop                Stop the bot service
    restart             Restart the bot service
    status              Show service status (running/stopped, uptime, PID)

  LOGGING:
    logs                Tail live logs (journalctl -f)
    logs --lines 100    Show last N log lines
    logs --level error  Filter by log level
    logs --since today  Show logs since time period

  DEBUG:
    debug               Start bot in foreground with verbose logging (LOG_LEVEL=debug)
    debug --trace       Start with trace-level logging
    check               Verify all dependencies (yt-dlp, ffmpeg, librespot, node)

  CONFIGURATION:
    config show         Print current config.json (pretty-printed)
    config edit         Open config.json in $EDITOR (nano/vim)
    config set <key> <value>   Set a specific config value
                               e.g., mafiadj config set playback.defaultVolume 75
    config reset        Reset config.json to defaults
    config secrets      Interactive prompt to update .env credentials

  MAINTENANCE:
    update              Pull latest code, rebuild, restart service
    update --ytdlp      Update yt-dlp to latest version
    deploy-commands     Re-register slash commands with Discord
    db backup           Backup SQLite database to data/backups/
    db reset            Reset database (WARNING: deletes all data)

  INFO:
    version             Show MafiaDJ version
    info                Show system info (Node, yt-dlp, ffmpeg, librespot versions)
```

**Example usage:**
```bash
# Day-to-day
mafiadj status                          # Check if running
mafiadj logs                            # Tail live logs
mafiadj restart                         # Restart after config change

# Configuration
mafiadj config set playback.defaultVolume 75
mafiadj config set voice.autoDisconnectSeconds 600
mafiadj restart                         # Apply changes

# Debugging
mafiadj stop                            # Stop the service
mafiadj debug                           # Run in foreground with debug output
# Ctrl+C to stop, then:
mafiadj start                           # Back to background service

# Updating
mafiadj update                          # git pull + build + restart
mafiadj update --ytdlp                  # Update yt-dlp binary
mafiadj deploy-commands                 # Re-register slash commands

# Backup
mafiadj db backup                       # Snapshot database
```

### 6.4 Deployment Target

| Property | Value |
|----------|-------|
| **Hypervisor** | Proxmox VE |
| **VM OS** | Debian 12 / Ubuntu 22.04+ (recommended) |
| **Recommended Resources** | 1-2 vCPU, 1-2 GB RAM, 10 GB disk |
| **Development** | Windows (local dev + push to VM) |
| **Production** | Linux VM on Proxmox |
| **Install Location** | `/opt/mafiadj/` |
| **Service User** | `mafiadj` (restricted) |
| **Process Manager** | systemd |

### 6.5 Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create application → "MafiaDJ"
3. **Bot** tab → Create bot → Copy **Token**
4. Enable **Privileged Gateway Intents**: `GUILD_MEMBERS` (optional, for member display)
5. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Connect`, `Speak`, `Use Voice Activity`
6. Invite bot to your server

### 6.6 Spotify Setup
1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → Create app
2. Copy **Client ID** and **Client Secret**
3. These will be entered during `setup.sh` or via `mafiadj config secrets`

### 6.7 Deployment Workflow

```
┌──────────────────┐        ┌──────────────────┐
│  Windows (Dev)   │  SSH   │  Proxmox Linux   │
│                  │───────▶│  VM (Production)  │
│  Write code      │        │                  │
│  Test locally    │  git   │  /opt/mafiadj/   │
│  Push to repo    │  push  │  mafiadj CLI     │
└──────────────────┘        └──────────────────┘
```

**Standard update flow:**
```bash
# From the VM — single command:
mafiadj update
# This runs: git pull → npm install → npm run build → systemctl restart mafiadj
```

---

## 7. Branding

| Element | Value |
|---------|-------|
| **Name** | MafiaDJ |
| **Embed Color** | Deep purple `#7C3AED` |
| **Success Color** | Emerald `#10B981` |
| **Error Color** | Rose `#F43F5E` |
| **Warning Color** | Amber `#F59E0B` |
| **Idle State** | Dark embed, muted appearance |
| **Active State** | Vibrant embed with album art, full metadata |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Librespot stops working (Spotify protocol change) | Medium | High | YouTube fallback always available; keep librespot updated |
| yt-dlp breaks (YouTube changes) | Low | High | yt-dlp is actively maintained; `pip install --upgrade yt-dlp` |
| Discord API changes | Low | Medium | discord.js team maintains compatibility |
| VM resource exhaustion | Low | Medium | Lightweight stack (Node.js + SQLite); monitor with `htop` |
| Audio quality issues with PCM pipe | Low | Medium | Use 320kbps bitrate, proper FFmpeg encoding settings |
| Network latency from VM to Discord | Low | Low | Proxmox VM on local network; Discord voice is UDP-based |

---

*This is a living document. It will be updated as implementation progresses and decisions are refined.*
