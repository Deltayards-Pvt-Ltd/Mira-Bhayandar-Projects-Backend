# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .

RUN mkdir -p logs uploads && chown -R nodeuser:nodejs logs uploads

USER nodeuser

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "\
    require('http').get('http://127.0.0.1:5003/health', (r) => { \
      r.statusCode === 200 ? process.exit(0) : process.exit(1); \
    }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
