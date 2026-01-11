/**
 * LIST Token Admin Bot
 *
 * Combines burn alerts + admin functions for rewards management
 *
 * PUBLIC COMMANDS:
 * /burns, /pending, /stats, /price, /about
 *
 * ADMIN COMMANDS (only work for ADMIN_USER_ID):
 * /register <wallet> <twitter> - Register new person
 * /raid @twitter <url> [thread|viral] - Quick log raid (looks up wallet)
 * /addambassador <wallet> <twitter> <tier> - Add with tier (bronze/silver/gold)
 * /addref <new_wallet> <referrer_wallet> <amount> - Log referral
 * /meme <wallet> <amount> - Log meme contest winner
 * /payouts - Preview pending payouts
 * /ambassadors - List all ambassadors
 * /raids - List unpaid raid contributions
 * /refs - List pending referrals
 * /status - Full rewards status
 *
 * Run: npx ts-node src/telegram-bot/admin-bot.ts
 */

import TelegramBot, { Message } from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import {
  EPSTEIN_RESOLVED_BURNS,
  EPSTEIN_ACTIVE_BURNS,
  TOTAL_SUPPLY,
  calculateBurnAmount,
  formatBurnAmount,
} from '../burn/config';

dotenv.config();

// Simple HTTPS fetch with caching
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function fetchJson(url: string): Promise<any> {
  // Check cache first
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Store in cache
          apiCache.set(url, { data: parsed, timestamp: Date.now() });
          resolve(parsed);
        } catch (e) {
          console.error('JSON parse error:', e);
          reject(e);
        }
      });
    }).on('error', (err) => {
      console.error('Fetch error:', err);
      reject(err);
    });
  });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_ID; // Your Telegram user ID

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Debug: log all incoming messages
bot.on('message', (msg) => {
  console.log(`📩 Message from ${msg.from?.username || msg.from?.id}: ${msg.text}`);
});
const REWARDS_FILE = path.join(__dirname, '..', '..', 'data', 'rewards-tracker.json');

console.log('🤖 LIST Admin Bot started!');
if (ADMIN_USER_ID) {
  console.log(`👑 Admin ID: ${ADMIN_USER_ID}`);
} else {
  console.log('⚠️ No TELEGRAM_ADMIN_ID set - admin commands disabled');
  console.log('   Add your Telegram user ID to .env to enable admin features');
}

// ============================================================================
// HELPERS
// ============================================================================

function isAdmin(msg: Message): boolean {
  if (!ADMIN_USER_ID) return false;
  return msg.from?.id.toString() === ADMIN_USER_ID;
}

// Input validation
function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded, 32-44 characters
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isValidTwitterHandle(handle: string): boolean {
  const cleaned = handle.replace('@', '');
  return /^[A-Za-z0-9_]{1,15}$/.test(cleaned);
}

function isValidAmount(amount: number, min = 1, max = 1000000): boolean {
  return !isNaN(amount) && amount >= min && amount <= max;
}

function loadRewards(): any {
  try {
    const data = fs.readFileSync(REWARDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading rewards:', error);
    throw error;
  }
}

function saveRewards(data: any): void {
  try {
    const tempFile = `${REWARDS_FILE}.tmp`;
    const backupFile = `${REWARDS_FILE}.backup`;

    // Write to temp file first
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));

    // Backup existing file
    if (fs.existsSync(REWARDS_FILE)) {
      fs.copyFileSync(REWARDS_FILE, backupFile);
    }

    // Atomic rename
    fs.renameSync(tempFile, REWARDS_FILE);
  } catch (error) {
    console.error('Error saving rewards:', error);
    throw error;
  }
}

// ============================================================================
// PUBLIC COMMANDS
// ============================================================================

bot.onText(/\/start/, (msg: Message) => {
  console.log('🔥 /start command triggered!');
  const chatId = msg.chat.id;
  let welcome = `
🔥 Welcome to the LIST Burn Alert Bot!

Commands:
/burns - View executed burns
/pending - View pending targets
/stats - Supply statistics
/price - Current price
/about - About $LIST
`;

  if (isAdmin(msg)) {
    welcome += `
👑 ADMIN COMMANDS:
/register <wallet> <twitter> - Register new person
/raid @twitter <url> [thread|viral] - Quick log raid
/addambassador <wallet> <twitter> <tier>
/addref <new_wallet> <referrer_wallet> <amount>
/meme <wallet> <amount> - Log meme winner
/payouts - Preview pending payouts
/ambassadors - List ambassadors
/raids - List unpaid raids
/refs - List pending referrals
/status - Full rewards status
`;
  }

  bot.sendMessage(chatId, welcome);
});

