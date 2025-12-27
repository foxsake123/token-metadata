/**
 * LIST Token Social Media Automation
 *
 * Automated tweet generation and scheduling for:
 * - Burn announcements
 * - Polymarket odds updates
 * - Milestone celebrations
 * - Community engagement
 */

import {
  BurnTarget,
  EPSTEIN_ACTIVE_BURNS,
  calculateBurnAmount,
  formatBurnAmount,
  getTotalOwedBurnPercent,
} from '../burn/config';
import {
  StoredPost,
  saveScheduledPosts,
  loadScheduledPosts,
  needsCalendarRegeneration,
  markPostAsPosted,
  getDueScheduledPosts,
  getUpcomingScheduledPosts,
} from './storage';

// =============================================================================
// TWEET TEMPLATES
// =============================================================================

export const TWEET_TEMPLATES = {
  // Burn execution tweets
  burnExecuted: [
    `🔥 BURN ALERT 🔥\n\n{name} just got CONFIRMED on the list.\n\n{percent}% of $LIST supply = GONE FOREVER\n\n{amount} tokens burned 💀\n\nTX: {txLink}\n\n#LIST #Solana #TokenBurn`,

    `THE LIST GROWS 📜\n\n{name} ✅ CONFIRMED\n\n🔥 {percent}% BURNED\n💀 {amount} $LIST destroyed\n\nThe more names drop...\nThe more $LIST pops 📈\n\n#Solana #Memecoin`,

    `⚠️ BREAKING ⚠️\n\n{name} added to the list.\n\nConsequence? {percent}% of $LIST\nburned on-chain. Forever.\n\n{amount} tokens 🔥\n\nVerify: {txLink}\n\n#LIST #CryptoTwitter`,
  ],

  // Burn scheduled tweets
  burnScheduled: [
    `🚨 BURN INCOMING 🚨\n\n{name} just confirmed on Polymarket!\n\n{percent}% burn executing soon...\n\nGet your $LIST before it's too late 👀\n\n#LIST #Solana`,

    `👀 NEW NAME DROPPED\n\n{name} is ON THE LIST\n\nBurn scheduled: {percent}%\n\nTick tock... 🔥\n\n#LIST #TokenBurn`,
  ],

  // Polymarket odds updates
  oddsUpdate: [
    `📊 POLYMARKET UPDATE\n\nHottest $LIST burn candidates:\n\n{oddsList}\n\nWho's next? 👀\n\nTrack live: polymarket.com\n\n#LIST #Polymarket`,

    `🎰 ODDS CHECK\n\n{topName}: {topOdds}% chance\n{secondName}: {secondOdds}% chance\n\nIf confirmed = MASSIVE BURNS 🔥\n\nAre you holding $LIST?\n\n#Solana #Memecoin`,
  ],

  // Milestone tweets
  milestone: [
    `🏆 MILESTONE UNLOCKED 🏆\n\n{milestone} achieved!\n\nReward: {percent}% BURN 🔥\n\nThank you $LIST army! 🫡\n\n#LIST #Community`,

    `WE DID IT! 🎉\n\n{milestone} ✅\n\nBurning {percent}% to celebrate!\n\nOnward to the next goal 🚀\n\n#LIST #Solana`,
  ],

  // Diddy trial tweets
  diddyVerdict: [
    `⚖️ DIDDY VERDICT IS IN ⚖️\n\n{verdict}\n\nBurn triggered: {percent}%\n{bonuses}\n\nTotal burn: {totalPercent}% 🔥\n\nAirdrops incoming for holders! 💰\n\n#Diddy #LIST`,

    `🔔 BREAKING: DIDDY SENTENCED\n\n{verdict}\n\n$LIST response:\n🔥 {percent}% burned\n💰 {airdropPercent}% airdrop to holders\n\nThe truth always wins.\n\n#LIST #Justice`,
  ],

  // Engagement tweets
  engagement: [
    `The more names drop.\nThe more $LIST pops. 📈\n\n{burned}% already burned 🔥\n{pending}% more waiting...\n\nWho's next on the list? 👇\n\n#LIST #Solana`,

    `$LIST BURN TRACKER 🔥\n\n✅ Burned: {burned}%\n⏳ Pending: {pending}%\n📊 Next target: {nextName}\n\nAre you positioned? 👀\n\n#Memecoin #Solana`,

    `Why $LIST?\n\n✅ Real burns tied to real events\n✅ Polymarket verified\n✅ On-chain transparency\n✅ Deflationary by design\n\nThe truth token. 🔥\n\n#LIST #Solana`,
  ],

  // FOMO tweets
  fomo: [
    `Imagine not holding $LIST when the next name drops... 📜\n\nEvery confirmation = permanent burn\nEvery burn = less supply\n\n🔥🔥🔥\n\n#LIST #FOMO`,

    `⚠️ PSA ⚠️\n\nWhen Polymarket confirms a name:\n→ We burn tokens\n→ Supply decreases\n→ You wish you bought more\n\nDon't say we didn't warn you.\n\n$LIST 🔥`,
  ],

  // Countdown tweets
  countdown: [
    `⏰ {days} DAYS LEFT\n\nPolymarket Epstein market closes Dec 31\n\nAny confirmations before then = BURNS\n\nTime is running out to accumulate $LIST 👀\n\n#Solana`,

    `📅 COUNTDOWN\n\nDiddy trial approaching...\n\nVerdict possibilities:\n• No Prison: 8% burn\n• Life: 5% burn\n• 20+ years: 3% burn\n\nPlus bonuses 🔥\n\nAre you ready?\n\n#LIST`,
  ],

  // News jacking - react to current events
  newsJacking: [
    `Everyone talking about {topic}...\n\nMeanwhile $LIST is quietly burning supply every time a name drops 🔥\n\nOn-chain. Verified. Permanent.\n\n#LIST #Solana`,

    `Breaking news about {topic}?\n\n$LIST holders: "Add it to the list" 📜\n\nThe truth always comes out.\n\n#LIST`,

    `{topic} trending?\n\nReminder: We've already burned 25% of supply.\n\n8 names confirmed.\n8 burns executed.\n\nWho's next? 👀\n\n$LIST`,
  ],

  // Meme formats
  meme: [
    `Other tokens: "We might burn someday"\n\n$LIST: *burns 25% in first month*\n\n📜🔥\n\n#Solana #Memecoin`,

    `POV: You didn't buy $LIST before the next name dropped\n\n😭😭😭\n\n#LIST #FOMO`,

    `Normal people: "What's on the list?"\n\n$LIST holders: "Who's NEXT on the list?" 👀\n\n#Solana`,

    `Me explaining $LIST to my friends:\n\n"So when someone gets exposed, we burn tokens"\n\n"That's the whole thing?"\n\n"Yes. And it's beautiful." 🔥\n\n#LIST`,

    `$LIST tokenomics:\n\n✅ Name drops\n✅ We burn\n✅ Supply goes down\n✅ Repeat\n\nIt's that simple. 📜🔥\n\n#Solana`,
  ],

  // Engagement bait - questions and polls
  engagementBait: [
    `Who do you think is next on the list? 👇\n\nDrop your predictions below.\n\nMost upvoted = we make a meme about it 😂\n\n$LIST #Solana`,

    `Quick poll:\n\nHow much $LIST are you holding?\n\n🔥 < 10K\n🔥🔥 10K - 100K\n🔥🔥🔥 100K - 1M\n🔥🔥🔥🔥 1M+\n\nComment below 👇`,

    `Wrong answers only:\n\nWhy are you holding $LIST? 😂\n\n#LIST #Solana`,

    `Finish this sentence:\n\n"I'm holding $LIST because ___________"\n\nBest answer gets a shoutout 🔥\n\n#Solana`,

    `Rate your $LIST bag:\n\n😢 Paper hands\n😐 Just started\n😊 Comfy\n🤑 Whale alert\n\n#LIST`,
  ],

  // Supply shock / scarcity
  supplyShock: [
    `Supply update:\n\n🔴 Started: 9,849,232 LIST\n🟢 Now: 7,386,928 LIST\n📉 Burned: 2,462,304 LIST (25%)\n\nAnd we're just getting started.\n\n$LIST #Solana`,

    `Every burn = permanent removal\n\nNo mint function.\nNo inflation.\nNo rug.\n\nJust burns. 🔥\n\n$LIST`,

    `Math time:\n\n25% burned ✅\n19% more pending ⏳\n\nPotential total burn: 44%\n\nLess than half the supply could remain.\n\nAre you positioned?\n\n$LIST #Solana`,
  ],

  // Proof / transparency
  proof: [
    `Don't trust, verify.\n\nEvery $LIST burn:\n✅ On-chain TX\n✅ Solscan link\n✅ Permanent record\n\nNo fake burns. No promises.\nJust proof. 🔥\n\nsolscan.io/token/{token}\n\n#Solana`,

    `"Prove it"\n\nOk:\n\n🔗 Prince Andrew burn: solscan.io/tx/...\n🔗 Bill Gates burn: solscan.io/tx/...\n🔗 8 total burns executed\n\nAll on-chain. All verifiable.\n\n$LIST`,
  ],
};

