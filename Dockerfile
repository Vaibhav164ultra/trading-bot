# Multi-stage build for production
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY ecosystem.config.js ./

# Create logs directory
RUN mkdir -p logs

# Non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start with PM2
CMD ["pm2", "start", "ecosystem.config.js"]
