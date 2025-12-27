/**
 * LIST Token Burn Configuration
 *
 * "The more names drop. The more $LIST pops."
 *
 * Total Max Burn: 49% (Epstein) + 15% (Diddy) = 64%
 * Conservative - not all names will confirm
 */

export const LIST_TOKEN_MINT = '5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM';
export const TOTAL_SUPPLY = 9_849_232; // Actual circulating supply
export const DECIMALS = 9;

export type BurnStatus = 'pending' | 'confirmed' | 'resolved_no' | 'executed';

export interface BurnTarget {
  name: string;
  slug: string;
  burnAllocationPercent: number;
  polymarketOdds: number;
  status: BurnStatus;
  resolvedAt?: Date;
  executedAt?: Date;
  burnTxSignature?: string;
}

export interface BurnEvent {
  id: string;
  name: string;
  description: string;
  maxBurnPercent: number;
  targets: BurnTarget[];
  endDate: Date;
  active: boolean;
}

// =============================================================================
// EVENT 1: EPSTEIN LIST - RESOLVED BURNS (Execute Immediately)
// These names have been CONFIRMED on Polymarket - burns are OWED
// =============================================================================
export const EPSTEIN_RESOLVED_BURNS: BurnTarget[] = [
  // Resolved YES - Burns EXECUTED on 2024-12-26
  { name: 'Prince Andrew', slug: 'prince-andrew', burnAllocationPercent: 5.0, polymarketOdds: 36, status: 'executed', resolvedAt: new Date('2024-01-08'), executedAt: new Date('2024-12-26') },
  { name: 'Bill Clinton', slug: 'bill-clinton', burnAllocationPercent: 3.5, polymarketOdds: 25, status: 'executed', resolvedAt: new Date('2024-01-08'), executedAt: new Date('2024-12-26') },
  { name: 'Donald Trump', slug: 'donald-trump', burnAllocationPercent: 2.0, polymarketOdds: 15, status: 'executed', resolvedAt: new Date('2024-01-08'), executedAt: new Date('2024-12-26') },
  { name: 'Alan Dershowitz', slug: 'alan-dershowitz', burnAllocationPercent: 3.5, polymarketOdds: 26, status: 'executed', resolvedAt: new Date('2024-01-08'), executedAt: new Date('2024-12-26') },
  { name: 'Stephen Hawking', slug: 'stephen-hawking', burnAllocationPercent: 3.0, polymarketOdds: 20, status: 'executed', resolvedAt: new Date('2024-01-08'), executedAt: new Date('2024-12-26') },
  { name: 'Bill Gates', slug: 'bill-gates', burnAllocationPercent: 4.5, polymarketOdds: 32, status: 'executed', resolvedAt: new Date('2025-12-20'), executedAt: new Date('2024-12-26') },
  { name: 'Barack Obama', slug: 'barack-obama', burnAllocationPercent: 1.5, polymarketOdds: 10, status: 'executed', resolvedAt: new Date('2025-12-20'), executedAt: new Date('2024-12-26') },
  { name: 'Michael Jackson', slug: 'michael-jackson', burnAllocationPercent: 2.0, polymarketOdds: 12, status: 'executed', resolvedAt: new Date('2025-12-20'), executedAt: new Date('2024-12-26') },
];
// Subtotal: 25%

