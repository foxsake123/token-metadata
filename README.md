# $LIST Token

**The more names drop. The more $LIST pops.**

Event-driven burn token on Solana with automated Polymarket integration.

## Token Details

| Property | Value |
|----------|-------|
| **Symbol** | LIST |
| **Name** | Unburdened |
| **Mint** | `5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM` |
| **Blockchain** | Solana |
| **Decimals** | 9 |
| **Website** | [list-coin.com](https://list-coin.com) |

---

## Burn Events

### Event 1: Epstein List (44% max burn)

Burns triggered when names are confirmed on Polymarket predictions.

#### Resolved Burns (25% - Execute Immediately)
| Name | Burn % | Status |
|------|--------|--------|
| Prince Andrew | 5.0% | ✅ Confirmed |
| Bill Gates | 4.5% | ✅ Confirmed |
| Alan Dershowitz | 3.5% | ✅ Confirmed |
| Bill Clinton | 3.5% | ✅ Confirmed |
| Stephen Hawking | 3.0% | ✅ Confirmed |
| Donald Trump | 2.0% | ✅ Confirmed |
| Michael Jackson | 2.0% | ✅ Confirmed |
| Barack Obama | 1.5% | ✅ Confirmed |

#### Active Predictions (14.5% pending)
| Name | Current Odds | Burn % |
|------|-------------|--------|
| Tony Blair | 27% | 2.5% |
| Al Gore | 20% | 2.0% |
| Kirsten Gillibrand | 19% | 1.5% |
| Jamie Dimon | 18% | 1.5% |
| Oprah Winfrey | 16% | 1.5% |
| + 6 more... | | |

#### Community Milestones (14%)
- 100 Holders: 2%
- 500 Holders: 3%
- $25K Volume: 2%
- $100K Volume: 3%
- 1K Twitter: 1.5%
- 5K Twitter: 2.5%

---

### Event 2: Diddy Trial (15% burn pool)

Inverse probability burns - less likely outcomes trigger bigger burns.

| Verdict | Probability | Burn % |
|---------|-------------|--------|
| No Prison Time | 28.6% | **8.0%** |
| Life in Prison | 5% | **5.0%** |
| 20+ Years | 13.3% | **3.0%** |
| 16-20 Years | 40% | 1.5% |
| 11-15 Years | 60% | 0.5% |

**Bonus Burns:**
- Sex Trafficking Conviction: +1%
- All Charges Guilty: +2%
- RICO Conviction: +0.5%
- Celebrity Witness: +0.5%

**Holder Airdrops:**
- No Prison: 5% of holdings
- Life Sentence: 3% of holdings
- 20+ Years: 2% of holdings
- Other: 1% of holdings

---

## Automation

### Burn Scheduler
Monitors Polymarket and executes burns automatically.

```typescript
import { BurnScheduler } from '@list-coin/token';

const scheduler = new BurnScheduler(RPC_URL);
scheduler.start(60000); // Check every minute
```

### Social Media Automation
Auto-generates tweets for burn events.

```typescript
import { TweetGenerator, ContentCalendar } from '@list-coin/token';

// Generate burn announcement
const tweet = TweetGenerator.burnExecuted(target, txSignature);

// Generate weekly content
const calendar = new ContentCalendar();
const posts = calendar.generateWeeklyContent();
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run scheduler (development)
npx ts-node src/automation/scheduler.ts
```

## Environment Variables

```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BURN_AUTHORITY_SECRET=<base58-encoded-keypair>
TWITTER_API_KEY=<twitter-api-key>
TWITTER_API_SECRET=<twitter-api-secret>
TWITTER_ACCESS_TOKEN=<access-token>
TWITTER_ACCESS_SECRET=<access-secret>
```

---

## Links

- **Website:** https://list-coin.com
- **Burn Schedule:** https://list-coin.com/burn-schedule
- **Twitter:** https://twitter.com/ListDrop
- **Polymarket:** https://polymarket.com/event/who-will-be-named-in-newly-released-epstein-files
- **DexScreener:** https://dexscreener.com/solana/5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM

---

## Project Structure

```
src/
├── burn/
│   ├── config.ts      # Burn targets and allocations
│   ├── executor.ts    # SPL token burn execution
│   ├── polymarket.ts  # Polymarket API integration
│   └── index.ts
├── automation/
│   ├── scheduler.ts   # Automated monitoring
│   ├── social.ts      # Tweet generation
│   └── index.ts
└── index.ts
```

---

## License

Apache 2.0
