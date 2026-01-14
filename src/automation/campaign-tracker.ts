/**
 * Holder Push Campaign Tracker
 *
 * Tracks holders, balances, hold duration for airdrop eligibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { LIST_TOKEN_MINT } from '../burn/config';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CAMPAIGN_FILE = path.join(DATA_DIR, 'holder-campaign.json');

// Campaign settings
const CAMPAIGN_CONFIG = {
  name: 'First 100 Holders',
  startDate: new Date().toISOString(),
  holdDays: 15,
  targetHolders: 100,
  tiers: [
    { name: 'Early Bird', minBalance: 5000, reward: 2500 },
    { name: 'Builder', minBalance: 25000, reward: 5000 },
    { name: 'Whale', minBalance: 100000, reward: 10000 },
  ],
};

export interface HolderRecord {
  wallet: string;
  balance: number;
  firstSeen: string;      // ISO date when first detected holding
  lastUpdated: string;    // ISO date of last balance check
  tier: string | null;    // Current tier qualification
  eligible: boolean;      // Has held for required days
  daysHeld: number;       // Days since first seen
}

export interface CampaignData {
  config: typeof CAMPAIGN_CONFIG;
  holders: HolderRecord[];
  snapshots: { date: string; holderCount: number; }[];
  lastFetched: string;
}

/**
 * Load campaign data from file
 */
function loadCampaignData(): CampaignData {
  try {
    if (fs.existsSync(CAMPAIGN_FILE)) {
      const data = fs.readFileSync(CAMPAIGN_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading campaign data:', error);
  }

  // Initialize new campaign
  return {
    config: CAMPAIGN_CONFIG,
    holders: [],
    snapshots: [],
    lastFetched: '',
  };
}

/**
 * Save campaign data to file
 */
function saveCampaignData(data: CampaignData): void {
  const tempFile = `${CAMPAIGN_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, CAMPAIGN_FILE);
}

/**
 * Fetch all token holders from Helius API
 */
async function fetchHoldersFromHelius(heliusApiKey: string): Promise<{ wallet: string; balance: number }[]> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

  try {
    // Get token accounts using Helius RPC
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccounts',
        params: {
          mint: LIST_TOKEN_MINT,
          limit: 1000,
        }
      })
    });

    const data = await response.json();

    if (data.result?.token_accounts) {
      return data.result.token_accounts
        .filter((acc: any) => acc.amount > 0)
        .map((acc: any) => ({
          wallet: acc.owner,
          balance: acc.amount / 1e9, // Convert from raw to decimal (9 decimals)
        }));
    }

    return [];
  } catch (error) {
    console.error('Helius API error:', error);
    return [];
  }
}

/**
 * Fallback: Fetch from Solscan API
 */
async function fetchHoldersFromSolscan(): Promise<{ wallet: string; balance: number }[]> {
  try {
    const response = await fetch(
      `https://api.solscan.io/token/holders?token=${LIST_TOKEN_MINT}&offset=0&size=100`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LIST-Campaign-Tracker',
        }
      }
    );

    const data = await response.json();

    if (data.data?.result) {
      return data.data.result.map((h: any) => ({
        wallet: h.address,
        balance: h.amount / 1e9,
      }));
    }

    return [];
  } catch (error) {
    console.error('Solscan API error:', error);
    return [];
  }
}

/**
 * Calculate tier for a given balance
 */
function calculateTier(balance: number): string | null {
  const tiers = CAMPAIGN_CONFIG.tiers.sort((a, b) => b.minBalance - a.minBalance);

  for (const tier of tiers) {
    if (balance >= tier.minBalance) {
      return tier.name;
    }
  }

  return null;
}

/**
 * Update campaign with latest holder data
 */
export async function updateCampaignData(heliusApiKey?: string): Promise<CampaignData> {
  const campaign = loadCampaignData();
  const now = new Date();
  const nowISO = now.toISOString();

  console.log('📊 Fetching holder data...');

  // Fetch current holders
  let currentHolders: { wallet: string; balance: number }[] = [];

  if (heliusApiKey) {
    currentHolders = await fetchHoldersFromHelius(heliusApiKey);
  }

  // Fallback to Solscan if Helius fails or not configured
  if (currentHolders.length === 0) {
    console.log('   Trying Solscan fallback...');
    currentHolders = await fetchHoldersFromSolscan();
  }

  console.log(`   Found ${currentHolders.length} holders`);

  // Build wallet lookup from existing records
  const existingWallets = new Map<string, HolderRecord>();
  for (const holder of campaign.holders) {
    existingWallets.set(holder.wallet, holder);
  }

  // Update holder records
  const updatedHolders: HolderRecord[] = [];

  for (const holder of currentHolders) {
    const existing = existingWallets.get(holder.wallet);
    const firstSeen = existing?.firstSeen || nowISO;
    const daysHeld = Math.floor((now.getTime() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24));

    updatedHolders.push({
      wallet: holder.wallet,
      balance: holder.balance,
      firstSeen,
      lastUpdated: nowISO,
      tier: calculateTier(holder.balance),
      eligible: daysHeld >= CAMPAIGN_CONFIG.holdDays,
      daysHeld,
    });
  }

  // Sort by balance descending
  updatedHolders.sort((a, b) => b.balance - a.balance);

  // Update campaign
  campaign.holders = updatedHolders;
  campaign.lastFetched = nowISO;

  // Add snapshot
  campaign.snapshots.push({
    date: nowISO,
    holderCount: updatedHolders.length,
  });

  // Keep only last 30 days of snapshots
  if (campaign.snapshots.length > 30) {
    campaign.snapshots = campaign.snapshots.slice(-30);
  }

  saveCampaignData(campaign);

  return campaign;
}

