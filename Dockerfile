FROM node:22-bookworm-slim AS app-builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

ARG YTDLP_VERSION=2026.06.09
ARG YTDLP_SHA256=e5d57466682cfa9d61e9cf7c8a4f09b00f4a62af37d3bbdc4bcffdf63615feac

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --location --proto '=https' --tlsv1.2 \
        "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
        --output /usr/local/bin/yt-dlp \
    && echo "${YTDLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum --check --strict \
    && chmod 0755 /usr/local/bin/yt-dlp \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin mafiadj

COPY --chown=mafiadj:mafiadj package*.json config.json ./
COPY --chown=mafiadj:mafiadj --from=app-builder /app/node_modules ./node_modules
COPY --chown=mafiadj:mafiadj --from=app-builder /app/dist ./dist
COPY --chown=mafiadj:mafiadj src/dashboard/public ./dist/dashboard/public

RUN mkdir -p /app/data \
    && chown -R mafiadj:mafiadj /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DASHBOARD_HOST=0.0.0.0

USER mafiadj
EXPOSE 3000

CMD ["node", "dist/index.js"]
