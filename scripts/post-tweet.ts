import { TwitterClient } from '../src/automation/twitter';

const tweet = `6 new names just added to the $LIST burn tracker.

Robert Downey Jr.
Quentin Tarantino
Rachel Maddow
Piers Morgan
David Koch
Henry Kissinger

Polymarket confirms → we burn.

25% already gone. Who's next? 👀`;

async function main() {
  const client = new TwitterClient();
  
  if (!client.isConfigured()) {
    console.error('Twitter API not configured!');
    process.exit(1);
  }

  console.log('Posting tweet...');
  const result = await client.postTweet(tweet);
  
  if (result.success) {
    console.log('✅ Tweet posted!');
    console.log(`URL: https://twitter.com/i/status/${result.tweetId}`);
  } else {
    console.error('❌ Failed:', result.error);
  }
}

main().catch(console.error);
