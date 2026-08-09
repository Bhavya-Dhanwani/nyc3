# ==============================================================================
# Stage 1: Build Client Frontend (React + Vite SPA)
# ==============================================================================
FROM node:22-bookworm-slim AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci || npm install

COPY client/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Build Server Backend (TypeScript -> JavaScript)
# ==============================================================================
FROM node:22-bookworm-slim AS server-builder

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci || npm install

COPY server/ ./
RUN npm run build

# ==============================================================================
# Stage 3: Production Runtime (Pure Node.js + FFmpeg + Chromium)
# ==============================================================================
FROM node:22-bookworm-slim AS production

# Install essential system tools for video processing and Remotion:
# - ffmpeg: Audio/video extraction, slicing, filtering, and encoding
# - chromium: Headless browser for Remotion React video rendering
# - fontconfig & fonts: Typography rendering for video subtitles/captions
# - dumb-init: PID 1 signal forwarding for clean Docker graceful shutdown
# - wget: Lightweight healthcheck utility
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    fontconfig \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    fonts-noto-cjk \
    dumb-init \
    wget \
    ca-certificates \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir --break-system-packages openai-whisper \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure Puppeteer / Chromium paths for Remotion renderer
ENV NODE_ENV=production \
    PORT=5000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROMIUM_PATH=/usr/bin/chromium \
    XDG_CACHE_HOME=/app/.cache \
    WHISPER_MODEL=base

# Install production node dependencies only
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy compiled server code from builder
COPY --from=server-builder /app/server/dist ./dist

# Copy Remotion JSX/TSX composition components (bundled dynamically at runtime by @remotion/bundler)
COPY server/src/shared/remotion ./src/shared/remotion

# Copy built frontend SPA assets to serve statically through Express
COPY --from=client-builder /app/client/dist ./public

# Ensure upload and processing scratch directories exist
RUN mkdir -p uploads/projects uploads/temp

EXPOSE 5000

# Healthcheck to verify Express API availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:5000/api/health || exit 1

# dumb-init handles PID 1 signal forwarding for clean graceful shutdowns (SIGTERM / SIGINT)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