bot.onText(/\/burns/, (msg: Message) => {
  const chatId = msg.chat.id;
  const executed = EPSTEIN_RESOLVED_BURNS.filter(t => t.status === 'executed');
  const totalBurned = executed.reduce((sum, t) => sum + t.burnAllocationPercent, 0);

  let message = `🔥 EXECUTED BURNS\n\n`;
  executed.forEach((burn, i) => {
    const amount = formatBurnAmount(calculateBurnAmount(burn));
    message += `${i + 1}. ${burn.name}\n   └ ${burn.burnAllocationPercent}% (${amount} LIST)\n\n`;
  });
  message += `━━━━━━━━━━━━━━━━━━\nTotal Burned: ${totalBurned}%\nNames Confirmed: ${executed.length}`;

  bot.sendMessage(chatId, message);
});

bot.onText(/\/pending/, (msg: Message) => {
  const chatId = msg.chat.id;
  const pending = [...EPSTEIN_ACTIVE_BURNS]
    .sort((a, b) => b.polymarketOdds - a.polymarketOdds)
    .slice(0, 10);

  let message = `⏳ TOP PENDING TARGETS\n\n`;
  pending.forEach((target, i) => {
    message += `${i + 1}. ${target.name}\n   └ ${target.polymarketOdds}% odds → ${target.burnAllocationPercent}% burn\n\n`;
  });

  bot.sendMessage(chatId, message);
});

bot.onText(/\/stats/, (msg: Message) => {
  const chatId = msg.chat.id;
  const executed = EPSTEIN_RESOLVED_BURNS.filter(t => t.status === 'executed');
  const burnedPercent = executed.reduce((sum, t) => sum + t.burnAllocationPercent, 0);
  const burnedTokens = executed.reduce((sum, t) => sum + Number(calculateBurnAmount(t)) / 1e9, 0);
  const currentSupply = TOTAL_SUPPLY - burnedTokens;
  const pendingPercent = EPSTEIN_ACTIVE_BURNS.reduce((sum, t) => sum + t.burnAllocationPercent, 0);

  const message = `
📊 $LIST STATISTICS

Supply:
├ Initial: ${TOTAL_SUPPLY.toLocaleString()} LIST
├ Burned: ${burnedTokens.toLocaleString()} LIST
└ Current: ${currentSupply.toLocaleString()} LIST

Burns:
├ Executed: ${burnedPercent}%
├ Pending: ${pendingPercent.toFixed(2)}%
└ Max Possible: 64%
`;

  bot.sendMessage(chatId, message);
});

bot.onText(/\/price/, async (msg: Message) => {
  console.log('🔥 /price command triggered!');
  const chatId = msg.chat.id;
  try {
    const data = await fetchJson(
      'https://api.dexscreener.com/latest/dex/tokens/5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM'
    );
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const price = parseFloat(pair.priceUsd).toFixed(6);
      const change24h = pair.priceChange?.h24 || 0;
      const message = `💰 $LIST: $${price}\n24h: ${change24h >= 0 ? '📈' : '📉'} ${change24h}%`;
      bot.sendMessage(chatId, message);
    } else {
      console.error('Price fetch: No pairs found in response');
      bot.sendMessage(chatId, '❌ Could not fetch price');
    }
  } catch (error) {
    console.error('Price command error:', error);
    bot.sendMessage(chatId, '❌ Error fetching price. Try again later.');
  }
});

bot.onText(/\/about/, (msg: Message) => {
  const chatId = msg.chat.id;
  const message = `
🔥 ABOUT $LIST

"The more names drop. The more $LIST pops."

Event-driven burn token on Solana. When names confirm on Polymarket, we burn tokens permanently.

25% already burned. 39% more pending.

🌐 list-coin.com
🐦 @ListDrop
`;
  bot.sendMessage(chatId, message);
});

// ============================================================================
// ADMIN COMMANDS
// ============================================================================

// Get your user ID
bot.onText(/\/myid/, (msg: Message) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  bot.sendMessage(chatId, `Your Telegram User ID: ${userId}\n\nAdd this to .env as TELEGRAM_ADMIN_ID to enable admin commands.`);
});