// =============================================================================
// TWEET GENERATOR
// =============================================================================

export interface TweetData {
  template: string;
  content: string;
  scheduledFor?: Date;
  type: 'burn' | 'milestone' | 'odds' | 'engagement' | 'verdict';
}

export class TweetGenerator {
  /**
   * Generate burn execution tweet
   */
  static burnExecuted(target: BurnTarget, txSignature: string): TweetData {
    const templates = TWEET_TEMPLATES.burnExecuted;
    const template = templates[Math.floor(Math.random() * templates.length)];

    const amount = formatBurnAmount(calculateBurnAmount(target));
    const txLink = `solscan.io/tx/${txSignature}`;

    const content = template
      .replace('{name}', target.name)
      .replace('{percent}', target.burnAllocationPercent.toString())
      .replace('{amount}', amount)
      .replace('{txLink}', txLink);

    return { template, content, type: 'burn' };
  }

  /**
   * Generate burn scheduled tweet
   */
  static burnScheduled(target: BurnTarget): TweetData {
    const templates = TWEET_TEMPLATES.burnScheduled;
    const template = templates[Math.floor(Math.random() * templates.length)];

    const content = template
      .replace('{name}', target.name)
      .replace('{percent}', target.burnAllocationPercent.toString());

    return { template, content, type: 'burn' };
  }

