/**
 * Polymarket Odds Updater
 *
 * Fetches current odds from Polymarket and saves to JSON file.
 * Run on a schedule to keep burn target odds up to date.
 */

import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

const POLYMARKET_API = 'https://gamma-api.polymarket.com/events?slug=who-will-be-named-in-newly-released-epstein-files-by-march-31';
const ODDS_FILE = path.join(__dirname, '..', '..', 'data', 'polymarket-odds.json');

export interface OddsEntry {
  name: string;
  slug: string;
  odds: number;
  lastUpdated: string;
}

export interface OddsData {
  lastFetched: string;
  source: string;
  entries: OddsEntry[];
}

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

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function fetchPolymarketOdds(): Promise<OddsEntry[]> {
  const entries: OddsEntry[] = [];
  const now = new Date().toISOString();

  try {
    const data = await fetchJson(POLYMARKET_API);
    const events = Array.isArray(data) ? data : [data];

    for (const event of events) {
      for (const market of event.markets || []) {
        // Extract name from question "Will [Name] be named..."
        const match = market.question?.match(/Will (.+?) be named/i);
        if (!match) continue;

        const name = match[1].trim();

        // Get Yes price from outcomePrices
        const outcomePrices = market.outcomePrices ? JSON.parse(market.outcomePrices) : null;
        if (!outcomePrices || outcomePrices.length < 1) continue;

        const odds = Math.round(parseFloat(outcomePrices[0]) * 100);

        entries.push({
          name,
          slug: nameToSlug(name),
          odds,
          lastUpdated: now,
        });
      }
    }

    // Sort by odds descending
    entries.sort((a, b) => b.odds - a.odds);

    console.log(`✅ Fetched ${entries.length} odds from Polymarket`);
  } catch (error) {
    console.error('❌ Failed to fetch Polymarket odds:', error);
    throw error;
  }

  return entries;
}

export async function updateOddsFile(): Promise<OddsData> {
  const entries = await fetchPolymarketOdds();

  const oddsData: OddsData = {
    lastFetched: new Date().toISOString(),
    source: 'polymarket',
    entries,
  };

  // Ensure data directory exists
  const dataDir = path.dirname(ODDS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write with atomic pattern
  const tempFile = `${ODDS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(oddsData, null, 2));
  fs.renameSync(tempFile, ODDS_FILE);

  console.log(`💾 Saved odds to ${ODDS_FILE}`);
  return oddsData;
}

export function loadOddsFile(): OddsData | null {
  try {
    if (fs.existsSync(ODDS_FILE)) {
      const data = fs.readFileSync(ODDS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load odds file:', error);
  }
  return null;
}

export function getOddsForName(name: string): number | null {
  const data = loadOddsFile();
  if (!data) return null;

  const entry = data.entries.find(
    e => e.name.toLowerCase() === name.toLowerCase()
  );
  return entry?.odds ?? null;
}

// CLI usage
if (require.main === module) {
  console.log('🔄 Updating Polymarket odds...');
  updateOddsFile()
    .then(data => {
      console.log('\nTop 10 by odds:');
      data.entries.slice(0, 10).forEach((e, i) => {
        console.log(`${i + 1}. ${e.name}: ${e.odds}%`);
      });
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
