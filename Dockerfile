# Dockerfile for $LIST Token Automation
FROM node:20-alpine

WORKDIR /app

# Install all dependencies (including dev for build)
COPY package*.json ./
RUN npm ci

# Copy source and config
COPY tsconfig*.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Environment variables (set at runtime)
ENV NODE_ENV=production
ENV SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Health check endpoint
EXPOSE 3000

# Run server
CMD ["node", "dist/main/automation/server.js"]
