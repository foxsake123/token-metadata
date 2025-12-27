/**
 * LIST Token Automation Server
 *
 * Runs the scheduler with a health check endpoint for Railway/Vercel
 */

import 'dotenv/config';
import http from 'http';
import { BurnScheduler } from './scheduler';
import { TwitterClient } from './twitter';

// Environment variable validation
interface EnvConfig {
  PORT: number;
  POLL_INTERVAL: number;
  DRY_RUN: boolean;
  SOLANA_RPC_URL: string;
  twitterConfigured: boolean;
  burnAuthorityConfigured: boolean;
}

function validateEnv(): EnvConfig {
  const warnings: string[] = [];

  // Required for production burns
  if (!process.env.SOLANA_RPC_URL) {
    warnings.push('SOLANA_RPC_URL not set - using public RPC (rate limited)');
  }

  // Optional but recommended
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    warnings.push('Twitter API credentials not fully configured');
  }

  if (!process.env.BURN_AUTHORITY_SECRET) {
    warnings.push('BURN_AUTHORITY_SECRET not set - burns require manual execution');
  }

  // Log warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Environment Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('');
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL || '60000', 10),
    DRY_RUN: process.env.DRY_RUN === 'true',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    twitterConfigured: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
    burnAuthorityConfigured: !!process.env.BURN_AUTHORITY_SECRET,
  };
}

const config = validateEnv();
const PORT = config.PORT;
const POLL_INTERVAL = config.POLL_INTERVAL;
const DRY_RUN = config.DRY_RUN;

// Health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'list-token-automation',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start scheduler
async function main() {
  console.log('═'.repeat(60));
  console.log('  $LIST TOKEN AUTOMATION SERVER');
  console.log('  "The more names drop. The more $LIST pops."');
  console.log('═'.repeat(60));
  console.log('');

  // Check Twitter config
  const twitter = new TwitterClient(undefined, DRY_RUN);
  if (twitter.isConfigured()) {
    console.log('✅ Twitter API configured');
  } else {
    console.log('⚠️  Twitter API not configured - tweets will be skipped');
  }

  // Check Solana config
  if (process.env.BURN_AUTHORITY_SECRET) {
    console.log('✅ Burn authority configured');
  } else {
    console.log('⚠️  Burn authority not configured - burns will require manual execution');
  }

  console.log(`📡 Poll interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`🔧 Dry run mode: ${DRY_RUN}`);
  console.log('');

  // Start health check server
  server.listen(PORT, () => {
    console.log(`🏥 Health check server running on port ${PORT}`);
  });

  // Initialize scheduler
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const scheduler = new BurnScheduler(rpcUrl);

  // Set up callbacks
  scheduler.onBurnDetected = async (target) => {
    console.log(`🎯 Burn detected: ${target.name} (${target.burnAllocationPercent}%)`);

    if (twitter.isConfigured() && !DRY_RUN) {
      const tweet = `🔥 BURN INCOMING 🔥

${target.name} has been CONFIRMED on the Epstein list!

${target.burnAllocationPercent}% burn executing...

#LIST #Solana`;

      await twitter.postTweet(tweet);
    }
  };

  scheduler.onBurnExecuted = async (target, signature) => {
    console.log(`✅ Burn executed: ${target.name} - TX: ${signature}`);

    if (twitter.isConfigured() && !DRY_RUN) {
      const tweet = `🔥 BURN EXECUTED 🔥

${target.name}: ${target.burnAllocationPercent}% BURNED

TX: solscan.io/tx/${signature}

Supply reduced. Value increased.

#LIST #Solana #TokenBurn`;

      await twitter.postTweet(tweet);
    }
  };

  // Start monitoring
  console.log('🚀 Starting Polymarket monitor...');
  console.log('');

  scheduler.start(POLL_INTERVAL);

  // Keep alive
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    scheduler.stop();
    server.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    scheduler.stop();
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
