# ============================================================================
# MPLP Growth Runtime — Production Dockerfile
# Multi-stage build: builder (compile TS) → runner (slim prod image)
# ============================================================================

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:20-alpine
WORKDIR /app

# Install curl for healthcheck (not in alpine by default)
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

# Compiled JS output
COPY --from=builder /app/dist ./dist

# Static UI assets (served by Fastify)
COPY src/ui-static ./src/ui-static

# Persistent data directory
RUN mkdir -p /data && chown -R node:node /data

# ---------------------------------------------------------------------------
# Environment defaults (overridable via docker-compose or docker run -e)
# Runner starts DISABLED by default — founder enables explicitly
# ---------------------------------------------------------------------------
ENV MPLP_GROWTH_STATE_DIR=/data
ENV RUNNER_ENABLED=false
ENV POLICY_LEVEL=safe
ENV AUTO_PUBLISH=false
ENV NODE_ENV=production

EXPOSE 3000

# Healthcheck: curl /api/health every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

USER node
CMD ["node", "dist/commands/cli.js", "serve"]
