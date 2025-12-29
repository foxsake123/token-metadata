/**
 * LIST Token Burn Alert Telegram Bot
 *
 * Commands:
 * /start - Welcome message
 * /burns - Show executed burns
 * /pending - Show pending targets
 * /stats - Supply statistics
 * /price - Current price
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Add TELEGRAM_BOT_TOKEN to .env
 * 3. Run: npx ts-node src/telegram-bot/burn-alert-bot.ts
 */

import TelegramBot, { Message } from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import * as https from 'https';
import {
  EPSTEIN_RESOLVED_BURNS,
  EPSTEIN_ACTIVE_BURNS,
  TOTAL_SUPPLY,
  calculateBurnAmount,
  formatBurnAmount,
} from '../burn/config';

dotenv.config();

// Simple HTTPS fetch for Node.js
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

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  console.log('\nTo set up:');
  console.log('1. Message @BotFather on Telegram');
  console.log('2. Send /newbot and follow prompts');
  console.log('3. Copy the token to .env as TELEGRAM_BOT_TOKEN=your_token');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 LIST Burn Alert Bot started!');

// /start command
bot.onText(/\/start/, (msg: Message) => {
  const chatId = msg.chat.id;
  const welcome = `
🔥 Welcome to the LIST Burn Alert Bot!

I'll keep you updated on all $LIST burns.

Commands:
/burns - View executed burns
/pending - View pending targets
/stats - Supply statistics
/price - Current price
/about - About $LIST

Join our community:
🐦 Twitter: @ListDrop
💬 Telegram: t.me/listdropofficial
🌐 Website: list-coin.com
`;
  bot.sendMessage(chatId, welcome);
});

// /burns command
bot.onText(/\/burns/, (msg: Message) => {
  const chatId = msg.chat.id;

  const executed = EPSTEIN_RESOLVED_BURNS.filter(t => t.status === 'executed');
  const totalBurned = executed.reduce((sum, t) => sum + t.burnAllocationPercent, 0);

  let message = `🔥 EXECUTED BURNS\n\n`;

  executed.forEach((burn, i) => {
    const amount = formatBurnAmount(calculateBurnAmount(burn));
    message += `${i + 1}. ${burn.name}\n`;
    message += `   └ ${burn.burnAllocationPercent}% (${amount} LIST)\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `Total Burned: ${totalBurned}%\n`;
  message += `Names Confirmed: ${executed.length}`;

  bot.sendMessage(chatId, message);
});

// /pending command
bot.onText(/\/pending/, (msg: Message) => {
  const chatId = msg.chat.id;

  const pending = [...EPSTEIN_ACTIVE_BURNS]
    .sort((a, b) => b.polymarketOdds - a.polymarketOdds)
    .slice(0, 10);

  let message = `⏳ TOP PENDING TARGETS\n\n`;
  message += `Sorted by Polymarket odds:\n\n`;

  pending.forEach((target, i) => {
    message += `${i + 1}. ${target.name}\n`;
    message += `   └ ${target.polymarketOdds}% odds → ${target.burnAllocationPercent}% burn\n\n`;
  });

  const totalPending = EPSTEIN_ACTIVE_BURNS.reduce((sum, t) => sum + t.burnAllocationPercent, 0);
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `Total Pending: ${totalPending.toFixed(2)}%`;

  bot.sendMessage(chatId, message);
});

// /stats command
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

Confirmations:
├ Names Burned: ${executed.length}
└ Names Pending: ${EPSTEIN_ACTIVE_BURNS.length}

Contract:
5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM
`;

  bot.sendMessage(chatId, message);
});

// /price command
bot.onText(/\/price/, async (msg: Message) => {
  const chatId = msg.chat.id;

  try {
    // Fetch from DexScreener
    const data = await fetchJson(
      'https://api.dexscreener.com/latest/dex/tokens/5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM'
    );

    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const price = parseFloat(pair.priceUsd).toFixed(6);
      const change24h = pair.priceChange?.h24 || 0;
      const volume24h = pair.volume?.h24 || 0;
      const liquidity = pair.liquidity?.usd || 0;

      const changeEmoji = change24h >= 0 ? '📈' : '📉';

      const message = `
💰 $LIST PRICE

Price: $${price}
24h Change: ${changeEmoji} ${change24h}%
24h Volume: $${Number(volume24h).toLocaleString()}
Liquidity: $${Number(liquidity).toLocaleString()}

📊 DexScreener: dexscreener.com/solana/5oKiB...
`;
      bot.sendMessage(chatId, message);
    } else {
      bot.sendMessage(chatId, '❌ Could not fetch price data');
    }
  } catch (error) {
    bot.sendMessage(chatId, '❌ Error fetching price. Try again later.');
  }
});

// /about command
bot.onText(/\/about/, (msg: Message) => {
  const chatId = msg.chat.id;

  const message = `
🔥 ABOUT $LIST

"The more names drop. The more $LIST pops."

$LIST is an event-driven burn token on Solana. When names are confirmed on Polymarket prediction markets, we execute permanent on-chain burns.

How it works:
1. Polymarket has prediction markets
2. When a name resolves YES → burn triggers
3. Tokens are burned on-chain (verifiable)
4. Supply decreases forever

Events:
• Epstein List (Dec 31 deadline)
• Diddy Trial Verdict (Q1 2025)

Links:
🌐 list-coin.com
🐦 twitter.com/ListDrop
💬 t.me/listdropofficial

Contract:
5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM
`;

  bot.sendMessage(chatId, message);
});

// Broadcast function for burn alerts
export async function broadcastBurnAlert(
  name: string,
  percent: number,
  tokens: string,
  txHash: string
): Promise<void> {
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

  if (!CHANNEL_ID) {
    console.log('No TELEGRAM_CHANNEL_ID set, skipping broadcast');
    return;
  }

  const message = `
🚨 BURN ALERT 🚨

${name} CONFIRMED on the list!

🔥 Burn: ${percent}%
💀 Tokens: ${tokens} LIST
📜 TX: solscan.io/tx/${txHash}

The more names drop.
The more $LIST pops. 📈
`;

  await bot.sendMessage(CHANNEL_ID, message);
}

console.log('Bot is running. Press Ctrl+C to stop.');