  /**
   * Generate odds update tweet
   */
  static oddsUpdate(targets: BurnTarget[]): TweetData {
    const sorted = [...targets].sort((a, b) => b.polymarketOdds - a.polymarketOdds);
    const top5 = sorted.slice(0, 5);

    const oddsList = top5
      .map((t, i) => `${i + 1}. ${t.name}: ${t.polymarketOdds}%`)
      .join('\n');

    const template = TWEET_TEMPLATES.oddsUpdate[0];
    const content = template
      .replace('{oddsList}', oddsList)
      .replace('{topName}', top5[0]?.name || 'TBD')
      .replace('{topOdds}', top5[0]?.polymarketOdds.toString() || '0')
      .replace('{secondName}', top5[1]?.name || 'TBD')
      .replace('{secondOdds}', top5[1]?.polymarketOdds.toString() || '0');

    return { template, content, type: 'odds' };
  }

  /**
   * Generate milestone tweet
   */
  static milestone(milestoneName: string, burnPercent: number): TweetData {
    const templates = TWEET_TEMPLATES.milestone;
    const template = templates[Math.floor(Math.random() * templates.length)];

    const content = template
      .replace('{milestone}', milestoneName)
      .replace('{percent}', burnPercent.toString());

    return { template, content, type: 'milestone' };
  }

  /**
   * Generate Diddy verdict tweet
   */
  static diddyVerdict(
    verdict: string,
    burnPercent: number,
    bonuses: string[],
    airdropPercent: number
  ): TweetData {
    const templates = TWEET_TEMPLATES.diddyVerdict;
    const template = templates[Math.floor(Math.random() * templates.length)];

    const bonusText = bonuses.length > 0
      ? `Bonuses: ${bonuses.join(', ')}`
      : 'No bonus conditions met';

    const totalPercent = burnPercent + bonuses.length * 0.5; // Rough estimate

    const content = template
      .replace('{verdict}', verdict)
      .replace('{percent}', burnPercent.toString())
      .replace('{bonuses}', bonusText)
      .replace('{totalPercent}', totalPercent.toString())
      .replace('{airdropPercent}', airdropPercent.toString());

    return { template, content, type: 'verdict' };
  }

  /**
   * Generate engagement tweet
   */
  static engagement(burnedPercent: number, pendingPercent: number, nextTarget?: string): TweetData {
    const templates = TWEET_TEMPLATES.engagement;
    const template = templates[Math.floor(Math.random() * templates.length)];

    const content = template
      .replace('{burned}', burnedPercent.toString())
      .replace('{pending}', pendingPercent.toString())
      .replace('{nextName}', nextTarget || 'TBD');

    return { template, content, type: 'engagement' };
  }

  /**
   * Generate countdown tweet
   */
  static countdown(daysLeft: number, event: 'epstein' | 'diddy'): TweetData {
    const templates = TWEET_TEMPLATES.countdown;
    const template = event === 'epstein' ? templates[0] : templates[1];

    const content = template.replace('{days}', daysLeft.toString());

    return { template, content, type: 'engagement' };
  }

  /**
   * Generate FOMO tweet
   */
  static fomo(): TweetData {
    const templates = TWEET_TEMPLATES.fomo;
    const template = templates[Math.floor(Math.random() * templates.length)];

    return { template, content: template, type: 'engagement' };
  }
}

// =============================================================================
// CONTENT CALENDAR
// =============================================================================

export interface ScheduledPost {
  id?: string;
  content: string;
  scheduledFor: Date;
  type: string;
  posted: boolean;
}

