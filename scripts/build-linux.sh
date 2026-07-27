#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
RELEASE_DIR="release_linux_$TIMESTAMP"

echo "Starting Linux Build Process..."

# --- 0. Pre-flight Checks ---
echo "Checking build environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    exit 1
fi

# Check Cargo
if ! command -v cargo &> /dev/null; then
    echo "⚠️ Warning: Rust (cargo) is not installed."
    if [ ! -f "./bin/librespot" ]; then
        echo "   We need to build librespot, but Rust is missing."
        echo "   Install it with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        echo "   Or install via your package manager (e.g., sudo apt install cargo)"
        echo "   Continuing (librespot build will be skipped)..."
        sleep 3
    fi
else
    echo "✅ Rust/Cargo found."
fi

# Check ALSA headers (libasound2-dev) for librespot
if ! pkg-config --exists alsa 2>/dev/null; then
     echo "⚠️ Warning: ALSA development headers not found (pkg-config alsa failed)."
     echo "   'librespot' compilation usually requires: build-essential libasound2-dev pkg-config libssl-dev"
     echo "   On Ubuntu/Debian: sudo apt install build-essential libasound2-dev pkg-config libssl-dev"
fi

# 1. Cleanup
if [ -d "$RELEASE_DIR" ]; then
    rm -rf "$RELEASE_DIR"
fi
mkdir -p "$RELEASE_DIR/bin"

# 2. Build TypeScript
echo "Compiling TypeScript..."
npm run build

# 2b. Patch @discordjs/voice
VOICE_DIST="node_modules/@discordjs/voice/dist/index.js"
if [ -f "$VOICE_DIST" ]; then
    sed -i 's/await import("@snazzah\/davey")/require("@snazzah\/davey")/g' "$VOICE_DIST"
    echo "   - Patched @discordjs/voice for pkg compatibility"
fi

# 3. Package
echo "Packaging executable..."
if [ ! -f "./node_modules/.bin/pkg" ]; then
    echo "Error: pkg binary not found."
    exit 1
fi
./node_modules/.bin/pkg . --targets node18-linux-x64 --output "$RELEASE_DIR/mafiadj" --compress GZip

# 4. Copy Config
echo "Copying config..."
if [ -f ".env" ]; then
    cp .env "$RELEASE_DIR/.env"
else
    cp .env.example "$RELEASE_DIR/.env"
    echo "   - Copied .env.example"
fi
cp config.json "$RELEASE_DIR/config.json"

# 5. Check & Download Dependencies
echo "Checking dependencies..."
BIN_DIR="./bin"
mkdir -p "$BIN_DIR"

# yt-dlp
if [ ! -f "$BIN_DIR/yt-dlp" ]; then
    echo "Downloading yt-dlp..."
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"
    chmod +x "$BIN_DIR/yt-dlp"
fi

# ffmpeg (Using package manager is preferred, but here we can check or download static build)
if [ ! -f "$BIN_DIR/ffmpeg" ]; then
    echo "Checking for ffmpeg..."
    if command -v ffmpeg &> /dev/null; then
        echo "ffmpeg found in PATH. Copying to bin..."
        cp "$(command -v ffmpeg)" "$BIN_DIR/ffmpeg"
    else
        echo "Downloading ffmpeg static build..."
        curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o "$BIN_DIR/ffmpeg.tar.xz"
        tar -xf "$BIN_DIR/ffmpeg.tar.xz" -C "$BIN_DIR"
        # Move binary and cleanup
        find "$BIN_DIR" -name "ffmpeg" -type f -exec mv {} "$BIN_DIR/ffmpeg" \;
        rm -rf "$BIN_DIR/ffmpeg.tar.xz" "$BIN_DIR/ffmpeg-*-amd64-static"
        echo "ffmpeg installed."
    fi
fi

# librespot
if [ ! -f "$BIN_DIR/librespot" ]; then
    echo "Checking for librespot..."
    if command -v cargo &> /dev/null; then
        echo "Building librespot from source (Cargo)..."
        cargo install librespot --root "$BIN_DIR/temp_cargo" --force
        mv "$BIN_DIR/temp_cargo/bin/librespot" "$BIN_DIR/librespot"
        rm -rf "$BIN_DIR/temp_cargo"
        echo "librespot built."
    else
        echo "Warning: librespot not found and cargo is missing. Native Spotify disabled."
    fi
fi

# Bundle
cp "$BIN_DIR/yt-dlp" "$RELEASE_DIR/bin/"
cp "$BIN_DIR/ffmpeg" "$RELEASE_DIR/bin/"
if [ -f "$BIN_DIR/librespot" ]; then
    cp "$BIN_DIR/librespot" "$RELEASE_DIR/bin/"
fi

# 6. Run Script
cat <<EOT > "$RELEASE_DIR/start.sh"
#!/bin/bash
export PATH="\$PWD/bin:\$PATH"
chmod +x ./bin/*
./mafiadj
EOT
chmod +x "$RELEASE_DIR/start.sh"

echo ""
echo "Linux Build Complete!"
echo "Output: $RELEASE_DIR/"
