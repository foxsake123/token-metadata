/**
 * Process Ambassador & Raid Squad Rewards
 *
 * Usage:
 *   npx ts-node scripts/process-rewards.ts --dry-run    # Preview payouts
 *   npx ts-node scripts/process-rewards.ts --execute    # Send payouts
 *
 * Marketing Wallet: ERrKctwZw8ZUNuvUyCEKnJVTZRuf6nDqmagQiFt8BrNo
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
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const REWARDS_FILE = path.join(__dirname, '..', 'data', 'rewards-tracker.json');
const LIST_TOKEN_MINT = '5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM';
const DECIMALS = 9;

// SAFETY CAPS
const WEEKLY_CAP = 50000;           // Max 50K LIST per week
const MAX_AMBASSADORS = 10;          // Max 10 ambassadors
const MAX_RAID_PER_PERSON = 5000;    // Max 5K LIST per person per week for raids

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

interface RewardsData {
  ambassadors: Ambassador[];
  raidContributions: RaidContribution[];
  payoutHistory: any[];
}

function loadRewards(): RewardsData {
  const data = fs.readFileSync(REWARDS_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveRewards(data: RewardsData): void {
  fs.writeFileSync(REWARDS_FILE, JSON.stringify(data, null, 2));
}

async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount) / 10 ** DECIMALS;
  } catch {
    return 0;
  }
}

async function processPayouts(dryRun: boolean = true) {
  console.log('\n🏆 LIST Rewards Processor');
  console.log('═'.repeat(50));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : '🚨 LIVE EXECUTION'}`);
  console.log('');

  const rewards = loadRewards();
  const payouts: { wallet: string; amount: number; reason: string }[] = [];

  // Process active ambassadors (weekly payout = monthly / 4)
  console.log('📋 AMBASSADORS');
  console.log('─'.repeat(40));

  for (const amb of rewards.ambassadors) {
    if (!amb.active) continue;
    if (amb.wallet.startsWith('Example')) continue;

    const weeklyReward = Math.floor(amb.monthlyReward / 4);
    payouts.push({
      wallet: amb.wallet,
      amount: weeklyReward,
      reason: `Ambassador (${amb.tier}): ${amb.twitter}`,
    });
    console.log(`  ${amb.twitter} (${amb.tier}): ${weeklyReward} LIST`);
  }

  // Process unpaid raid contributions
  console.log('\n⚔️ RAID CONTRIBUTIONS');
  console.log('─'.repeat(40));

  const unpaidRaids = rewards.raidContributions.filter(r => !r.paid);

  if (unpaidRaids.length === 0) {
    console.log('  No unpaid contributions');
  }

  for (const raid of unpaidRaids) {
    if (raid.wallet.startsWith('Example')) continue;

    payouts.push({
      wallet: raid.wallet,
      amount: raid.reward,
      reason: `Raid ${raid.type}: ${raid.twitter}`,
    });
    console.log(`  ${raid.twitter} (${raid.type}): ${raid.reward} LIST`);
  }

  // Apply per-person raid cap
  const raidByWallet: Record<string, number> = {};
  for (const payout of payouts) {
    if (payout.reason.startsWith('Raid')) {
      raidByWallet[payout.wallet] = (raidByWallet[payout.wallet] || 0) + payout.amount;
      if (raidByWallet[payout.wallet] > MAX_RAID_PER_PERSON) {
        const excess = raidByWallet[payout.wallet] - MAX_RAID_PER_PERSON;
        payout.amount -= excess;
        console.log(`  ⚠️ Capped ${payout.wallet.slice(0, 8)}... raid rewards at ${MAX_RAID_PER_PERSON}`);
      }
    }
  }

  // Summary
  console.log('\n📊 PAYOUT SUMMARY');
  console.log('─'.repeat(40));

  let totalPayout = payouts.reduce((sum, p) => sum + p.amount, 0);

  // Apply weekly cap
  if (totalPayout > WEEKLY_CAP) {
    console.log(`  ⚠️ WEEKLY CAP HIT: ${totalPayout} > ${WEEKLY_CAP}`);
    console.log(`  Scaling all payouts proportionally...`);
    const scale = WEEKLY_CAP / totalPayout;
    for (const payout of payouts) {
      payout.amount = Math.floor(payout.amount * scale);
    }
    totalPayout = WEEKLY_CAP;
  }

  console.log(`  Recipients: ${payouts.length}`);
  console.log(`  Total: ${totalPayout.toLocaleString()} LIST`);
  console.log(`  Weekly Cap: ${WEEKLY_CAP.toLocaleString()} LIST`);

  if (payouts.length === 0) {
    console.log('\n✅ No payouts to process');
    return;
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No tokens sent');
    console.log('    Run with --execute to send payouts');
    return;
  }

  // Execute payouts
  console.log('\n🚀 EXECUTING PAYOUTS...');

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  );

  const marketingWalletSecret = process.env.MARKETING_WALLET_SECRET;
  if (!marketingWalletSecret) {
    console.error('❌ MARKETING_WALLET_SECRET not set in .env');
    return;
  }

  const payer = Keypair.fromSecretKey(bs58.decode(marketingWalletSecret));
  const mint = new PublicKey(LIST_TOKEN_MINT);

  // Check balance
  const balance = await getTokenBalance(connection, payer.publicKey, mint);
  console.log(`  Marketing wallet balance: ${balance.toLocaleString()} LIST`);

  if (balance < totalPayout) {
    console.error(`❌ Insufficient balance. Need ${totalPayout}, have ${balance}`);
    return;
  }

  // Process each payout
  for (const payout of payouts) {
    try {
      const recipient = new PublicKey(payout.wallet);
      const sourceAta = await getAssociatedTokenAddress(mint, payer.publicKey);
      const destAta = await getAssociatedTokenAddress(mint, recipient);

      const tx = new Transaction().add(
        createTransferInstruction(
          sourceAta,
          destAta,
          payer.publicKey,
          BigInt(payout.amount) * BigInt(10 ** DECIMALS)
        )
      );

      const sig = await connection.sendTransaction(tx, [payer]);
      console.log(`  ✅ ${payout.reason}: ${payout.amount} LIST`);
      console.log(`     TX: ${sig}`);

    } catch (error: any) {
      console.error(`  ❌ Failed: ${payout.reason} - ${error.message}`);
    }
  }

  // Mark raid contributions as paid
  for (const raid of unpaidRaids) {
    raid.paid = true;
  }

  // Update ambassador lastPaidAt
  for (const amb of rewards.ambassadors) {
    if (amb.active && !amb.wallet.startsWith('Example')) {
      amb.lastPaidAt = new Date().toISOString();
      amb.totalPaid += Math.floor(amb.monthlyReward / 4);
    }
  }

  // Add to payout history
  rewards.payoutHistory.push({
    date: new Date().toISOString(),
    totalPaid: totalPayout,
    recipients: payouts.length,
  });

  saveRewards(rewards);
  console.log('\n✅ Payouts complete. Rewards tracker updated.');
}

// CLI
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

processPayouts(dryRun).catch(console.error);
