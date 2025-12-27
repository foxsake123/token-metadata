/**
 * LIST Token Automation Server
 *
 * Runs the scheduler with a health check endpoint for Railway/Vercel
 */

import 'dotenv/config';
import http from 'http';
import { BurnScheduler } from './scheduler';
import { TwitterClient } from './twitter';
import { getStorageStats, getPendingBurns, getExecutedBurns } from './storage';
import { ContentCalendar, TweetGenerator } from './social';
import { EPSTEIN_ACTIVE_BURNS } from '../burn/config';
import { DiscordWebhook } from './discord';
import { getHolderCount, getDailyVolume, checkHolderMilestones, checkVolumeMilestones } from './holders';

// Environment variable validation
interface EnvConfig {
  PORT: number;
  POLL_INTERVAL: number;
  DRY_RUN: boolean;
  SOLANA_RPC_URL: string;
  twitterConfigured: boolean;
  burnAuthorityConfigured: boolean;
  discordConfigured: boolean;
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

  if (!process.env.DISCORD_WEBHOOK_URL) {
    warnings.push('DISCORD_WEBHOOK_URL not set - Discord notifications disabled');
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
    discordConfigured: !!process.env.DISCORD_WEBHOOK_URL,
  };
}

const config = validateEnv();
const PORT = config.PORT;
const POLL_INTERVAL = config.POLL_INTERVAL;
const DRY_RUN = config.DRY_RUN;

// Scheduler reference for health check
let scheduler: BurnScheduler | null = null;

// Content calendar for scheduled tweets
const contentCalendar = new ContentCalendar();
let lastTweetCheck = new Date();
let tweetStats = {
  totalPosted: 0,
  lastPosted: null as Date | null,
  lastError: null as string | null,
};

// Health check server with detailed status
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' || req.url === '/') {
    const storageStats = getStorageStats();
    const pendingApprovals = scheduler?.getPendingApprovals() || [];
    const summary = scheduler?.getSummary();

    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'list-token-automation',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      config: {
        dryRun: DRY_RUN,
        pollInterval: POLL_INTERVAL,
        twitterConfigured: config.twitterConfigured,
        discordConfigured: config.discordConfigured,
        burnAuthorityConfigured: config.burnAuthorityConfigured,
        requiresConfirmation: scheduler?.requiresConfirmation ?? true,
      },
      storage: storageStats,
      scheduler: summary ? {
        owedBurns: summary.owed.length,
        scheduledBurns: summary.scheduled.length,
        executedBurns: summary.executed.length,
        totalOwedPercent: summary.totalOwedPercent,
        totalExecutedPercent: summary.totalExecutedPercent,
      } : null,
      pendingApprovals: pendingApprovals.map(b => ({
        slug: b.target.slug,
        name: b.target.name,
        percent: b.target.burnAllocationPercent,
        scheduledFor: b.scheduledFor.toISOString(),
      })),
    }, null, 2));
  } else if (req.url === '/burns') {
    // Detailed burns endpoint
    const pending = getPendingBurns();
    const executed = getExecutedBurns();

    res.writeHead(200);
    res.end(JSON.stringify({
      pending,
      executed,
      total: pending.length + executed.length,
    }, null, 2));
  } else if (req.url === '/approvals') {
    // Pending approvals endpoint
    const pendingApprovals = scheduler?.getPendingApprovals() || [];

    res.writeHead(200);
    res.end(JSON.stringify({
      requiresConfirmation: scheduler?.requiresConfirmation ?? true,
      pendingApprovals: pendingApprovals.map(b => ({
        slug: b.target.slug,
        name: b.target.name,
        percent: b.target.burnAllocationPercent,
        scheduledFor: b.scheduledFor.toISOString(),
      })),
      count: pendingApprovals.length,
    }, null, 2));
  } else if (req.url === '/tweets') {
    // Upcoming scheduled tweets
    const upcoming = contentCalendar.getUpcoming(10);
    const due = contentCalendar.getDuePosts();

    res.writeHead(200);
    res.end(JSON.stringify({
      stats: {
        ...tweetStats,
        lastCheck: lastTweetCheck.toISOString(),
        dryRun: DRY_RUN,
        twitterConfigured: config.twitterConfigured,
      },
      due: due.map(p => ({
        content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
        type: p.type,
        scheduledFor: p.scheduledFor.toISOString(),
      })),
      upcoming: upcoming.map(p => ({
        content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
        type: p.type,
        scheduledFor: p.scheduledFor.toISOString(),
      })),
    }, null, 2));
  } else if (req.url === '/tweet/odds' && req.method === 'POST') {
    // Manual trigger: Post odds update
    handleManualTweet(res, 'odds');
  } else if (req.url === '/tweet/engagement' && req.method === 'POST') {
    // Manual trigger: Post engagement tweet
    handleManualTweet(res, 'engagement');
  } else if (req.url === '/tweet/fomo' && req.method === 'POST') {
    // Manual trigger: Post FOMO tweet
    handleManualTweet(res, 'fomo');
  } else if (req.url === '/metrics') {
    // Token metrics: holders, volume, milestones
    handleMetrics(res);
  } else if (req.url?.startsWith('/admin/approve/') && req.method === 'POST') {
    // Admin: Approve a pending burn
    const slug = req.url.replace('/admin/approve/', '');
    handleAdminApprove(req, res, slug);
  } else if (req.url?.startsWith('/admin/reject/') && req.method === 'POST') {
    // Admin: Reject a pending burn
    const slug = req.url.replace('/admin/reject/', '');
    handleAdminReject(req, res, slug);
  } else if (req.url === '/admin/status') {
    // Admin: Get full system status
    handleAdminStatus(res);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Twitter client (initialized in main)
let twitter: TwitterClient | null = null;

// Discord webhook client
const discord = new DiscordWebhook();

// Handle metrics endpoint
async function handleMetrics(res: http.ServerResponse) {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  try {
    const [holderData, volumeData] = await Promise.all([
      getHolderCount(rpcUrl),
      getDailyVolume(),
    ]);

    const holderMilestones = checkHolderMilestones(holderData.count);
    const volumeMilestones = checkVolumeMilestones(volumeData.daily24h);

    res.writeHead(200);
    res.end(JSON.stringify({
      holders: {
        count: holderData.count,
        fetchedAt: holderData.fetchedAt.toISOString(),
        error: holderData.error,
        milestones: holderMilestones,
      },
      volume: {
        daily24h: volumeData.daily24h,
        fetchedAt: volumeData.fetchedAt.toISOString(),
        error: volumeData.error,
        milestones: volumeMilestones,
      },
      note: 'Accurate metrics require Helius/Shyft/Birdeye API integration',
    }, null, 2));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    res.writeHead(500);
    res.end(JSON.stringify({ error: errorMsg }));
  }
}

// Validate admin API key
function validateAdminKey(req: http.IncomingMessage): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    // If no key configured, allow access (dev mode)
    console.warn('⚠️ ADMIN_API_KEY not set - admin endpoints unprotected');
    return true;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;

  const providedKey = authHeader.replace('Bearer ', '');
  return providedKey === adminKey;
}

