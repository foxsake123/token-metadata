/**
 * Epstein News Raid System
 *
 * Monitors for Epstein-related news and posts raid targets to TG
 */

import https from 'https';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// News sources to check for Epstein content
const NEWS_RSS_FEEDS = [
  'https://news.google.com/rss/search?q=epstein+files&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=epstein+documents+DOJ&hl=en-US&gl=US&ceid=US:en',
];

// Keywords to match
const RAID_KEYWORDS = [
  'epstein',
  'epstein files',
  'epstein documents',
  'epstein list',
  'doj epstein',
  'maxwell',
  'little st james',
];

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface RaidTarget {
  title: string;
  url: string;
  reason: string;
  postedAt: Date;
}

// Track recently posted raids to avoid duplicates
const recentRaids: Map<string, Date> = new Map();
const RAID_COOLDOWN_HOURS = 6;

/**
 * Fetch RSS feed and parse items
 */
async function fetchRSS(url: string): Promise<NewsItem[]> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const items: NewsItem[] = [];
          // Simple RSS parsing
          const itemMatches = data.match(/<item>([\s\S]*?)<\/item>/g) || [];

          for (const item of itemMatches.slice(0, 5)) {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
            const source = item.match(/<source.*?>(.*?)<\/source>/)?.[1] || 'News';

            if (title && link) {
              items.push({
                title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
                link,
                pubDate,
                source,
              });
            }
          }
          resolve(items);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

/**
 * Check if news item is relevant for raiding
 */
function isRaidWorthy(item: NewsItem): boolean {
  const titleLower = item.title.toLowerCase();
  return RAID_KEYWORDS.some(keyword => titleLower.includes(keyword));
}

/**
 * Check if we already raided this recently
 */
function wasRecentlyRaided(url: string): boolean {
  const lastRaided = recentRaids.get(url);
  if (!lastRaided) return false;

  const hoursSince = (Date.now() - lastRaided.getTime()) / (1000 * 60 * 60);
  return hoursSince < RAID_COOLDOWN_HOURS;
}

/**
 * Post raid target to Telegram
 */
async function postRaidTarget(target: RaidTarget): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    console.log('TG not configured for raids');
    return false;
  }

  const message = `⚔️ RAID TARGET ⚔️

📰 ${target.title}

🔗 ${target.url}

Instructions:
1. Find related tweets about this story
2. Reply mentioning $LIST
3. Like & repost our comments
4. Screenshot & share here

The Epstein story = $LIST exposure 🔥`;

  try {
    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    await new Promise<void>((resolve, reject) => {
      const postData = JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        text: message,
        disable_web_page_preview: false,
      });

      const req = https.request(tgUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    recentRaids.set(target.url, new Date());
    console.log(`📢 Raid target posted: ${target.title.slice(0, 50)}...`);
    return true;
  } catch (err) {
    console.error('Failed to post raid target:', err);
    return false;
  }
}

/**
 * Check for new raid-worthy news
 */
export async function checkForRaidTargets(): Promise<RaidTarget[]> {
  const targets: RaidTarget[] = [];

  console.log('🔍 Checking for Epstein news...');

  for (const feedUrl of NEWS_RSS_FEEDS) {
    const items = await fetchRSS(feedUrl);

    for (const item of items) {
      if (isRaidWorthy(item) && !wasRecentlyRaided(item.link)) {
        targets.push({
          title: item.title,
          url: item.link,
          reason: 'Epstein-related news',
          postedAt: new Date(),
        });
      }
    }
  }

  console.log(`   Found ${targets.length} potential raid targets`);
  return targets;
}

/**
 * Run news raid check and post targets
 */
export async function runNewsRaid(): Promise<number> {
  const targets = await checkForRaidTargets();
  let posted = 0;

  // Post max 1 raid per check to avoid spam
  if (targets.length > 0) {
    const success = await postRaidTarget(targets[0]);
    if (success) posted++;
  }

  return posted;
}

/**
 * Start the news raid scheduler
 */
export function startNewsRaidScheduler(intervalMinutes = 60): ReturnType<typeof setInterval> {
  console.log(`📰 News raid scheduler starting (every ${intervalMinutes} min)`);

  // Run immediately
  runNewsRaid().catch(err => console.error('News raid error:', err));

  // Then run on interval
  return setInterval(() => {
    runNewsRaid().catch(err => console.error('News raid error:', err));
  }, intervalMinutes * 60 * 1000);
}

// CLI usage
if (require.main === module) {
  console.log('🔍 Running manual news raid check...');
  checkForRaidTargets().then(targets => {
    console.log('\nFound targets:');
    targets.forEach((t, i) => {
      console.log(`${i + 1}. ${t.title}`);
      console.log(`   ${t.url}\n`);
    });
  });
}