/**
 * Get campaign summary stats
 */
export function getCampaignStats(campaign: CampaignData): {
  totalHolders: number;
  eligibleHolders: number;
  byTier: { tier: string; count: number; totalReward: number }[];
  progress: number;
  daysRemaining: number;
} {
  const eligibleHolders = campaign.holders.filter(h => h.eligible);

  const byTier = CAMPAIGN_CONFIG.tiers.map(tier => {
    const holders = eligibleHolders.filter(h => h.tier === tier.name);
    return {
      tier: tier.name,
      count: holders.length,
      totalReward: holders.length * tier.reward,
    };
  });

  const progress = Math.min(100, (campaign.holders.length / CAMPAIGN_CONFIG.targetHolders) * 100);

  // Calculate days since campaign start
  const startDate = new Date(campaign.config.startDate);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, CAMPAIGN_CONFIG.holdDays - daysSinceStart);

  return {
    totalHolders: campaign.holders.length,
    eligibleHolders: eligibleHolders.length,
    byTier,
    progress,
    daysRemaining,
  };
}

/**
 * Generate airdrop list for eligible holders
 */
export function generateAirdropList(campaign: CampaignData): {
  wallet: string;
  tier: string;
  balance: number;
  reward: number;
  daysHeld: number;
}[] {
  const eligible = campaign.holders.filter(h => h.eligible && h.tier);

  return eligible.map(h => {
    const tierConfig = CAMPAIGN_CONFIG.tiers.find(t => t.name === h.tier);
    return {
      wallet: h.wallet,
      tier: h.tier!,
      balance: h.balance,
      reward: tierConfig?.reward || 0,
      daysHeld: h.daysHeld,
    };
  });
}

/**
 * Format stats for TG message
 */
export function formatStatsForTG(campaign: CampaignData): string {
  const stats = getCampaignStats(campaign);

  const progressBar = '█'.repeat(Math.floor(stats.progress / 10)) +
                      '░'.repeat(10 - Math.floor(stats.progress / 10));

  let msg = `📊 HOLDER CAMPAIGN UPDATE\n\n`;
  msg += `Current: ${stats.totalHolders} holders\n`;
  msg += `Target: ${CAMPAIGN_CONFIG.targetHolders} holders\n`;
  msg += `Progress: ${progressBar} ${stats.progress.toFixed(0)}%\n\n`;

  msg += `✅ Eligible for airdrop: ${stats.eligibleHolders}\n`;
  msg += `⏳ Still in holding period: ${stats.totalHolders - stats.eligibleHolders}\n\n`;

  msg += `📦 By Tier:\n`;
  for (const tier of stats.byTier) {
    msg += `• ${tier.tier}: ${tier.count} holders (${tier.totalReward.toLocaleString()} LIST)\n`;
  }

  msg += `\n🔗 ${stats.daysRemaining} days until first holders eligible`;

  return msg;
}

/**
 * CLI and scheduler entry point
 */
export async function runCampaignUpdate(): Promise<void> {
  const heliusKey = process.env.HELIUS_API_KEY;

  const campaign = await updateCampaignData(heliusKey);
  const stats = getCampaignStats(campaign);

  console.log('\n📊 Campaign Stats:');
  console.log(`   Holders: ${stats.totalHolders} / ${CAMPAIGN_CONFIG.targetHolders}`);
  console.log(`   Eligible: ${stats.eligibleHolders}`);
  console.log(`   Progress: ${stats.progress.toFixed(1)}%`);

  console.log('\n   By Tier:');
  for (const tier of stats.byTier) {
    console.log(`   • ${tier.tier}: ${tier.count} holders`);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--airdrop')) {
    const campaign = loadCampaignData();
    const list = generateAirdropList(campaign);
    console.log('\n🎁 Airdrop List:');
    console.log(JSON.stringify(list, null, 2));
  } else if (args.includes('--tg')) {
    const campaign = loadCampaignData();
    console.log(formatStatsForTG(campaign));
  } else {
    runCampaignUpdate().catch(console.error);
  }
}
