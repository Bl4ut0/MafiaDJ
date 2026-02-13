#!/bin/bash

# setup.sh - One-shot provisioning for MafiaDJ on Debian/Ubuntu

set -e

echo "🎵 MafiaDJ Setup Script"
echo "========================"

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo bash setup.sh)"
  exit 1
fi

# 1. Update System
echo "[1/17] Updating system packages..."
apt update && apt upgrade -y

# 2. Install Node.js 20+
echo "[2/17] Installing Node.js 20+..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install FFmpeg
echo "[3/17] Installing FFmpeg..."
apt install -y ffmpeg

# 4. Install yt-dlp
echo "[4/17] Installing yt-dlp..."
apt install -y python3-pip
if ! command -v yt-dlp &> /dev/null; then
    pip3 install yt-dlp
fi
# Ensure it's in path or link it
if ! command -v yt-dlp &> /dev/null; then
    # Fallback to direct download if pip fails or path issues
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    chmod a+rx /usr/local/bin/yt-dlp
fi

# 5. Install build essentials
echo "[5/17] Installing build dependencies..."
apt install -y build-essential python3 pkg-config libasound2-dev

# 6. Install Rust & Librespot
echo "[6/17] Installing Rust and Librespot..."
if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

if ! command -v librespot &> /dev/null; then
    cargo install librespot
    # Make sure librespot is available globally or linked
    ln -sf $HOME/.cargo/bin/librespot /usr/local/bin/librespot
fi

# 7. Create mafiadj user
echo "[7/17] Creating system user 'mafiadj'..."
if ! id "mafiadj" &>/dev/null; then
    useradd -r -m -d /opt/mafiadj -s /bin/bash mafiadj
fi

# 8. Create directory structure
echo "[8/17] Setting up /opt/mafiadj..."
mkdir -p /opt/mafiadj
chown -R mafiadj:mafiadj /opt/mafiadj

# 9. Clone/Copy Project (Simple copy for local run, typically git clone)
# If running locally, assume current directory is the source
# We will skip this step if this script is just for env setup, 
# but usually we want to deploy.
echo "[9/17] (Skipped) Copying project files... (Do this via git or rsync)"

# 10. Install NPM dependencies
echo "[10/17] Installing NPM dependencies..."
cd /opt/mafiadj
# Assuming package.json is present
if [ -f "package.json" ]; then
    npm install
fi

# 11. Build
echo "[11/17] Building project..."
if [ -f "package.json" ]; then
    npm run build
fi

# 12. Env Setup (Interactive)
echo "[12/17] Setup .env..."
if [ ! -f ".env" ]; then
    read -p "Enter Discord Token: " DISCORD_TOKEN
    read -p "Enter Discord Client ID: " DISCORD_CLIENT_ID
    read -p "Enter Guild ID: " GUILD_ID
    read -p "Enter Spotify Client ID: " SPOTIFY_CLIENT_ID
    read -p "Enter Spotify Client Secret: " SPOTIFY_CLIENT_SECRET
    read -p "Enter Spotify Username: " SPOTIFY_USERNAME
    read -s -p "Enter Spotify Password: " SPOTIFY_PASSWORD
    echo ""

    cat <<EOT > .env
DISCORD_TOKEN=$DISCORD_TOKEN
DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID
GUILD_ID=$GUILD_ID
SPOTIFY_CLIENT_ID=$SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET=$SPOTIFY_CLIENT_SECRET
SPOTIFY_USERNAME=$SPOTIFY_USERNAME
SPOTIFY_PASSWORD=$SPOTIFY_PASSWORD
LOG_LEVEL=info
EOT
    chown mafiadj:mafiadj .env
    chmod 600 .env
fi

# 13. Config
echo "[13/17] Setting up config.json..."
if [ ! -f "config.json" ] && [ -f "config.default.json" ]; then
    cp config.default.json config.json
    chown mafiadj:mafiadj config.json
fi

# 14. Install Service
echo "[14/17] Installing systemd service..."
# Assuming mafiadj.service file exists in scripts/
if [ -f "scripts/mafiadj.service" ]; then
    cp scripts/mafiadj.service /etc/systemd/system/mafiadj.service
    systemctl daemon-reload
else
    # Create it if missing
    cat <<EOT > /etc/systemd/system/mafiadj.service
[Unit]
Description=MafiaDJ Discord Music Bot
After=network.target

[Service]
Type=simple
User=mafiadj
WorkingDirectory=/opt/mafiadj
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
EnvironmentFile=/opt/mafiadj/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mafiadj
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/mafiadj/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOT
    systemctl daemon-reload
fi

# 15. Install CLI
echo "[15/17] Installing 'mafiadj' CLI..."
if [ -f "scripts/mafiadj.sh" ]; then
    cp scripts/mafiadj.sh /usr/local/bin/mafiadj
    chmod +x /usr/local/bin/mafiadj
fi

# 16. Verify Deps
echo "[16/17] Verifying dependencies..."
# node scripts/check-deps.js # if it existed

# 17. Start Service
echo "[17/17] Starting MafiaDJ..."
systemctl enable mafiadj
systemctl start mafiadj

echo "✅ Setup Complete! Use 'mafiadj status' to check."
