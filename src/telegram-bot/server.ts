/**
 * Telegram Bot Server with Health Check + Twitter Automation
 *
 * Wraps the admin bot with an HTTP server for Railway deployment.
 * Also runs scheduled Twitter posts from data/scheduled-posts.json.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TwitterClient } from '../automation/twitter';

// Start the admin bot
import './admin-bot';

// =============================================================================
// TWITTER SCHEDULER
// =============================================================================

const POSTS_FILE = path.join(__dirname, '..', '..', 'data', 'scheduled-posts.json');
const twitter = new TwitterClient();

interface ScheduledPost {
  id: string;
  scheduledFor: string;
  content: string;
  type: string;
  posted: boolean;
}

interface PostsData {
  posts: ScheduledPost[];
  lastUpdated: string;
  manualPosts: Array<{ content: string; postedAt: string; type: string }>;
}

function loadPosts(): PostsData | null {
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load scheduled posts:', err);
    return null;
  }
}

function savePosts(data: PostsData): void {
  try {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Failed to save posts:', err);
  }
}

async function checkScheduledPosts(): Promise<void> {
  const data = loadPosts();
  if (!data) return;

  const now = new Date();
  let postsUpdated = false;

  for (const post of data.posts) {
    if (post.posted) continue;

    const scheduledTime = new Date(post.scheduledFor);
    if (scheduledTime <= now) {
      console.log(`📤 Posting scheduled tweet: ${post.id}`);

      const result = await twitter.postTweet(post.content);

      if (result.success) {
        post.posted = true;
        postsUpdated = true;
        console.log(`✅ Posted: ${post.id} (${result.tweetId})`);
      } else {
        console.error(`❌ Failed to post ${post.id}: ${result.error}`);
      }

      // Rate limit: wait 2 seconds between posts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (postsUpdated) {
    data.lastUpdated = now.toISOString();
    savePosts(data);
  }
}

// Check for scheduled posts every minute
const SCHEDULE_CHECK_INTERVAL = 60 * 1000;

if (twitter.isConfigured()) {
  console.log('🐦 Twitter automation enabled');
  setInterval(checkScheduledPosts, SCHEDULE_CHECK_INTERVAL);
  // Run immediately on startup
  checkScheduledPosts();
} else {
  console.log('⚠️ Twitter not configured - scheduled posts disabled');
}

// =============================================================================
// HEALTH CHECK SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const data = loadPosts();
    const pendingPosts = data?.posts.filter(p => !p.posted).length || 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'LIST Bot + Twitter',
      twitter: twitter.isConfigured() ? 'enabled' : 'disabled',
      pendingPosts,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});
