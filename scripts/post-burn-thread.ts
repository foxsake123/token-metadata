/**
 * Post the 25% burn proof thread to Twitter
 */

import { TwitterClient } from '../src/automation/twitter';

async function main() {
  const client = new TwitterClient();

  console.log('Twitter configured:', client.isConfigured());

  if (!client.isConfigured()) {
    console.error('Twitter API not configured!');
    process.exit(1);
  }

  const thread = [
    `🔥 25% OF $LIST SUPPLY - GONE FOREVER 🔥

8 names confirmed on Epstein documents.
8 burns executed on-chain.
2.46M tokens destroyed.

The list is real. The burns are real.

Thread 🧵👇`,

    `✅ Prince Andrew - 5.0%
✅ Bill Gates - 4.5%
✅ Bill Clinton - 3.5%
✅ Alan Dershowitz - 3.5%
✅ Stephen Hawking - 3.0%
✅ Donald Trump - 2.0%
✅ Michael Jackson - 2.0%
✅ Barack Obama - 1.5%

Every burn verified on Solana blockchain 👇`,

    `Verify yourself:
🔗 solscan.io/tx/2LP6u8UKGf7xc5Dj6SnFDLcB25txuqc992yekAD1HWB84ZHS1AddfK3hkywCUT3Lj3idLM9AhMSm4KA7TMM6pWk8

Supply: 9.8M → 7.4M LIST

The more names drop.
The more $LIST pops. 📈

$LIST #Solana #TokenBurn`
  ];

  console.log('Posting thread...');

  const results = await client.postThread(thread);

  console.log('Results:', JSON.stringify(results, null, 2));

  if (results.every(r => r.success)) {
    console.log('✅ Thread posted successfully!');
    console.log('Tweet URLs:');
    results.forEach((r, i) => {
      if (r.tweetId) {
        console.log(`  ${i + 1}. https://twitter.com/i/status/${r.tweetId}`);
      }
    });
  } else {
    console.error('❌ Some tweets failed');
  }
}

main().catch(console.error);