// Handle admin approve endpoint
function handleAdminApprove(req: http.IncomingMessage, res: http.ServerResponse, slug: string) {
  if (!validateAdminKey(req)) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized - provide valid ADMIN_API_KEY' }));
    return;
  }

  if (!scheduler) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Scheduler not initialized' }));
    return;
  }

  const success = scheduler.approveBurn(slug);

  if (success) {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      message: `Approved burn for: ${slug}`,
      note: 'Burn will execute on next scheduler cycle',
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: `No pending approval found for: ${slug}`,
      hint: 'Check /approvals for pending burns',
    }));
  }
}

// Handle admin reject endpoint
function handleAdminReject(req: http.IncomingMessage, res: http.ServerResponse, slug: string) {
  if (!validateAdminKey(req)) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized - provide valid ADMIN_API_KEY' }));
    return;
  }

  if (!scheduler) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Scheduler not initialized' }));
    return;
  }

  const success = scheduler.rejectBurn(slug);

  if (success) {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      message: `Rejected burn for: ${slug}`,
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: `No pending approval found for: ${slug}`,
      hint: 'Check /approvals for pending burns',
    }));
  }
}

// Handle admin status endpoint
function handleAdminStatus(res: http.ServerResponse) {
  const storageStats = getStorageStats();
  const pendingApprovals = scheduler?.getPendingApprovals() || [];
  const summary = scheduler?.getSummary();

  res.writeHead(200);
  res.end(JSON.stringify({
    server: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dryRun: DRY_RUN,
    },
    twitter: {
      configured: config.twitterConfigured,
      stats: tweetStats,
    },
    discord: {
      configured: config.discordConfigured,
    },
    scheduler: summary ? {
      owedBurns: summary.owed.length,
      scheduledBurns: summary.scheduled.length,
      executedBurns: summary.executed.length,
      totalOwedPercent: summary.totalOwedPercent,
      totalExecutedPercent: summary.totalExecutedPercent,
    } : null,
    storage: storageStats,
    pendingApprovals: pendingApprovals.map(b => ({
      slug: b.target.slug,
      name: b.target.name,
      percent: b.target.burnAllocationPercent,
    })),
  }, null, 2));
}

