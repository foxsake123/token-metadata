# Dockerfile for $LIST Token Automation
FROM node:20-alpine

WORKDIR /app

# Copy all config files first
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies (ignore prepublish script, we'll build manually)
RUN npm install --ignore-scripts --legacy-peer-deps

# Copy source
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
