import { TwitterClient } from '../src/automation/twitter';

const FIRST_TWEET_ID = '2011114315122684022';

const replies = [
  `2/ How it works:

• DOJ releases Epstein documents
• Names get confirmed via court records/Polymarket
• We execute burns on-chain
• Supply decreases forever

25% already burned from 8 confirmed names.`,

  `3/ The math:

Initial supply: 9,849,232 LIST
Burned: 2,462,304 LIST (25%)
Current: 7,386,928 LIST

17 more names pending = 19% more potential burns

Max total burn: 64%`,

  `4/ Why it's different:

Most tokens promise burns "eventually"

$LIST burns are:
✅ Tied to real events
✅ Verified by DOJ documents
✅ Executed on-chain
✅ Permanent

No trust required. Just truth.`,

  `5/ The DOJ has 2+ MILLION Epstein documents still in review.

More releases coming.
More names coming.
More burns coming.

The list is real. $LIST 🔥

Website: list-coin.com
Buy: jup.ag (search LIST)
Telegram: t.me/listdropofficial`
];

async function postReplies() {
  const client = new TwitterClient();

  if (!client.isConfigured()) {
    console.error('Twitter not configured');
    process.exit(1);
  }

  let replyToId = FIRST_TWEET_ID;

  for (let i = 0; i < replies.length; i++) {
    console.log(`Posting reply ${i + 2}/5...`);

    const result = await client.postReply(replies[i], replyToId);

    if (result.success && result.tweetId) {
      console.log(`✅ Reply ${i + 2} posted: ${result.tweetId}`);
      replyToId = result.tweetId;
    } else {
      console.error(`❌ Reply ${i + 2} failed: ${result.error}`);
      break;
    }

    // Wait between tweets
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Done!');
}

postReplies();