// Register ambassador (simple - no tier yet)
bot.onText(/\/register (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length < 2) {
    bot.sendMessage(msg.chat.id, 'Usage: /register <wallet> <twitter>');
    return;
  }

  const [wallet, twitter] = args;

  if (!isValidSolanaAddress(wallet)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Solana wallet address');
    return;
  }

  if (!isValidTwitterHandle(twitter)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Twitter handle (1-15 alphanumeric chars)');
    return;
  }

  const data = loadRewards();
  data.ambassadors.push({
    name: twitter.replace('@', ''),
    wallet,
    twitter: twitter.startsWith('@') ? twitter : `@${twitter}`,
    tier: 'pending',
    joinedAt: new Date().toISOString().split('T')[0],
    monthlyReward: 0,
    totalPaid: 0,
    active: true,
  });
  saveRewards(data);

  bot.sendMessage(msg.chat.id, `✅ Ambassador registered!\n\n👤 ${twitter}\n🔑 ${wallet.slice(0, 8)}...\n📋 Status: Pending (no tier yet)\n\nUse /addambassador to assign a tier later.`);
});

// Add ambassador with tier
bot.onText(/\/addambassador (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length < 3) {
    bot.sendMessage(msg.chat.id, 'Usage: /addambassador <wallet> <twitter> <bronze|silver|gold>');
    return;
  }

  const [wallet, twitter, tier] = args;

  if (!isValidSolanaAddress(wallet)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Solana wallet address');
    return;
  }

  if (!isValidTwitterHandle(twitter)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Twitter handle (1-15 alphanumeric chars)');
    return;
  }

  const rewards: Record<string, number> = { bronze: 5000, silver: 15000, gold: 30000 };

  if (!rewards[tier]) {
    bot.sendMessage(msg.chat.id, '❌ Tier must be: bronze, silver, or gold');
    return;
  }

  const data = loadRewards();
  data.ambassadors.push({
    name: twitter.replace('@', ''),
    wallet,
    twitter: twitter.startsWith('@') ? twitter : `@${twitter}`,
    tier,
    joinedAt: new Date().toISOString().split('T')[0],
    monthlyReward: rewards[tier],
    totalPaid: 0,
    active: true,
  });
  saveRewards(data);

  bot.sendMessage(msg.chat.id, `✅ Ambassador added!\n\n👤 ${twitter}\n💰 ${tier} (${rewards[tier]} LIST/month)\n🔑 ${wallet.slice(0, 8)}...`);
});

// Quick raid - lookup wallet by twitter handle
bot.onText(/\/raid (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length < 2) {
    bot.sendMessage(msg.chat.id, 'Usage: /raid @twitter <url> [thread|viral]\nDefaults to reply (500 LIST)');
    return;
  }

  const [twitter, url, typeArg] = args;
  const type = typeArg || 'reply';
  const rewardAmounts: Record<string, number> = { reply: 500, thread: 1000, viral: 2000 };

  if (!rewardAmounts[type]) {
    bot.sendMessage(msg.chat.id, '❌ Type must be: reply, thread, or viral');
    return;
  }

  // Look up wallet by twitter handle
  const data = loadRewards();
  const handle = twitter.startsWith('@') ? twitter.toLowerCase() : `@${twitter.toLowerCase()}`;

  const ambassador = data.ambassadors.find((a: any) =>
    a.twitter.toLowerCase() === handle ||
    a.name.toLowerCase() === handle.replace('@', '')
  );

  if (!ambassador) {
    bot.sendMessage(msg.chat.id, `❌ ${twitter} not registered.\n\nRegister first: /register <wallet> ${twitter}`);
    return;
  }

  data.raidContributions.push({
    wallet: ambassador.wallet,
    twitter: ambassador.twitter,
    type,
    tweetUrl: url,
    reward: rewardAmounts[type],
    paid: false,
    submittedAt: new Date().toISOString().split('T')[0],
  });
  saveRewards(data);

  bot.sendMessage(msg.chat.id, `✅ Raid logged!\n\n👤 ${ambassador.twitter}\n📝 ${type} (+${rewardAmounts[type]} LIST)\n🔗 ${url.slice(0, 40)}...`);
});

