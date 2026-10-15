FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Create logs directory
RUN mkdir -p logs

# Copy PM2 config
COPY ecosystem.config.js ./

EXPOSE 3000

# Start with Node directly (no PM2 needed on cloud)
CMD ["node", "dist/live.js"]
