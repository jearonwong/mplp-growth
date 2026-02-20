FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Explicitly copy static UI assets
COPY src/ui-static ./src/ui-static

# Create explicit data directory
RUN mkdir -p /data && chown -R node:node /data

ENV MPLP_GROWTH_STATE_DIR=/data
EXPOSE 3000

USER node
CMD ["node", "dist/commands/cli.js", "serve"]
