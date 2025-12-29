/**
 * Auto-Post Scheduled Content
 *
 * Run via Windows Task Scheduler every hour to check for due posts
 * Usage: npx ts-node scripts/auto-post.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { TwitterApi } from 'twitter-api-v2';
import * as dotenv from 'dotenv';

dotenv.config();

const SCHEDULE_FILE = path.join(__dirname, '..', 'data', 'scheduled-posts.json');
const LOG_FILE = path.join(__dirname, '..', 'data', 'post-log.json');

interface ScheduledPost {
  id: string;
  scheduledFor: string;
  content: string;
  type: string;
  posted: boolean;
  postedAt?: string;
  tweetId?: string;
}

interface Schedule {
  posts: ScheduledPost[];
  lastUpdated: string;
}

interface LogEntry {
  timestamp: string;
  postId: string;
  tweetId: string;
  content: string;
  success: boolean;
  error?: string;
}

function loadSchedule(): Schedule {
  const data = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveSchedule(schedule: Schedule): void {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
}

function loadLog(): LogEntry[] {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }
  const data = fs.readFileSync(LOG_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveLog(log: LogEntry[]): void {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

async function postTweet(content: string): Promise<string> {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  const tweet = await client.v2.tweet(content);
  return tweet.data.id;
}

async function main() {
  console.log('🤖 Auto-Post Check:', new Date().toISOString());
  console.log('─'.repeat(50));

  const schedule = loadSchedule();
  const log = loadLog();
  const now = new Date();

  // Find posts that are due (scheduled time has passed and not yet posted)
  const duePosts = schedule.posts.filter(post => {
    const scheduledTime = new Date(post.scheduledFor);
    return !post.posted && scheduledTime <= now;
  });

  if (duePosts.length === 0) {
    console.log('✅ No posts due at this time');

    // Show next upcoming post
    const upcoming = schedule.posts
      .filter(p => !p.posted)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];

    if (upcoming) {
      console.log(`\n📅 Next post: ${upcoming.scheduledFor}`);
      console.log(`   Type: ${upcoming.type}`);
      console.log(`   Preview: ${upcoming.content.substring(0, 50)}...`);
    }
    return;
  }

  console.log(`📤 ${duePosts.length} post(s) due for publishing\n`);

  for (const post of duePosts) {
    console.log(`\n🐦 Posting [${post.id}]:`);
    console.log(post.content.substring(0, 100) + '...');

    try {
      const tweetId = await postTweet(post.content);

      // Update schedule
      post.posted = true;
      post.postedAt = new Date().toISOString();
      post.tweetId = tweetId;

      // Log success
      log.push({
        timestamp: new Date().toISOString(),
        postId: post.id,
        tweetId: tweetId,
        content: post.content,
        success: true,
      });

      console.log(`✅ Posted! Tweet ID: ${tweetId}`);
      console.log(`   https://twitter.com/ListDrop/status/${tweetId}`);

    } catch (error: any) {
      console.error(`❌ Failed to post: ${error.message}`);

      log.push({
        timestamp: new Date().toISOString(),
        postId: post.id,
        tweetId: '',
        content: post.content,
        success: false,
        error: error.message,
      });
    }

    // Wait 2 seconds between posts to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Save updated schedule and log
  saveSchedule(schedule);
  saveLog(log);

  console.log('\n─'.repeat(50));
  console.log('✅ Auto-post check complete');
}

main().catch(console.error);
