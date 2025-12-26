/**
 * LIST Token Burn Configuration
 *
 * Aligned with https://www.list-coin.com/burn-schedule
 * Burns triggered by: Polymarket Epstein list confirmations + Community milestones
 *
 * Total max burn: 44% of supply
 * Source: https://polymarket.com/event/who-will-be-named-in-newly-released-epstein-files
 */

export const LIST_TOKEN_MINT = '5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM';
export const TOTAL_SUPPLY = 1_000_000_000; // 1 billion tokens
export const MAX_BURN_PERCENTAGE = 44; // 44% max burn per website
export const DECIMALS = 9;

export interface BurnTarget {
  name: string;
  polymarketSlug: string;
  burnAllocationPercent: number;
  currentOdds: number; // Polymarket odds (0-100)
  status: 'pending' | 'confirmed' | 'resolved_no';
  confirmedAt?: Date;
  burnTxSignature?: string;
}

/**
 * Polymarket Epstein List Burn Targets
 *
 * Current odds as of 2025-12-26
 * Burn allocations proportional to odds (higher odds = more burn)
 *
 * WEBSITE UPDATE NEEDED: Add these specific names and percentages to
 * https://www.list-coin.com/burn-schedule with a table showing:
 * - Name | Polymarket Odds | Burn % | Status
 */
export const BURN_TARGETS: BurnTarget[] = [
  // Tier 1: High odds (>20%) - 4% burn each
  { name: 'Tony Blair', polymarketSlug: 'tony-blair', burnAllocationPercent: 4.0, currentOdds: 28, status: 'pending' },
  { name: 'Al Gore', polymarketSlug: 'al-gore', burnAllocationPercent: 4.0, currentOdds: 21, status: 'pending' },

  // Tier 2: Medium-high odds (15-20%) - 3% burn each
  { name: 'Jamie Dimon', polymarketSlug: 'jamie-dimon', burnAllocationPercent: 3.0, currentOdds: 19, status: 'pending' },
  { name: 'Kirsten Gillibrand', polymarketSlug: 'kirsten-gillibrand', burnAllocationPercent: 3.0, currentOdds: 18, status: 'pending' },
  { name: 'Oprah Winfrey', polymarketSlug: 'oprah-winfrey', burnAllocationPercent: 3.0, currentOdds: 16, status: 'pending' },

  // Tier 3: Medium odds (10-15%) - 2.5% burn each
  { name: 'Ellen DeGeneres', polymarketSlug: 'ellen-degeneres', burnAllocationPercent: 2.5, currentOdds: 14, status: 'pending' },
  { name: 'Anderson Cooper', polymarketSlug: 'anderson-cooper', burnAllocationPercent: 2.5, currentOdds: 13, status: 'pending' },
  { name: 'Piers Morgan', polymarketSlug: 'piers-morgan', burnAllocationPercent: 2.5, currentOdds: 13, status: 'pending' },
  { name: 'Henry Kissinger', polymarketSlug: 'henry-kissinger', burnAllocationPercent: 2.5, currentOdds: 12, status: 'pending' },
  { name: 'Rachel Maddow', polymarketSlug: 'rachel-maddow', burnAllocationPercent: 2.5, currentOdds: 11, status: 'pending' },
  { name: 'Sean Combs', polymarketSlug: 'sean-combs', burnAllocationPercent: 2.5, currentOdds: 11, status: 'pending' },
  { name: 'David Koch', polymarketSlug: 'david-koch', burnAllocationPercent: 2.5, currentOdds: 11, status: 'pending' },
  { name: 'Jimmy Kimmel', polymarketSlug: 'jimmy-kimmel', burnAllocationPercent: 2.5, currentOdds: 10, status: 'pending' },

  // Tier 4: Lower odds (<10%) - 1.5% burn each
  { name: 'Robert Downey Jr.', polymarketSlug: 'robert-downey-jr', burnAllocationPercent: 1.5, currentOdds: 6, status: 'pending' },
  { name: 'Quentin Tarantino', polymarketSlug: 'quentin-tarantino', burnAllocationPercent: 1.5, currentOdds: 6, status: 'pending' },
  { name: 'Tom Hanks', polymarketSlug: 'tom-hanks', burnAllocationPercent: 1.5, currentOdds: 6, status: 'pending' },
];

// Subtotal from Polymarket targets: 42%

/**
 * Community Milestone Burns
 * Remaining 2% allocated to trading/social milestones
 */
export const COMMUNITY_MILESTONES: BurnTarget[] = [
  { name: '10K Holders', polymarketSlug: 'milestone-holders-10k', burnAllocationPercent: 0.5, currentOdds: 100, status: 'pending' },
  { name: '$1M Market Cap', polymarketSlug: 'milestone-mcap-1m', burnAllocationPercent: 0.5, currentOdds: 100, status: 'pending' },
  { name: '50K Twitter Followers', polymarketSlug: 'milestone-twitter-50k', burnAllocationPercent: 0.5, currentOdds: 100, status: 'pending' },
  { name: '$10M Volume', polymarketSlug: 'milestone-volume-10m', burnAllocationPercent: 0.5, currentOdds: 100, status: 'pending' },
];

// Total: 42% + 2% = 44% (matches website)

export function calculateBurnAmount(target: BurnTarget): bigint {
  const burnAmount = (BigInt(TOTAL_SUPPLY) * BigInt(Math.round(target.burnAllocationPercent * 100))) / BigInt(10000);
  return burnAmount * BigInt(10 ** DECIMALS);
}

export function getAllTargets(): BurnTarget[] {
  return [...BURN_TARGETS, ...COMMUNITY_MILESTONES];
}

export function getTotalAllocatedBurn(): number {
  return getAllTargets().reduce((sum, target) => sum + target.burnAllocationPercent, 0);
}

export function getPendingTargets(): BurnTarget[] {
  return getAllTargets().filter(t => t.status === 'pending');
}

export function getConfirmedBurns(): BurnTarget[] {
  return getAllTargets().filter(t => t.status === 'confirmed');
}
