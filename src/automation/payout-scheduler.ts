/**
 * Weekly Payout Scheduler
 *
 * Automatically processes ambassador and raid payouts every Sunday at 6PM
 */

import * as fs from 'fs';
import * as path from 'path';

const REWARDS_FILE = path.join(__dirname, '..', '..', 'data', 'rewards-tracker.json');

export interface Ambassador {
  name: string;
  wallet: string;
  twitter: string;
  tier: string;
  monthlyReward: number;
  totalPaid: number;
  active: boolean;
  role?: string;
  lastPaidAt?: string;
}

export interface RaidContribution {
  wallet: string;
  twitter: string;
  type: string;
  reward: number;
  paid: boolean;
}

export interface PayoutResult {
  recipient: string;
  wallet: string;
  amount: number;
  type: 'ambassador' | 'raid';
  success: boolean;
  error?: string;
}

export interface WeeklyPayoutSummary {
  date: string;
  ambassadorPayouts: PayoutResult[];
  raidPayouts: PayoutResult[];
  totalPaid: number;
  recipientCount: number;
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
  const tempFile = `${REWARDS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, REWARDS_FILE);
}

/**
 * Calculate weekly payout for an ambassador (monthly / 4)
 */
function getWeeklyAmount(monthlyReward: number): number {
  return Math.floor(monthlyReward / 4);
}

/**
 * Check if today is Sunday
 */
export function isPayoutDay(): boolean {
  return new Date().getDay() === 0; // 0 = Sunday
}

/**
 * Check if it's payout time (after 6PM)
 */
export function isPayoutTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18; // 6PM or later
}

/**
 * Process weekly payouts
 * Returns a summary of all payouts processed
 */
export async function processWeeklyPayouts(dryRun = true): Promise<WeeklyPayoutSummary> {
  const data = loadRewards();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const summary: WeeklyPayoutSummary = {
    date: now.toISOString(),
    ambassadorPayouts: [],
    raidPayouts: [],
    totalPaid: 0,
    recipientCount: 0,
  };

  // Check if already paid today
  const lastPayout = data.payoutHistory?.[data.payoutHistory.length - 1];
  if (lastPayout) {
    const lastPayoutDate = lastPayout.date.split('T')[0];
    if (lastPayoutDate === today) {
      console.log('⚠️ Payouts already processed today');
      return summary;
    }
  }

  console.log(`\n💰 Processing weekly payouts (${dryRun ? 'DRY RUN' : 'LIVE'})...`);

  // Process ambassador payouts
  for (const ambassador of data.ambassadors) {
    if (!ambassador.active || ambassador.wallet.startsWith('Example')) continue;

    const weeklyAmount = getWeeklyAmount(ambassador.monthlyReward);

    const result: PayoutResult = {
      recipient: ambassador.twitter,
      wallet: ambassador.wallet,
      amount: weeklyAmount,
      type: 'ambassador',
      success: true,
    };

    if (!dryRun) {
      // In production, this would send the actual tokens
      // For now, just update the tracker
      ambassador.totalPaid += weeklyAmount;
      ambassador.lastPaidAt = now.toISOString();
    }

    console.log(`  📤 ${ambassador.twitter}: ${weeklyAmount} LIST (${ambassador.role || ambassador.tier})`);
    summary.ambassadorPayouts.push(result);
    summary.totalPaid += weeklyAmount;
  }

  // Process raid payouts
  const unpaidRaids = data.raidContributions.filter((r: RaidContribution) =>
    !r.paid && !r.wallet.startsWith('Example')
  );

  // Group by wallet to consolidate payouts
  const raidsByWallet = new Map<string, { twitter: string; total: number; raids: any[] }>();

  for (const raid of unpaidRaids) {
    const existing = raidsByWallet.get(raid.wallet) || { twitter: raid.twitter, total: 0, raids: [] as any[] };
    existing.total += raid.reward;
    existing.raids.push(raid);
    raidsByWallet.set(raid.wallet, existing);
  }

  // Apply weekly cap per person
  const weeklyCap = data.settings?.weeklyCapPerPerson || 5000;

  for (const [wallet, info] of raidsByWallet) {
    const cappedAmount = Math.min(info.total, weeklyCap);

    const result: PayoutResult = {
      recipient: info.twitter,
      wallet,
      amount: cappedAmount,
      type: 'raid',
      success: true,
    };

    if (!dryRun) {
      // Mark raids as paid
      for (const raid of info.raids) {
        raid.paid = true;
      }
    }

    if (cappedAmount !== info.total) {
      console.log(`  📤 ${info.twitter}: ${cappedAmount} LIST (raids, capped from ${info.total})`);
    } else {
      console.log(`  📤 ${info.twitter}: ${cappedAmount} LIST (raids)`);
    }

    summary.raidPayouts.push(result);
    summary.totalPaid += cappedAmount;
  }

  summary.recipientCount = summary.ambassadorPayouts.length + summary.raidPayouts.length;

  // Record payout history
  if (!dryRun && summary.totalPaid > 0) {
    if (!data.payoutHistory) data.payoutHistory = [];
    (data.payoutHistory as any[]).push({
      date: now.toISOString(),
      totalPaid: summary.totalPaid,
      recipients: summary.recipientCount,
    });
    saveRewards(data);
    console.log(`\n✅ Payouts recorded. Total: ${summary.totalPaid} LIST to ${summary.recipientCount} recipients`);
  } else if (dryRun) {
    console.log(`\n📋 DRY RUN complete. Would pay: ${summary.totalPaid} LIST to ${summary.recipientCount} recipients`);
  }

  return summary;
}

/**
 * Check and process payouts if it's the right time
 * Call this from a scheduler/interval
 */
export async function checkAndProcessPayouts(dryRun = true): Promise<WeeklyPayoutSummary | null> {
  if (!isPayoutDay()) {
    return null;
  }

  if (!isPayoutTime()) {
    return null;
  }

  return processWeeklyPayouts(dryRun);
}

/**
 * Get payout preview without executing
 */
export function getPayoutPreview(): { ambassadors: any[]; raids: any[]; total: number } {
  const data = loadRewards();

  const ambassadors = data.ambassadors
    .filter((a: Ambassador) => a.active && !a.wallet.startsWith('Example'))
    .map((a: Ambassador) => ({
      twitter: a.twitter,
      role: a.role || a.tier,
      weeklyAmount: getWeeklyAmount(a.monthlyReward),
    }));

  const raids = data.raidContributions
    .filter((r: RaidContribution) => !r.paid && !r.wallet.startsWith('Example'));

  const raidTotal = raids.reduce((sum: number, r: RaidContribution) => sum + r.reward, 0);
  const ambTotal = ambassadors.reduce((sum: number, a: any) => sum + a.weeklyAmount, 0);

  return {
    ambassadors,
    raids,
    total: ambTotal + Math.min(raidTotal, data.settings?.weeklyCapTotal || 50000),
  };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--live')) {
    console.log('🚨 LIVE MODE - Processing real payouts');
    processWeeklyPayouts(false);
  } else if (args.includes('--preview')) {
    const preview = getPayoutPreview();
    console.log('📋 Payout Preview:');
    console.log('\nAmbassadors:');
    preview.ambassadors.forEach(a => console.log(`  ${a.twitter} (${a.role}): ${a.weeklyAmount} LIST`));
    console.log(`\nRaids: ${preview.raids.length} unpaid`);
    console.log(`\nTotal: ${preview.total} LIST`);
  } else {
    console.log('🔄 DRY RUN - Simulating payouts');
    processWeeklyPayouts(true);
  }
}
