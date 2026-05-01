# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source and compile
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine

# Add a non-root user
RUN addgroup -g 1001 -S baikal && \
    adduser -S baikal -u 1001 -G baikal

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/dist dist/

# Copy package.json for metadata
COPY package.json package-lock.json ./

# Copy the officecli binary (needed by MS-Office skill)
COPY --chown=baikal:baikal bin/ bin/

# Create directories that will be mounted as volumes,
# with proper permissions so the non-root user can write to them
RUN mkdir -p /app/data /app/memory /app/tools /app/skills && \
    chown -R baikal:baikal /app

# Switch to non-root user
USER baikal

# Environment variables (override at runtime via docker-compose)
ENV NODE_ENV=production

# Volumes for user-managed directories
VOLUME ["/app/tools", "/app/skills", "/app/memory", "/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "process.exit(typeof process.env.TELEGRAM_BOT_TOKEN === 'string' ? 0 : 1)" || exit 1

CMD ["node", "dist/index.js"]