// Add raid contribution (full version with wallet)
bot.onText(/\/addraid (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length < 4) {
    bot.sendMessage(msg.chat.id, 'Usage: /addraid <wallet> <twitter> <reply|thread|viral> <tweet_url>');
    return;
  }

  const [wallet, twitter, type, url] = args;

  if (!isValidSolanaAddress(wallet)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Solana wallet address');
    return;
  }

  if (!isValidTwitterHandle(twitter)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Twitter handle (1-15 alphanumeric chars)');
    return;
  }

  const rewards: Record<string, number> = { reply: 500, thread: 1000, viral: 2000 };

  if (!rewards[type]) {
    bot.sendMessage(msg.chat.id, '❌ Type must be: reply, thread, or viral');
    return;
  }

  const data = loadRewards();
  data.raidContributions.push({
    wallet,
    twitter: twitter.startsWith('@') ? twitter : `@${twitter}`,
    type,
    tweetUrl: url,
    reward: rewards[type],
    paid: false,
    submittedAt: new Date().toISOString().split('T')[0],
  });
  saveRewards(data);

  bot.sendMessage(msg.chat.id, `✅ Raid added!\n\n👤 ${twitter}\n📝 ${type} (+${rewards[type]} LIST)\n🔗 ${url.slice(0, 30)}...`);
});

// Log meme contest winner
bot.onText(/\/meme (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length < 2) {
    bot.sendMessage(msg.chat.id, 'Usage: /meme <wallet> <amount>\nExample: /meme 7Fp2...8kNq 25000');
    return;
  }

  const [wallet, amountStr] = args;

  if (!isValidSolanaAddress(wallet)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid Solana wallet address');
    return;
  }

  const amount = parseInt(amountStr, 10);

  if (!isValidAmount(amount, 100, 100000)) {
    bot.sendMessage(msg.chat.id, '❌ Amount must be between 100 and 100,000 LIST');
    return;
  }

  const data = loadRewards();
  data.raidContributions.push({
    wallet,
    twitter: 'meme_contest_winner',
    type: 'viral',
    tweetUrl: 'meme_contest',
    reward: amount,
    paid: false,
    submittedAt: new Date().toISOString().split('T')[0],
  });
  saveRewards(data);

  bot.sendMessage(msg.chat.id, `✅ Meme winner logged!\n\n🎨 ${wallet.slice(0, 8)}...\n💰 ${amount.toLocaleString()} LIST\n\nWill be paid in next weekly payout.`);
});

// List ambassadors
bot.onText(/\/ambassadors$/, (msg: Message) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const data = loadRewards();
  const active = data.ambassadors.filter((a: any) => a.active && !a.wallet.startsWith('Example'));

  if (active.length === 0) {
    bot.sendMessage(msg.chat.id, '📋 No ambassadors yet');
    return;
  }

  let message = `👑 AMBASSADORS (${active.length})\n\n`;
  active.forEach((a: any, i: number) => {
    message += `${i + 1}. ${a.twitter} (${a.tier})\n   └ ${a.monthlyReward} LIST/mo | Paid: ${a.totalPaid}\n\n`;
  });

  bot.sendMessage(msg.chat.id, message);
});

// List unpaid raids
bot.onText(/\/raids$/, (msg: Message) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const data = loadRewards();
  const unpaid = data.raidContributions.filter((r: any) => !r.paid && !r.wallet.startsWith('Example'));

  if (unpaid.length === 0) {
    bot.sendMessage(msg.chat.id, '📋 No unpaid raid contributions');
    return;
  }

  let message = `⚔️ UNPAID RAIDS (${unpaid.length})\n\n`;
  let total = 0;
  unpaid.forEach((r: any, i: number) => {
    message += `${i + 1}. ${r.twitter} - ${r.type} (+${r.reward})\n`;
    total += r.reward;
  });
  message += `\n━━━━━━━━━━━━\nTotal: ${total.toLocaleString()} LIST`;

  bot.sendMessage(msg.chat.id, message);
});