// =============================================================================
// EVENT 1: EPSTEIN LIST - ACTIVE POLYMARKET (Pending)
// Current active market ending Dec 31, 2025
// =============================================================================
export const EPSTEIN_ACTIVE_BURNS: BurnTarget[] = [
  // Higher probability (>12%) - Updated odds Dec 27, 2024
  { name: 'Henry Kissinger', slug: 'henry-kissinger', burnAllocationPercent: 1.0, polymarketOdds: 15, status: 'pending' },
  { name: 'Tony Blair', slug: 'tony-blair', burnAllocationPercent: 2.5, polymarketOdds: 13, status: 'pending' },
  { name: 'Jamie Dimon', slug: 'jamie-dimon', burnAllocationPercent: 1.5, polymarketOdds: 13, status: 'pending' },
  { name: 'Sean Combs', slug: 'sean-combs', burnAllocationPercent: 1.0, polymarketOdds: 13, status: 'pending' },
  { name: 'Ellen DeGeneres', slug: 'ellen-degeneres', burnAllocationPercent: 1.0, polymarketOdds: 13, status: 'pending' },
  { name: 'Oprah Winfrey', slug: 'oprah-winfrey', burnAllocationPercent: 1.5, polymarketOdds: 12, status: 'pending' },

  // Medium probability (10-12%)
  { name: 'Anderson Cooper', slug: 'anderson-cooper', burnAllocationPercent: 1.0, polymarketOdds: 11, status: 'pending' },
  { name: 'Kirsten Gillibrand', slug: 'kirsten-gillibrand', burnAllocationPercent: 1.5, polymarketOdds: 11, status: 'pending' },
  { name: 'Al Gore', slug: 'al-gore', burnAllocationPercent: 2.0, polymarketOdds: 10, status: 'pending' },
  { name: 'Jimmy Kimmel', slug: 'jimmy-kimmel', burnAllocationPercent: 1.0, polymarketOdds: 9, status: 'pending' },

  // Lower probability (<10%)
  { name: 'Tom Hanks', slug: 'tom-hanks', burnAllocationPercent: 0.5, polymarketOdds: 6, status: 'pending' },
  { name: 'Quentin Tarantino', slug: 'quentin-tarantino', burnAllocationPercent: 1.0, polymarketOdds: 9, status: 'pending' },
  { name: 'Robert Downey Jr.', slug: 'robert-downey-jr', burnAllocationPercent: 1.25, polymarketOdds: 7, status: 'pending' },

  // New names added Dec 27, 2024
  { name: 'David Koch', slug: 'david-koch', burnAllocationPercent: 1.0, polymarketOdds: 14, status: 'pending' },
  { name: 'Piers Morgan', slug: 'piers-morgan', burnAllocationPercent: 0.75, polymarketOdds: 12, status: 'pending' },
  { name: 'Rachel Maddow', slug: 'rachel-maddow', burnAllocationPercent: 0.75, polymarketOdds: 12, status: 'pending' },
];
// Subtotal: 19.25%

// =============================================================================
// EVENT 1: EPSTEIN - COMMUNITY MILESTONES
// =============================================================================
export const EPSTEIN_MILESTONES: BurnTarget[] = [
  { name: '100 Unique Holders', slug: 'holders-100', burnAllocationPercent: 2.0, polymarketOdds: 100, status: 'pending' },
  { name: '500 Unique Holders', slug: 'holders-500', burnAllocationPercent: 3.0, polymarketOdds: 100, status: 'pending' },
  { name: '$25K Daily Volume', slug: 'volume-25k', burnAllocationPercent: 2.0, polymarketOdds: 100, status: 'pending' },
  { name: '$100K Daily Volume', slug: 'volume-100k', burnAllocationPercent: 3.0, polymarketOdds: 100, status: 'pending' },
  { name: '1,000 Twitter Followers', slug: 'twitter-1k', burnAllocationPercent: 1.5, polymarketOdds: 100, status: 'pending' },
  { name: '5,000 Twitter Followers', slug: 'twitter-5k', burnAllocationPercent: 2.5, polymarketOdds: 100, status: 'pending' },
];
// Subtotal: 14%

// =============================================================================
// EVENT 2: DIDDY TRIAL VERDICT (Active Event - 15% Pool)
// Inverse probability burns - less likely = bigger burn
// =============================================================================
export const DIDDY_SENTENCE_BURNS: BurnTarget[] = [
  // Inverse probability: Less likely outcomes = bigger burns
  { name: 'No Prison Time', slug: 'diddy-no-prison', burnAllocationPercent: 8.0, polymarketOdds: 28.6, status: 'pending' },
  { name: 'Life in Prison', slug: 'diddy-life', burnAllocationPercent: 5.0, polymarketOdds: 5, status: 'pending' },
  { name: '20+ Years (Not Life)', slug: 'diddy-20-plus', burnAllocationPercent: 3.0, polymarketOdds: 13.3, status: 'pending' },
  { name: '16-20 Years', slug: 'diddy-16-20', burnAllocationPercent: 1.5, polymarketOdds: 40, status: 'pending' },
  { name: '11-15 Years (Most Likely)', slug: 'diddy-11-15', burnAllocationPercent: 0.5, polymarketOdds: 60, status: 'pending' },
];
// Subtotal: 18% (but only ONE outcome will trigger)

