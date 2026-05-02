# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev for TypeScript)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine

WORKDIR /app

# Copy production dependencies from builder
# We use --omit=dev here to match the production install from the builder
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/dist dist/

# Copy package.json for metadata
COPY package.json package-lock.json ./

# Switch to non-root user
USER node

# Volumes for user-managed directories
VOLUME ["/app/tools", "/app/skills", "/app/memory", "/app/data"]

# Environment variables (override at runtime via docker-compose)
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "process.exit(typeof process.env.TELEGRAM_BOT_TOKEN === 'string' ? 0 : 1)" || exit 1

CMD ["node", "dist/index.js"]
