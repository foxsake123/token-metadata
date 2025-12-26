# Dockerfile for $LIST Token Automation
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist/ ./dist/
COPY src/ ./src/

# Environment variables (set at runtime)
ENV NODE_ENV=production
ENV SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Health check endpoint
EXPOSE 3000

# Run scheduler
CMD ["node", "dist/automation/scheduler.js"]
