/**
 * LIST Token Admin Bot
 *
 * Combines burn alerts + admin functions for rewards management
 *
 * PUBLIC COMMANDS:
 * /burns, /pending, /stats, /price, /about
 *
 * ADMIN COMMANDS (only work for ADMIN_USER_ID):
 * /addambassador <wallet> <twitter> <tier>
 * /addraid <wallet> <twitter> <type> <url>
 * /payouts - Preview pending payouts
 * /ambassadors - List all ambassadors
 * /raids - List unpaid raid contributions
 * /meme <wallet> <amount> - Log meme contest winner
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

// Simple HTTPS fetch
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_ID; // Your Telegram user ID

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
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

function loadRewards(): any {
  const data = fs.readFileSync(REWARDS_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveRewards(data: any): void {
  fs.writeFileSync(REWARDS_FILE, JSON.stringify(data, null, 2));
}

// ============================================================================
// PUBLIC COMMANDS
// ============================================================================

bot.onText(/\/start/, (msg: Message) => {
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
/addambassador <wallet> <twitter> <tier>
/addraid <wallet> <twitter> <type> <url>
/addref <new_wallet> <referrer_wallet> <amount>
/meme <wallet> <place> - Log meme winner (1st/2nd/3rd)
/payouts - Preview pending payouts
/ambassadors - List ambassadors
/raids - List unpaid raids
/refs - List pending referrals
/status - Full rewards status
/myid - Show your user ID
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
      bot.sendMessage(chatId, '❌ Could not fetch price');
    }
  } catch {
    bot.sendMessage(chatId, '❌ Error fetching price');
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

// Add ambassador
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

// Add raid contribution
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
  const amount = parseInt(amountStr);

  if (isNaN(amount)) {
    bot.sendMessage(msg.chat.id, '❌ Amount must be a number');
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
  const amount = parseInt(amountStr);

  if (isNaN(amount) || amount < 10000) {
    bot.sendMessage(msg.chat.id, '❌ Purchase amount must be at least 10,000 LIST');
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