function generatePostId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export class ContentCalendar {
  private posts: ScheduledPost[] = [];

  constructor() {
    // Load existing posts from storage on initialization
    this.loadFromStorage();
  }

  /**
   * Load posts from persistent storage
   */
  private loadFromStorage(): void {
    const stored = loadScheduledPosts();
    this.posts = stored.map(p => ({
      id: p.id,
      content: p.content,
      scheduledFor: new Date(p.scheduledFor),
      type: p.type,
      posted: p.posted,
    }));
    console.log(`📅 Loaded ${this.posts.length} posts from storage`);
  }

  /**
   * Save current posts to persistent storage
   */
  private saveToStorage(): void {
    const toStore: StoredPost[] = this.posts.map(p => ({
      id: p.id || generatePostId(),
      content: p.content,
      scheduledFor: p.scheduledFor.toISOString(),
      type: p.type,
      posted: p.posted,
    }));
    saveScheduledPosts(toStore);
  }

  /**
   * Generate a week's worth of content (only if needed)
   */
  generateWeeklyContent(): ScheduledPost[] {
    // Check if regeneration is needed
    if (!needsCalendarRegeneration() && this.posts.length > 0) {
      console.log('📅 Using existing calendar (still valid)');
      return this.posts;
    }

    console.log('📅 Generating new weekly content...');
    const now = new Date();
    const posts: ScheduledPost[] = [];

    // Daily: Odds update (morning)
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      date.setHours(9, 0, 0, 0); // 9 AM

      const tweet = TweetGenerator.oddsUpdate(EPSTEIN_ACTIVE_BURNS);
      posts.push({
        id: generatePostId(),
        content: tweet.content,
        scheduledFor: date,
        type: 'odds',
        posted: false,
      });
    }

    // Every other day: Engagement tweet (afternoon)
    for (let i = 0; i < 7; i += 2) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      date.setHours(14, 0, 0, 0); // 2 PM

      const owedPercent = getTotalOwedBurnPercent();
      const tweet = TweetGenerator.engagement(owedPercent, 44 - owedPercent);
      posts.push({
        id: generatePostId(),
        content: tweet.content,
        scheduledFor: date,
        type: 'engagement',
        posted: false,
      });
    }

    // Twice a week: FOMO tweet (evening)
    for (let i = 1; i < 7; i += 3) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      date.setHours(19, 0, 0, 0); // 7 PM

      const tweet = TweetGenerator.fomo();
      posts.push({
        id: generatePostId(),
        content: tweet.content,
        scheduledFor: date,
        type: 'fomo',
        posted: false,
      });
    }

    // Weekly: Countdown tweet (Sunday)
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() + (7 - sunday.getDay()));
    sunday.setHours(12, 0, 0, 0);

    const daysToEndOfYear = Math.ceil(
      (new Date('2025-12-31').getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const countdown = TweetGenerator.countdown(daysToEndOfYear, 'epstein');
    posts.push({
      id: generatePostId(),
      content: countdown.content,
      scheduledFor: sunday,
      type: 'countdown',
      posted: false,
    });

    this.posts = posts.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

    // Save to persistent storage
    this.saveToStorage();

    return this.posts;
  }

  /**
   * Get posts due for publishing
   */
  getDuePosts(): ScheduledPost[] {
    const now = new Date();
    return this.posts.filter(p => !p.posted && p.scheduledFor <= now);
  }

  /**
   * Mark post as published (with persistence)
   */
  markPosted(post: ScheduledPost, tweetId?: string): void {
    post.posted = true;

    // Persist to storage
    if (post.id) {
      markPostAsPosted(post.id, tweetId);
    } else {
      // Fallback: save all posts
      this.saveToStorage();
    }
  }

  /**
   * Get upcoming posts
   */
  getUpcoming(limit: number = 10): ScheduledPost[] {
    return this.posts
      .filter(p => !p.posted)
      .slice(0, limit);
  }

  /**
   * Force regenerate calendar (useful for testing)
   */
  forceRegenerate(): ScheduledPost[] {
    this.posts = [];
    return this.generateWeeklyContent();
  }
}

// =============================================================================
// TWITTER API INTEGRATION (Placeholder)
// =============================================================================

export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

export class TwitterPoster {
  constructor(private _config: TwitterConfig) {}

  /**
   * Post a tweet (placeholder - integrate with Twitter API)
   */
  async postTweet(content: string): Promise<string> {
    console.log('\n📤 POSTING TWEET:');
    console.log('─'.repeat(50));
    console.log(content);
    console.log('─'.repeat(50));

    // In production, use Twitter API v2:
    // const client = new TwitterApi(this.config);
    // const tweet = await client.v2.tweet(content);
    // return tweet.data.id;

    return `mock_tweet_${Date.now()}`;
  }

  /**
   * Post with media (placeholder)
   */
  async postWithMedia(content: string, mediaUrl: string): Promise<string> {
    console.log(`📤 POSTING WITH MEDIA: ${mediaUrl}`);
    return this.postTweet(content);
  }
}
