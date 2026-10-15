FROM node:20-slim

WORKDIR /app

# Copy all package files
COPY package*.json ./

# Install all dependencies (including dev deps for build)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs

EXPOSE 3000

# Start the bot
CMD ["node", "dist/live.js"]
