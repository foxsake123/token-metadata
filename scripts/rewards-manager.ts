/**
 * $LIST Unified Rewards Manager
 *
 * Handles all reward programs:
 * - Ambassadors (weekly)
 * - Raid Squad (weekly)
 * - Referrals (after 7-day hold)
 * - Meme Contest (one-time)
 *
 * Commands:
 *   npx ts-node scripts/rewards-manager.ts status     - View all pending rewards
 *   npx ts-node scripts/rewards-manager.ts preview    - Preview next payout
 *   npx ts-node scripts/rewards-manager.ts payout     - Execute payout (dry-run)
 *   npx ts-node scripts/rewards-manager.ts payout --execute  - Execute payout (live)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const REWARDS_FILE = path.join(__dirname, '..', 'data', 'rewards-tracker.json');
const LIST_TOKEN_MINT = '5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM';
const DECIMALS = 9;

// ============================================================================
// TYPES
// ============================================================================

interface Ambassador {
  name: string;
  wallet: string;
  twitter: string;
  tier: 'bronze' | 'silver' | 'gold';
  joinedAt: string;
  monthlyReward: number;
  totalPaid: number;
  active: boolean;
  lastPaidAt?: string;
}

interface RaidContribution {
  wallet: string;
  twitter: string;
  type: 'reply' | 'thread' | 'viral';
  tweetUrl: string;
  reward: number;
  paid: boolean;
  submittedAt: string;
}

interface Referral {
  newWallet: string;
  newTwitter: string;
  referrerWallet: string;
  referrerTwitter: string;
  purchaseAmount: number;
  newReward: number;
  referrerReward: number;
  txSignature: string;
  submittedAt: string;
  holdUntil: string;
  paid: boolean;
}

interface MemeEntry {
  wallet: string;
  twitter: string;
  tweetUrl: string;
  submittedAt: string;
}

interface MemeWinner {
  wallet: string;
  twitter: string;
  place: 1 | 2 | 3;
  reward: number;
  paid: boolean;
}

interface RewardsData {
  ambassadors: Ambassador[];
  raidContributions: RaidContribution[];
  referrals: Referral[];
  memeContest: {
    active: boolean;
    endDate: string;
    prizePool: number;
    entries: MemeEntry[];
    winners: MemeWinner[];
  };
  payoutHistory: any[];
  settings: {
    weeklyCapTotal: number;
    weeklyCapPerPerson: number;
    referralHoldDays: number;
    payoutDay: string;
    payoutTime: string;
  };
}

interface Payout {
  wallet: string;
  amount: number;
  reason: string;
  program: 'ambassador' | 'raid' | 'referral' | 'meme';
}

// ============================================================================
// HELPERS
// ============================================================================

function loadRewards(): RewardsData {
  return JSON.parse(fs.readFileSync(REWARDS_FILE, 'utf-8'));
}

function saveRewards(data: RewardsData): void {
  fs.writeFileSync(REWARDS_FILE, JSON.stringify(data, null, 2));
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

// ============================================================================
// STATUS COMMAND
// ============================================================================

function showStatus(): void {
  const data = loadRewards();
  const today = new Date().toISOString().split('T')[0];

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           $LIST REWARDS MANAGER - STATUS                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Ambassadors
  const activeAmb = data.ambassadors.filter(a => a.active);
  console.log('👑 AMBASSADORS');
  console.log('─'.repeat(50));
  if (activeAmb.length === 0) {
    console.log('   No active ambassadors');
  } else {
    activeAmb.forEach(a => {
      console.log(`   ${a.twitter} (${a.tier}) - ${a.monthlyReward}/mo | Paid: ${a.totalPaid}`);
    });
  }
  console.log(`   Total: ${activeAmb.length} active\n`);

  // Raid Squad
  const unpaidRaids = data.raidContributions.filter(r => !r.paid);
  console.log('⚔️ RAID SQUAD');
  console.log('─'.repeat(50));
  if (unpaidRaids.length === 0) {
    console.log('   No unpaid contributions');
  } else {
    const raidTotal = unpaidRaids.reduce((sum, r) => sum + r.reward, 0);
    console.log(`   ${unpaidRaids.length} unpaid contributions`);
    console.log(`   Total pending: ${formatNumber(raidTotal)} LIST`);
  }
  console.log('');

  // Referrals
  const pendingRefs = data.referrals.filter(r => !r.paid);
  const readyRefs = pendingRefs.filter(r => r.holdUntil <= today);
  const waitingRefs = pendingRefs.filter(r => r.holdUntil > today);
  console.log('🎁 REFERRALS');
  console.log('─'.repeat(50));
  console.log(`   Ready to pay: ${readyRefs.length}`);
  console.log(`   Still holding: ${waitingRefs.length}`);
  if (waitingRefs.length > 0) {
    const nextReady = waitingRefs.sort((a, b) => a.holdUntil.localeCompare(b.holdUntil))[0];
    console.log(`   Next ready: ${nextReady.holdUntil}`);
  }
  console.log('');

  // Meme Contest
  console.log('🎨 MEME CONTEST');
  console.log('─'.repeat(50));
  console.log(`   Status: ${data.memeContest.active ? 'Active' : 'Ended'}`);
  console.log(`   End date: ${data.memeContest.endDate}`);
  console.log(`   Entries: ${data.memeContest.entries.length}`);
  console.log(`   Winners picked: ${data.memeContest.winners.length}`);
  const unpaidWinners = data.memeContest.winners.filter(w => !w.paid);
  if (unpaidWinners.length > 0) {
    console.log(`   Unpaid winners: ${unpaidWinners.length}`);
  }
  console.log('');

  // Summary
  console.log('📊 NEXT PAYOUT ESTIMATE');
  console.log('─'.repeat(50));
  const estimate = calculatePayouts(data);
  console.log(`   Recipients: ${estimate.length}`);
  console.log(`   Total: ${formatNumber(estimate.reduce((s, p) => s + p.amount, 0))} LIST`);
  console.log(`   Cap: ${formatNumber(data.settings.weeklyCapTotal)} LIST`);
  console.log('');
}

// ============================================================================
// PAYOUT CALCULATION
// ============================================================================

function calculatePayouts(data: RewardsData): Payout[] {
  const payouts: Payout[] = [];
  const today = new Date().toISOString().split('T')[0];

  // 1. Ambassadors (weekly = monthly / 4)
  data.ambassadors
    .filter(a => a.active)
    .forEach(a => {
      payouts.push({
        wallet: a.wallet,
        amount: Math.floor(a.monthlyReward / 4),
        reason: `Ambassador (${a.tier}): ${a.twitter}`,
        program: 'ambassador',
      });
    });

  // 2. Raid Squad
  data.raidContributions
    .filter(r => !r.paid)
    .forEach(r => {
      payouts.push({
        wallet: r.wallet,
        amount: r.reward,
        reason: `Raid ${r.type}: ${r.twitter}`,
        program: 'raid',
      });
    });

  // 3. Referrals (only if hold period complete)
  data.referrals
    .filter(r => !r.paid && r.holdUntil <= today)
    .forEach(r => {
      // New holder bonus
      payouts.push({
        wallet: r.newWallet,
        amount: r.newReward,
        reason: `Referral bonus: ${r.newTwitter}`,
        program: 'referral',
      });
      // Referrer reward
      payouts.push({
        wallet: r.referrerWallet,
        amount: r.referrerReward,
        reason: `Referral reward: ${r.referrerTwitter}`,
        program: 'referral',
      });
    });

  // 4. Meme Contest Winners
  data.memeContest.winners
    .filter(w => !w.paid)
    .forEach(w => {
      payouts.push({
        wallet: w.wallet,
        amount: w.reward,
        reason: `Meme contest #${w.place}: ${w.twitter}`,
        program: 'meme',
      });
    });

  // Apply per-person cap
  const byWallet: Record<string, number> = {};
  payouts.forEach(p => {
    byWallet[p.wallet] = (byWallet[p.wallet] || 0) + p.amount;
  });

  // Cap per person
  const cappedPayouts = payouts.map(p => {
    if (byWallet[p.wallet] > data.settings.weeklyCapPerPerson) {
      const scale = data.settings.weeklyCapPerPerson / byWallet[p.wallet];
      return { ...p, amount: Math.floor(p.amount * scale) };
    }
    return p;
  });

  // Apply total cap
  const total = cappedPayouts.reduce((s, p) => s + p.amount, 0);
  if (total > data.settings.weeklyCapTotal) {
    const scale = data.settings.weeklyCapTotal / total;
    return cappedPayouts.map(p => ({ ...p, amount: Math.floor(p.amount * scale) }));
  }

  return cappedPayouts;
}

// ============================================================================
// PREVIEW COMMAND
// ============================================================================

function previewPayout(): void {
  const data = loadRewards();
  const payouts = calculatePayouts(data);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           $LIST REWARDS - PAYOUT PREVIEW                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (payouts.length === 0) {
    console.log('No payouts pending.\n');
    return;
  }

  // Group by program
  const byProgram: Record<string, Payout[]> = {};
  payouts.forEach(p => {
    if (!byProgram[p.program]) byProgram[p.program] = [];
    byProgram[p.program].push(p);
  });

  const labels: Record<string, string> = {
    ambassador: '👑 AMBASSADORS',
    raid: '⚔️ RAID SQUAD',
    referral: '🎁 REFERRALS',
    meme: '🎨 MEME CONTEST',
  };

  Object.entries(byProgram).forEach(([program, items]) => {
    console.log(labels[program] || program);
    console.log('─'.repeat(50));
    items.forEach(p => {
      console.log(`   ${p.wallet.slice(0, 8)}... | ${formatNumber(p.amount)} LIST | ${p.reason}`);
    });
    const subtotal = items.reduce((s, p) => s + p.amount, 0);
    console.log(`   Subtotal: ${formatNumber(subtotal)} LIST\n`);
  });

  const total = payouts.reduce((s, p) => s + p.amount, 0);
  console.log('═'.repeat(50));
  console.log(`TOTAL: ${formatNumber(total)} LIST`);
  console.log(`CAP: ${formatNumber(data.settings.weeklyCapTotal)} LIST`);
  console.log(`RECIPIENTS: ${payouts.length}`);
  console.log('═'.repeat(50));
  console.log('\nRun with --execute to send payouts.\n');
}

// ============================================================================
// EXECUTE PAYOUT
// ============================================================================

async function executePayout(dryRun: boolean): Promise<void> {
  const data = loadRewards();
  const payouts = calculatePayouts(data);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║    $LIST REWARDS - ${dryRun ? 'DRY RUN' : '🚨 LIVE PAYOUT'}                     ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (payouts.length === 0) {
    console.log('No payouts to process.\n');
    return;
  }

  const total = payouts.reduce((s, p) => s + p.amount, 0);
  console.log(`Processing ${payouts.length} payouts totaling ${formatNumber(total)} LIST\n`);

  if (dryRun) {
    payouts.forEach(p => {
      console.log(`   [DRY] ${p.wallet.slice(0, 8)}... → ${formatNumber(p.amount)} LIST`);
    });
    console.log('\n✅ Dry run complete. Use --execute for live payout.\n');
    return;
  }

  // Live execution
  const marketingSecret = process.env.MARKETING_WALLET_SECRET;
  if (!marketingSecret) {
    console.error('❌ MARKETING_WALLET_SECRET not set in .env\n');
    return;
  }

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  );
  const payer = Keypair.fromSecretKey(bs58.decode(marketingSecret));
  const mint = new PublicKey(LIST_TOKEN_MINT);

  // Check balance
  const payerAta = await getAssociatedTokenAddress(mint, payer.publicKey);
  const account = await getAccount(connection, payerAta);
  const balance = Number(account.amount) / 10 ** DECIMALS;

  console.log(`Marketing wallet balance: ${formatNumber(balance)} LIST`);

  if (balance < total) {
    console.error(`❌ Insufficient balance. Need ${formatNumber(total)}, have ${formatNumber(balance)}\n`);
    return;
  }

  // Process payouts
  const results: { wallet: string; success: boolean; tx?: string; error?: string }[] = [];

  for (const payout of payouts) {
    try {
      const recipient = new PublicKey(payout.wallet);
      const recipientAta = await getAssociatedTokenAddress(mint, recipient);

      // Check if recipient has token account
      let needsAccount = false;
      try {
        await getAccount(connection, recipientAta);
      } catch {
        needsAccount = true;
      }

      const tx = new Transaction();

      if (needsAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            recipientAta,
            recipient,
            mint
          )
        );
      }

      tx.add(
        createTransferInstruction(
          payerAta,
          recipientAta,
          payer.publicKey,
          BigInt(payout.amount) * BigInt(10 ** DECIMALS)
        )
      );

      const sig = await connection.sendTransaction(tx, [payer]);
      results.push({ wallet: payout.wallet, success: true, tx: sig });
      console.log(`   ✅ ${payout.wallet.slice(0, 8)}... → ${formatNumber(payout.amount)} LIST`);

    } catch (error: any) {
      results.push({ wallet: payout.wallet, success: false, error: error.message });
      console.log(`   ❌ ${payout.wallet.slice(0, 8)}... FAILED: ${error.message}`);
    }

    // Small delay between transactions
    await new Promise(r => setTimeout(r, 500));
  }

  // Update records
  const today = new Date().toISOString();

  // Mark raids as paid
  data.raidContributions.forEach(r => {
    if (!r.paid && payouts.some(p => p.wallet === r.wallet && p.program === 'raid')) {
      r.paid = true;
    }
  });

  // Mark referrals as paid
  data.referrals.forEach(r => {
    if (!r.paid && r.holdUntil <= today.split('T')[0]) {
      r.paid = true;
    }
  });

  // Mark meme winners as paid
  data.memeContest.winners.forEach(w => {
    if (!w.paid && payouts.some(p => p.wallet === w.wallet && p.program === 'meme')) {
      w.paid = true;
    }
  });

  // Update ambassador totals
  data.ambassadors.forEach(a => {
    if (a.active) {
      a.totalPaid += Math.floor(a.monthlyReward / 4);
      a.lastPaidAt = today;
    }
  });

  // Add to history
  data.payoutHistory.push({
    date: today,
    totalPaid: total,
    recipients: payouts.length,
    results: results,
  });

  saveRewards(data);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n═'.repeat(50));
  console.log(`✅ Success: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═'.repeat(50) + '\n');
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const command = args[0] || 'status';
const execute = args.includes('--execute');

switch (command) {
  case 'status':
    showStatus();
    break;
  case 'preview':
    previewPayout();
    break;
  case 'payout':
    executePayout(!execute).catch(console.error);
    break;
  default:
    console.log(`
Usage:
  npx ts-node scripts/rewards-manager.ts status     - View all pending rewards
  npx ts-node scripts/rewards-manager.ts preview    - Preview next payout
  npx ts-node scripts/rewards-manager.ts payout     - Dry run payout
  npx ts-node scripts/rewards-manager.ts payout --execute  - Live payout
    `);
}