// Handle manual tweet triggers
async function handleManualTweet(res: http.ServerResponse, type: 'odds' | 'engagement' | 'fomo') {
  if (!twitter) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Twitter client not initialized' }));
    return;
  }

  try {
    let tweet;
    switch (type) {
      case 'odds':
        tweet = TweetGenerator.oddsUpdate(EPSTEIN_ACTIVE_BURNS);
        break;
      case 'engagement':
        tweet = TweetGenerator.engagement(25, 19, EPSTEIN_ACTIVE_BURNS[0]?.name);
        break;
      case 'fomo':
        tweet = TweetGenerator.fomo();
        break;
    }

    const result = await twitter.postTweet(tweet.content);

    if (result.success) {
      tweetStats.totalPosted++;
      tweetStats.lastPosted = new Date();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        type,
        tweetId: result.tweetId,
        content: tweet.content,
      }, null, 2));
    } else {
      tweetStats.lastError = result.error || 'Unknown error';
      res.writeHead(500);
      res.end(JSON.stringify({ error: result.error }));
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    tweetStats.lastError = errorMsg;
    res.writeHead(500);
    res.end(JSON.stringify({ error: errorMsg }));
  }
}

// Check and post scheduled content
async function checkScheduledContent() {
  if (!twitter || !twitter.isConfigured()) {
    return;
  }

  lastTweetCheck = new Date();
  const duePosts = contentCalendar.getDuePosts();

  for (const post of duePosts) {
    try {
      console.log(`📤 Posting scheduled ${post.type} tweet...`);
      const result = await twitter.postTweet(post.content);

      if (result.success) {
        contentCalendar.markPosted(post, result.tweetId);
        tweetStats.totalPosted++;
        tweetStats.lastPosted = new Date();
        console.log(`✅ Tweet posted: ${result.tweetId}`);
      } else {
        tweetStats.lastError = result.error || 'Unknown error';
        console.error(`❌ Tweet failed: ${result.error}`);
      }

      // Rate limit: wait 1 second between tweets
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      tweetStats.lastError = errorMsg;
      console.error(`❌ Tweet error: ${errorMsg}`);
    }
  }
}

// Start scheduler
async function main() {
  console.log('═'.repeat(60));
  console.log('  $LIST TOKEN AUTOMATION SERVER');
  console.log('  "The more names drop. The more $LIST pops."');
  console.log('═'.repeat(60));
  console.log('');

  // Check Twitter config
  twitter = new TwitterClient(undefined, DRY_RUN);
  if (twitter.isConfigured()) {
    console.log('✅ Twitter API configured');
  } else {
    console.log('⚠️  Twitter API not configured - tweets will be skipped');
  }

  // Generate content calendar
  const scheduledPosts = contentCalendar.generateWeeklyContent();
  console.log(`📅 Content calendar: ${scheduledPosts.length} posts scheduled for this week`);

  // Check Discord config
  if (discord.isConfigured()) {
    console.log('✅ Discord webhook configured');
  } else {
    console.log('⚠️  Discord webhook not configured - Discord notifications disabled');
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
  scheduler = new BurnScheduler({
    rpcUrl,
    requireConfirmation: true, // Require manual approval for burns in production
    autoExecute: false,
  });

  // Set up callbacks
  scheduler.onBurnPendingApproval = async (target) => {
    console.log(`🔔 Burn pending approval: ${target.name} (${target.burnAllocationPercent}%)`);
    console.log(`   Use /approvals endpoint to view pending burns`);

    // Send Discord notification
    await discord.sendBurnPendingApproval(target.name, target.burnAllocationPercent);
  };

  scheduler.onBurnDetected = async (target) => {
    console.log(`🎯 Burn detected: ${target.name} (${target.burnAllocationPercent}%)`);

    // Send Discord notification
    await discord.sendBurnDetected(target.name, target.burnAllocationPercent);

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

    // Send Discord notification
    await discord.sendBurnExecuted(target.name, target.burnAllocationPercent, signature);

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

  // Start scheduled content posting (check every 5 minutes)
  const CONTENT_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  setInterval(() => {
    checkScheduledContent().catch(err => {
      console.error('❌ Content check error:', err);
    });
  }, CONTENT_CHECK_INTERVAL);
  console.log(`📤 Scheduled tweet checker running every ${CONTENT_CHECK_INTERVAL / 1000 / 60} minutes`);

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
