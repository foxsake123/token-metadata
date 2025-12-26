# $LIST Token

**The more names drop. The more $LIST pops.**

Event-driven burn token on Solana tied to Polymarket Epstein list predictions.

## Token Details

- **Token:** LIST (Unburdened)
- **Mint Address:** `5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM`
- **Blockchain:** Solana
- **Decimals:** 9
- **Max Burn:** 44% of supply

## Burn Mechanism

Burns are triggered by two events:

### 1. Polymarket Confirmations (42%)
When a name from the [Polymarket Epstein predictions](https://polymarket.com/event/who-will-be-named-in-newly-released-epstein-files) is officially confirmed, the corresponding percentage of tokens is burned.

| Tier | Odds Range | Burn % | Names |
|------|-----------|--------|-------|
| 1 | >20% | 4.0% each | Tony Blair, Al Gore |
| 2 | 15-20% | 3.0% each | Jamie Dimon, Kirsten Gillibrand, Oprah Winfrey |
| 3 | 10-15% | 2.5% each | Ellen DeGeneres, Anderson Cooper, Piers Morgan, Henry Kissinger, Rachel Maddow, Sean Combs, David Koch, Jimmy Kimmel |
| 4 | <10% | 1.5% each | Robert Downey Jr., Quentin Tarantino, Tom Hanks |

### 2. Community Milestones (2%)
- 10K Holders: 0.5%
- $1M Market Cap: 0.5%
- 50K Twitter Followers: 0.5%
- $10M Volume: 0.5%

## Links

- **Website:** https://www.list-coin.com
- **Burn Schedule:** https://www.list-coin.com/burn-schedule
- **Twitter:** https://twitter.com/ListDrop
- **DEX:** [Raydium](https://raydium.io)
- **Chart:** [DexScreener](https://dexscreener.com/solana/5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

## Burn Execution

The burn system integrates with Polymarket API to detect confirmed predictions and execute burns automatically.

```typescript
import { ListBurnExecutor } from '@list-coin/token';

const executor = new ListBurnExecutor(RPC_URL, BURN_AUTHORITY_SECRET);
const results = await executor.executePendingBurns();
```

## License

Apache 2.0
