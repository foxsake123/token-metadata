# Deploying $LIST Automation to Railway

## Quick Start

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```

### 3. Initialize Project
```bash
cd C:\Users\shorg\list-token\shorg
railway init
```
Select "Empty Project" when prompted.

### 4. Set Environment Variables
```bash
railway variables set SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
railway variables set TWITTER_API_KEY="your-key"
railway variables set TWITTER_API_SECRET="your-secret"
railway variables set TWITTER_ACCESS_TOKEN="your-token"
railway variables set TWITTER_ACCESS_SECRET="your-token-secret"
railway variables set BURN_AUTHORITY_SECRET="your-wallet-private-key"
railway variables set POLL_INTERVAL="60000"
railway variables set DRY_RUN="false"
```

### 5. Deploy
```bash
railway up
```

### 6. Check Status
```bash
railway logs
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `TWITTER_API_KEY` | Yes | Twitter API key |
| `TWITTER_API_SECRET` | Yes | Twitter API secret |
| `TWITTER_ACCESS_TOKEN` | Yes | Twitter access token |
| `TWITTER_ACCESS_SECRET` | Yes | Twitter access token secret |
| `BURN_AUTHORITY_SECRET` | No | Wallet private key for auto-burns |
| `POLL_INTERVAL` | No | Check interval in ms (default: 60000) |
| `DRY_RUN` | No | Set to "true" for testing |
| `PORT` | No | Health check port (default: 3000) |

---

## What It Does

1. **Monitors Polymarket** every minute for new name confirmations
2. **Auto-tweets** when a new name is confirmed
3. **Executes burns** automatically (if wallet is configured)
4. **Posts confirmation** tweet with TX link

---

## Health Check

The service exposes a health endpoint:
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "list-token-automation",
  "uptime": 12345.67,
  "timestamp": "2024-12-26T12:00:00.000Z"
}
```

---

## Logs

View live logs:
```bash
railway logs --tail
```

---

## Stopping/Restarting

```bash
# Stop
railway down

# Restart
railway up
```

---

## Alternative: Run Locally

```bash
# Development mode
npm run dev

# Or with PM2 for production-like local run
npm install -g pm2
pm2 start npm --name "list-automation" -- run dev
pm2 logs list-automation
```
