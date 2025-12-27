/**
 * Polymarket Integration for LIST Token Burns
 *
 * Fetches current odds and resolution status from Polymarket
 * to determine when burns should be triggered.
 */

import { BurnTarget } from './config';

const POLYMARKET_API_BASE = 'https://gamma-api.polymarket.com';
const EPSTEIN_EVENT_SLUG = 'who-will-be-named-in-newly-released-epstein-files';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors (5xx) or rate limits
      if (response.status >= 500 || response.status === 429) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.log(`⏳ API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      console.log(`⏳ Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries}): ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

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

// Custom error class for Polymarket API errors
export class PolymarketError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'PolymarketError';
  }
}

/**
 * Fetch current odds for all Epstein list predictions
 */
export async function fetchPolymarketOdds(): Promise<Map<string, number>> {
  const oddsMap = new Map<string, number>();

  try {
    // API uses query parameter format: /events?slug=xxx
    const response = await fetchWithRetry(`${POLYMARKET_API_BASE}/events?slug=${EPSTEIN_EVENT_SLUG}`);
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    // Response is an array of events
    const events = Array.isArray(data) ? data : [data];

    for (const event of events) {
      for (const market of event.markets || []) {
        // Get the Yes outcome price from outcomePrices array
        const outcomePrices = market.outcomePrices ? JSON.parse(market.outcomePrices) : null;
        if (outcomePrices && outcomePrices.length >= 1) {
          const yesPrice = parseFloat(outcomePrices[0]) * 100; // Convert to percentage
          const name = extractNameFromQuestion(market.question);
          if (name) {
            oddsMap.set(name.toLowerCase(), yesPrice);
          }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to fetch Polymarket odds: ${errorMessage}`);
    // Re-throw as PolymarketError so callers can handle appropriately
    throw new PolymarketError(
      `Failed to fetch odds: ${errorMessage}`,
      undefined,
      error instanceof Error && error.message.includes('network')
    );
  }

  return oddsMap;
}

/**
 * Check which predictions have been confirmed (resolved to Yes)
 */
export async function checkConfirmedPredictions(): Promise<string[]> {
  const confirmed: string[] = [];

  try {
    // API uses query parameter format: /events?slug=xxx
    const response = await fetchWithRetry(`${POLYMARKET_API_BASE}/events?slug=${EPSTEIN_EVENT_SLUG}`);
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    // Response is an array of events
    const events = Array.isArray(data) ? data : [data];

    for (const event of events) {
      for (const market of event.markets || []) {
        // Check if market is closed and resolved to Yes
        if (market.closed) {
          const outcomePrices = market.outcomePrices ? JSON.parse(market.outcomePrices) : null;
          // If Yes price is 1.0 (100%), it resolved to Yes
          if (outcomePrices && parseFloat(outcomePrices[0]) === 1) {
            const name = extractNameFromQuestion(market.question);
            if (name) {
              confirmed.push(name);
            }
          }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to check Polymarket resolutions: ${errorMessage}`);
    // Re-throw so callers know something went wrong
    throw new PolymarketError(
      `Failed to check resolutions: ${errorMessage}`,
      undefined,
      error instanceof Error && error.message.includes('network')
    );
  }

  return confirmed;
}

/**
 * Get burn targets that are ready to execute (confirmed on Polymarket but not yet burned)
 */
export async function getConfirmedBurns(targets: BurnTarget[]): Promise<BurnTarget[]> {
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