// Preview payouts
bot.onText(/\/payouts$/, (msg: Message) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const data = loadRewards();

  // Ambassadors
  const activeAmb = data.ambassadors.filter((a: any) => a.active && !a.wallet.startsWith('Example'));
  const ambTotal = activeAmb.reduce((sum: number, a: any) => sum + Math.floor(a.monthlyReward / 4), 0);

  // Raids
  const unpaidRaids = data.raidContributions.filter((r: any) => !r.paid && !r.wallet.startsWith('Example'));
  const raidTotal = unpaidRaids.reduce((sum: number, r: any) => sum + r.reward, 0);

  const grandTotal = ambTotal + raidTotal;
  const cap = 50000;

  let message = `📊 PAYOUT PREVIEW\n\n`;
  message += `Ambassadors: ${activeAmb.length} × weekly = ${ambTotal.toLocaleString()} LIST\n`;
  message += `Raid Squad: ${unpaidRaids.length} entries = ${raidTotal.toLocaleString()} LIST\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `Total: ${grandTotal.toLocaleString()} LIST\n`;
  message += `Cap: ${cap.toLocaleString()} LIST\n`;

  if (grandTotal > cap) {
    message += `\n⚠️ Over cap! Will be scaled down.`;
  }

  message += `\n\nNext payout: Sunday 6PM`;

  bot.sendMessage(msg.chat.id, message);
});

// Add referral
bot.onText(/\/addref (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length < 3) {
    bot.sendMessage(msg.chat.id, 'Usage: /addref <new_wallet> <referrer_wallet> <purchase_amount>\nExample: /addref 7Fp2... 8Xm3... 50000');
    return;
  }

  const [newWallet, referrerWallet, amountStr] = args;

  if (!isValidSolanaAddress(newWallet)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid new wallet address');
    return;
  }

  if (!isValidSolanaAddress(referrerWallet)) {
    bot.sendMessage(msg.chat.id, '❌ Invalid referrer wallet address');
    return;
  }

  const amount = parseInt(amountStr, 10);

  if (!isValidAmount(amount, 10000, 10000000)) {
    bot.sendMessage(msg.chat.id, '❌ Purchase amount must be between 10,000 and 10,000,000 LIST');
    return;
  }

  // Calculate rewards based on tier
  let newReward = 500, referrerReward = 1000;
  if (amount >= 100000) {
    newReward = 2500; referrerReward = 5000;
  } else if (amount >= 50000) {
    newReward = 1500; referrerReward = 3000;
  }

  const holdUntil = new Date();
  holdUntil.setDate(holdUntil.getDate() + 7);

  const data = loadRewards();
  if (!data.referrals) data.referrals = [];

  data.referrals.push({
    newWallet,
    newTwitter: 'pending',
    referrerWallet,
    referrerTwitter: 'pending',
    purchaseAmount: amount,
    newReward,
    referrerReward,
    txSignature: '',
    submittedAt: new Date().toISOString().split('T')[0],
    holdUntil: holdUntil.toISOString().split('T')[0],
    paid: false,
  });
  saveRewards(data);

  bot.sendMessage(msg.chat.id, `✅ Referral logged!\n\n🆕 New holder: ${newWallet.slice(0, 8)}... (+${newReward} LIST)\n🎁 Referrer: ${referrerWallet.slice(0, 8)}... (+${referrerReward} LIST)\n💰 Purchase: ${amount.toLocaleString()} LIST\n⏳ Pays out: ${holdUntil.toISOString().split('T')[0]}`);
});

// List pending referrals
bot.onText(/\/refs$/, (msg: Message) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const data = loadRewards();
  const pending = (data.referrals || []).filter((r: any) => !r.paid);
  const today = new Date().toISOString().split('T')[0];

  if (pending.length === 0) {
    bot.sendMessage(msg.chat.id, '📋 No pending referrals');
    return;
  }

  let message = `🎁 PENDING REFERRALS (${pending.length})\n\n`;
  pending.forEach((r: any, i: number) => {
    const ready = r.holdUntil <= today ? '✅' : '⏳';
    message += `${i + 1}. ${ready} ${r.newWallet.slice(0, 6)}... → ${r.referrerWallet.slice(0, 6)}...\n`;
    message += `   ${r.purchaseAmount.toLocaleString()} LIST | Pays: ${r.holdUntil}\n\n`;
  });

  bot.sendMessage(msg.chat.id, message);
});

// Full status
bot.onText(/\/status$/, (msg: Message) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const data = loadRewards();
  const today = new Date().toISOString().split('T')[0];

  const activeAmb = data.ambassadors.filter((a: any) => a.active);
  const unpaidRaids = data.raidContributions.filter((r: any) => !r.paid);
  const pendingRefs = (data.referrals || []).filter((r: any) => !r.paid);
  const readyRefs = pendingRefs.filter((r: any) => r.holdUntil <= today);
  const memeWinners = (data.memeContest?.winners || []).filter((w: any) => !w.paid);

  const ambTotal = activeAmb.reduce((s: number, a: any) => s + Math.floor(a.monthlyReward / 4), 0);
  const raidTotal = unpaidRaids.reduce((s: number, r: any) => s + r.reward, 0);
  const refTotal = readyRefs.reduce((s: number, r: any) => s + r.newReward + r.referrerReward, 0);
  const memeTotal = memeWinners.reduce((s: number, w: any) => s + w.reward, 0);

  const grandTotal = ambTotal + raidTotal + refTotal + memeTotal;

  let message = `📊 REWARDS STATUS\n\n`;
  message += `👑 Ambassadors: ${activeAmb.length} (${ambTotal.toLocaleString()} LIST/wk)\n`;
  message += `⚔️ Raids: ${unpaidRaids.length} unpaid (${raidTotal.toLocaleString()} LIST)\n`;
  message += `🎁 Referrals: ${readyRefs.length} ready / ${pendingRefs.length} total (${refTotal.toLocaleString()} LIST)\n`;
  message += `🎨 Meme: ${memeWinners.length} unpaid (${memeTotal.toLocaleString()} LIST)\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 Next payout: ${grandTotal.toLocaleString()} LIST\n`;
  message += `🔒 Weekly cap: 50,000 LIST\n`;
  message += `📅 Payout: Sunday 6PM`;

  bot.sendMessage(msg.chat.id, message);
});

console.log('Bot running. Commands ready.');

// =============================================================================
// BUY ALERTS
// =============================================================================

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const LIST_PAIR = 'https://api.dexscreener.com/latest/dex/pairs/solana/ADyAi2M44oFse9ZebsVGWr3dSkV4HC2Dc4ADQ5z2pMGW';

let lastTradeTime = Date.now();
let alertsEnabled = true;

interface DexTrade {
  txnHash: string;
  priceUsd: string;
  amount: number;
  type: 'buy' | 'sell';
  timestamp: number;
}

async function checkBuys(): Promise<void> {
  if (!CHANNEL_ID || !alertsEnabled) return;

  try {
    const data = await fetchJson(LIST_PAIR);
    const pair = data?.pair;

    if (!pair) return;

    const priceUsd = parseFloat(pair.priceUsd || '0');
    const txns = pair.txns?.h1 || { buys: 0, sells: 0 };
    const volume = pair.volume?.h1 || 0;

    // Check for significant buys via volume spike
    if (volume > 100 && txns.buys > 0) {
      const avgBuySize = volume / (txns.buys + txns.sells);

      // Alert on buys > $50
      if (avgBuySize > 50) {
        const emoji = avgBuySize > 500 ? '🐋' : avgBuySize > 200 ? '🔥' : '💚';

        const message = `${emoji} NEW BUY DETECTED

💰 ~$${avgBuySize.toFixed(0)} buy
📊 Price: $${priceUsd.toFixed(8)}
📈 1h Volume: $${volume.toFixed(0)}
🛒 Buys/Sells: ${txns.buys}/${txns.sells}

${avgBuySize > 200 ? 'Big buyer in the house! 🚀' : 'Stack those bags! 💎'}`;

        bot.sendMessage(CHANNEL_ID, message);

        // Don't spam - wait at least 5 mins between alerts
        alertsEnabled = false;
        setTimeout(() => { alertsEnabled = true; }, 5 * 60 * 1000);
      }
    }
  } catch (err) {
    console.error('Buy alert error:', err);
  }
}

// Check every 60 seconds
if (CHANNEL_ID) {
  console.log(`📢 Buy alerts enabled for channel ${CHANNEL_ID}`);
  setInterval(checkBuys, 60 * 1000);
  checkBuys(); // Initial check
} else {
  console.log('⚠️ TELEGRAM_CHANNEL_ID not set - buy alerts disabled');
}

// Admin command to toggle alerts
bot.onText(/\/alerts (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, '❌ Admin only');
    return;
  }

  const action = match?.[1]?.toLowerCase();
  if (action === 'on') {
    alertsEnabled = true;
    bot.sendMessage(msg.chat.id, '✅ Buy alerts enabled');
  } else if (action === 'off') {
    alertsEnabled = false;
    bot.sendMessage(msg.chat.id, '❌ Buy alerts disabled');
  } else {
    bot.sendMessage(msg.chat.id, `Buy alerts: ${alertsEnabled ? 'ON' : 'OFF'}\n\nUsage: /alerts on|off`);
  }
});
