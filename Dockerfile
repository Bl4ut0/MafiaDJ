# Multi-stage build for MafiaDJ
# Stage 1: Build TypeScript
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools for native npm modules (e.g. better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ gcc curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# Stage 2: Production runner
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime dependencies: ffmpeg, python3, curl, ca-certificates, wget, tar, libasound2
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    wget \
    tar \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install librespot binary (v0.8.0 release for linux x86_64)
RUN curl -L https://github.com/librespot-org/librespot/releases/download/v0.8.0/librespot-v0.8.0-linux-x86_64.tar.gz | tar -xz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/librespot || true

COPY package*.json ./

# Copy pre-compiled node_modules, JavaScript dist, and static assets from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY src/dashboard/public ./src/dashboard/public

# Create directories for persistent data & cache
RUN mkdir -p /app/data /app/spotify_cache

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