export const DIDDY_BONUS_BURNS: BurnTarget[] = [
  { name: 'Sex Trafficking Conviction', slug: 'diddy-trafficking', burnAllocationPercent: 1.0, polymarketOdds: 75, status: 'pending' },
  { name: 'All Charges Guilty', slug: 'diddy-all-guilty', burnAllocationPercent: 2.0, polymarketOdds: 40, status: 'pending' },
  { name: 'RICO Conviction', slug: 'diddy-rico', burnAllocationPercent: 0.5, polymarketOdds: 65, status: 'pending' },
  { name: 'Celebrity Witness Testifies', slug: 'diddy-celeb-witness', burnAllocationPercent: 0.5, polymarketOdds: 50, status: 'pending' },
];
// Subtotal: 4% (additive bonuses)

// =============================================================================
// AIRDROP CONFIGURATION (Diddy Event)
// =============================================================================
export interface AirdropConfig {
  outcome: string;
  airdropPercent: number;
  minHolding: number;
  maxAirdrop: number;
}

export const DIDDY_AIRDROPS: AirdropConfig[] = [
  { outcome: 'No Prison Time', airdropPercent: 5.0, minHolding: 10_000, maxAirdrop: 500_000 },
  { outcome: 'Life Sentence', airdropPercent: 3.0, minHolding: 10_000, maxAirdrop: 500_000 },
  { outcome: '20+ Years', airdropPercent: 2.0, minHolding: 10_000, maxAirdrop: 500_000 },
  { outcome: 'Other', airdropPercent: 1.0, minHolding: 10_000, maxAirdrop: 500_000 },
];

// =============================================================================
// AGGREGATED EVENTS
// =============================================================================
export const BURN_EVENTS: BurnEvent[] = [
  {
    id: 'epstein-list',
    name: 'Epstein List Revelations',
    description: 'Burns triggered by confirmed names on the Epstein list',
    maxBurnPercent: 49,
    targets: [...EPSTEIN_RESOLVED_BURNS, ...EPSTEIN_ACTIVE_BURNS, ...EPSTEIN_MILESTONES],
    endDate: new Date('2025-12-31'),
    active: true,
  },
  {
    id: 'diddy-trial',
    name: 'Diddy Trial Verdict',
    description: 'Burns tied to Sean Combs trial verdict - inverse probability system',
    maxBurnPercent: 15,
    targets: [...DIDDY_SENTENCE_BURNS, ...DIDDY_BONUS_BURNS],
    endDate: new Date('2025-05-31'), // Trial expected Q1-Q2 2025
    active: true,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function calculateBurnAmount(target: BurnTarget): bigint {
  const burnAmount = (BigInt(TOTAL_SUPPLY) * BigInt(Math.round(target.burnAllocationPercent * 100))) / BigInt(10000);
  return burnAmount * BigInt(10 ** DECIMALS);
}

export function getOwedBurns(): BurnTarget[] {
  return EPSTEIN_RESOLVED_BURNS.filter(t => t.status === 'confirmed');
}

export function getPendingBurns(): BurnTarget[] {
  return [...EPSTEIN_ACTIVE_BURNS, ...EPSTEIN_MILESTONES, ...DIDDY_SENTENCE_BURNS, ...DIDDY_BONUS_BURNS]
    .filter(t => t.status === 'pending');
}

export function getTotalOwedBurnPercent(): number {
  return getOwedBurns().reduce((sum, t) => sum + t.burnAllocationPercent, 0);
}

export function getTotalPendingBurnPercent(): number {
  return getPendingBurns().reduce((sum, t) => sum + t.burnAllocationPercent, 0);
}

export function getEventById(id: string): BurnEvent | undefined {
  return BURN_EVENTS.find(e => e.id === id);
}

export function formatBurnAmount(amount: bigint): string {
  return (Number(amount) / 10 ** DECIMALS).toLocaleString();
}

export function getAllTargets(): BurnTarget[] {
  return [
    ...EPSTEIN_RESOLVED_BURNS,
    ...EPSTEIN_ACTIVE_BURNS,
    ...EPSTEIN_MILESTONES,
    ...DIDDY_SENTENCE_BURNS,
    ...DIDDY_BONUS_BURNS,
  ];
}
