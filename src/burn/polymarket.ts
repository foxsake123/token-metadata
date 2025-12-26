/**
 * Polymarket Integration for LIST Token Burns
 *
 * Fetches current odds and resolution status from Polymarket
 * to determine when burns should be triggered.
 */

import { BurnTarget, BURN_TARGETS } from './config';

const POLYMARKET_API_BASE = 'https://gamma-api.polymarket.com';
const EPSTEIN_EVENT_SLUG = 'who-will-be-named-in-newly-released-epstein-files';

export interface PolymarketOutcome {
  name: string;
  price: number; // 0-1 representing odds
  resolved: boolean;
  winner: boolean;
}

export interface PolymarketMarket {
  slug: string;
  question: string;
  outcomes: PolymarketOutcome[];
  resolved: boolean;
  resolutionDate?: string;
}

/**
 * Fetch current odds for all Epstein list predictions
 */
export async function fetchPolymarketOdds(): Promise<Map<string, number>> {
  const oddsMap = new Map<string, number>();

  try {
    const response = await fetch(`${POLYMARKET_API_BASE}/events/${EPSTEIN_EVENT_SLUG}`);
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    for (const market of data.markets || []) {
      const yesOutcome = market.outcomes?.find((o: PolymarketOutcome) => o.name === 'Yes');
      if (yesOutcome) {
        // Extract name from market question
        const name = extractNameFromQuestion(market.question);
        if (name) {
          oddsMap.set(name.toLowerCase(), yesOutcome.price * 100);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch Polymarket odds:', error);
  }

  return oddsMap;
}

/**
 * Check which predictions have been confirmed (resolved to Yes)
 */
export async function checkConfirmedPredictions(): Promise<string[]> {
  const confirmed: string[] = [];

  try {
    const response = await fetch(`${POLYMARKET_API_BASE}/events/${EPSTEIN_EVENT_SLUG}`);
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    for (const market of data.markets || []) {
      if (market.resolved) {
        const yesOutcome = market.outcomes?.find((o: PolymarketOutcome) => o.name === 'Yes');
        if (yesOutcome?.winner) {
          const name = extractNameFromQuestion(market.question);
          if (name) {
            confirmed.push(name);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to check Polymarket resolutions:', error);
  }

  return confirmed;
}

/**
 * Get burn targets that are ready to execute (confirmed on Polymarket but not yet burned)
 */
export async function getPendingBurns(targets: BurnTarget[]): Promise<BurnTarget[]> {
  const confirmed = await checkConfirmedPredictions();
  const confirmedLower = confirmed.map(n => n.toLowerCase());

  return targets.filter(
    t => t.status === 'pending' && confirmedLower.includes(t.name.toLowerCase())
  );
}

/**
 * Update target odds from Polymarket
 */
export async function updateTargetOdds(targets: BurnTarget[]): Promise<BurnTarget[]> {
  const odds = await fetchPolymarketOdds();

  return targets.map(target => {
    const currentOdds = odds.get(target.name.toLowerCase());
    if (currentOdds !== undefined) {
      return { ...target, currentOdds };
    }
    return target;
  });
}

function extractNameFromQuestion(question: string): string | null {
  // Questions are typically "Will [Name] be named in..."
  const match = question.match(/Will (.+?) be named/i);
  return match ? match[1].trim() : null;
}
