# $LIST Referral Program

## Overview

Reward community members for bringing in new holders. Simple, trackable, effective.

---

## How It Works

1. **Get your referral code** - DM @ListDrop with your wallet address
2. **Share with friends** - They mention your code when they buy
3. **Both get rewarded** - You earn LIST, they get a bonus

---

## Rewards Structure

| Action | Referrer Gets | New Holder Gets |
|--------|---------------|-----------------|
| New holder buys 10K+ LIST | 1,000 LIST | 500 LIST bonus |
| New holder buys 50K+ LIST | 3,000 LIST | 1,500 LIST bonus |
| New holder buys 100K+ LIST | 5,000 LIST | 2,500 LIST bonus |

---

## Rules

1. **Minimum purchase:** 10,000 LIST to qualify
2. **One referral per wallet:** Can't refer same person twice
3. **Must hold 7 days:** Both parties must hold for 7 days to receive rewards
4. **Monthly cap:** Max 50,000 LIST per referrer per month

---

## How to Claim

### For Referrers:
1. Share your wallet address as your referral code
2. When someone buys, they post in Telegram:
   ```
   Just bought [amount] LIST!
   Referred by: [your wallet or @handle]
   My wallet: [their wallet]
   TX: [solscan link]
   ```
3. After 7 days, rewards are added to weekly payout

### For New Holders:
1. Buy LIST on Raydium/Jupiter
2. Post in Telegram with referrer info
3. Hold for 7 days
4. Receive bonus in weekly payout

---

## Tracking

Referrals tracked in `data/rewards-tracker.json`:

```json
{
  "wallet": "new_holder_wallet",
  "twitter": "@newuser",
  "type": "referral",
  "tweetUrl": "telegram_message_link",
  "reward": 500,
  "paid": false,
  "submittedAt": "2025-12-29",
  "referrer": "referrer_wallet",
  "referrerReward": 1000,
  "purchaseAmount": 15000,
  "holdUntil": "2026-01-05"
}
```

---

## Admin Commands (Telegram Bot)

```
/addref <new_wallet> <referrer_wallet> <purchase_amount>
```

This auto-calculates rewards based on purchase tier.

---

## Announcement Template

### Telegram:
```
🎁 REFERRAL PROGRAM LIVE!

Bring friends to $LIST and earn rewards!

How it works:
1. Share your wallet as referral code
2. Friend buys 10K+ LIST
3. They post in chat with your wallet
4. Both get rewarded after 7 days!

Rewards:
• 10K+ buy: You get 1K, they get 500
• 50K+ buy: You get 3K, they get 1.5K
• 100K+ buy: You get 5K, they get 2.5K

Start referring! 🔥
```

### Twitter:
```
🎁 $LIST REFERRAL PROGRAM

Bring a friend → Both get rewarded

• 10K buy: 1,000 LIST for you, 500 for them
• 50K buy: 3,000 LIST for you, 1,500 for them
• 100K buy: 5,000 LIST for you, 2,500 for them

DM for your referral code.

#LIST #Solana
```

---

## Monthly Budget

| Category | Max |
|----------|-----|
| Referrer rewards | 50,000 LIST |
| New holder bonuses | 25,000 LIST |
| **Total** | **75,000 LIST/month** |

At $0.00433: ~$325/month max

---

## Success Metrics

Track weekly:
- New referrals count
- Total LIST distributed
- Retention rate (% still holding after 30 days)
- Top referrers

---

*Program subject to change. Abuse = disqualification.*
