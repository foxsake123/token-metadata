# $LIST Social Media Strategy & Content Calendar

## Overview

Automated and manual social media campaigns to drive engagement, FOMO, and community growth around burn events.

**Primary Channel:** Twitter/X (@ListDrop)
**Secondary:** Discord, Telegram (future)

---

## Content Pillars

### 1. Burn Announcements (Reactive)
**Trigger:** Polymarket resolution or milestone achievement
**Frequency:** As events happen
**Priority:** HIGHEST - post within 5 minutes

Templates:
- Burn executed (with TX link)
- Burn scheduled (hype building)
- Milestone achieved

### 2. Odds Updates (Scheduled)
**Frequency:** Daily at 9 AM EST
**Content:** Top 5 Polymarket candidates with current odds

### 3. Engagement/FOMO (Scheduled)
**Frequency:** 2-3x per week
**Content:** Burn tracker stats, "who's next?" polls, community callouts

### 4. Countdown (Scheduled)
**Frequency:** Weekly on Sundays, then daily in final week
**Content:** Days until Polymarket market closes / Diddy verdict

### 5. Educational (Manual)
**Frequency:** 1-2x per week
**Content:** How burns work, Polymarket explainers, tokenomics

---

## Weekly Content Calendar

| Day | Time (EST) | Content Type | Template |
|-----|------------|--------------|----------|
| Monday | 9:00 AM | Odds Update | Top 5 candidates |
| Monday | 2:00 PM | Engagement | Burn tracker stats |
| Tuesday | 9:00 AM | Odds Update | Focus on changes |
| Tuesday | 7:00 PM | FOMO | "Imagine not holding..." |
| Wednesday | 9:00 AM | Odds Update | Top 5 candidates |
| Wednesday | 2:00 PM | Educational | How burns work |
| Thursday | 9:00 AM | Odds Update | Focus on movers |
| Thursday | 7:00 PM | FOMO | Warning/PSA style |
| Friday | 9:00 AM | Odds Update | Weekend preview |
| Friday | 2:00 PM | Engagement | Community callout |
| Saturday | 12:00 PM | Casual | Meme/fun content |
| Sunday | 12:00 PM | Countdown | Days remaining |

---

## Reactive Content (Automated)

### When Polymarket Confirms a Name:
1. **Immediate (0-5 min):** "BURN INCOMING" tweet
2. **Burn execution (5-15 min):** "BURN EXECUTED" with TX
3. **Follow-up (1 hour):** Stats update, community celebration

### When Milestone Achieved:
1. **Immediate:** Celebration tweet
2. **Burn execution:** TX confirmation
3. **Follow-up:** "What's next?" engagement

### When Diddy Verdict Announced:
1. **Immediate:** Verdict announcement
2. **Burn execution:** Burn + airdrop details
3. **Thread:** Full breakdown of burns triggered

---

## Hashtag Strategy

**Primary (always use):**
- #LIST
- #Solana

**Secondary (rotate):**
- #Memecoin
- #TokenBurn
- #CryptoTwitter
- #Polymarket

**Event-specific:**
- #Epstein (for list revelations)
- #Diddy (for trial updates)
- #FOMO (for hype posts)

---

## Engagement Tactics

### Polls
- "Who drops next?"
- "How much will be burned this week?"
- "Bullish or mega bullish?"

### Quote Tweets
- Polymarket odds changes
- News about Epstein/Diddy
- Solana ecosystem news

### Replies
- Engage with crypto influencers
- Reply to Polymarket tweets
- Community member shoutouts

---

## Automation Setup

### Required Environment Variables:
```
TWITTER_API_KEY=xxx
TWITTER_API_SECRET=xxx
TWITTER_ACCESS_TOKEN=xxx
TWITTER_ACCESS_SECRET=xxx
SOLANA_RPC_URL=xxx
```

### Cron Schedule (for server deployment):
```cron
# Daily odds update (9 AM EST)
0 14 * * * node dist/automation/daily-odds.js

# Engagement tweets (2 PM EST on Mon/Wed/Fri)
0 19 * * 1,3,5 node dist/automation/engagement.js

# FOMO tweets (7 PM EST on Tue/Thu)
0 0 * * 2,4 node dist/automation/fomo.js

# Sunday countdown
0 17 * * 0 node dist/automation/countdown.js

# Polymarket monitor (every minute)
* * * * * node dist/automation/monitor.js
```

---

## KPIs to Track

| Metric | Target (Week 1) | Target (Month 1) |
|--------|-----------------|------------------|
| Followers | +500 | +3,000 |
| Avg Likes/Tweet | 20 | 50 |
| Avg Retweets | 5 | 15 |
| Engagement Rate | 3% | 5% |
| Burn Tweet Impressions | 10K | 50K |

---

## Content Examples

### Burn Executed Tweet:
```
🔥 BURN ALERT 🔥

Bill Gates just got CONFIRMED on the list.

4.5% of $LIST supply = GONE FOREVER

45,000,000 tokens burned 💀

TX: solscan.io/tx/xxx

#LIST #Solana #TokenBurn
```

### Odds Update Tweet:
```
📊 POLYMARKET UPDATE

Hottest $LIST burn candidates:

1. Tony Blair: 27%
2. Al Gore: 20%
3. Kirsten Gillibrand: 19%
4. Jamie Dimon: 18%
5. Oprah Winfrey: 16%

Who's next? 👀

Track live: polymarket.com

#LIST #Polymarket
```

### FOMO Tweet:
```
Imagine not holding $LIST when the next name drops... 📜

Every confirmation = permanent burn
Every burn = less supply

🔥🔥🔥

#LIST #FOMO
```

### Diddy Verdict Tweet:
```
⚖️ DIDDY VERDICT IS IN ⚖️

LIFE IN PRISON

Burn triggered: 5%
Bonuses: RICO conviction (+0.5%)

Total burn: 5.5% 🔥

Airdrops incoming for holders! 💰

#Diddy #LIST
```

---

## Crisis Management

### If burn fails:
1. Acknowledge issue publicly
2. Explain technical reason
3. Provide timeline for resolution
4. Execute burn ASAP
5. Post confirmation

### If Polymarket dispute:
1. Wait for official resolution
2. Don't speculate publicly
3. Post update when resolved

---

## Tools & Resources

- **Scheduling:** TweetDeck, Typefully, or custom script
- **Analytics:** Twitter Analytics, Followerwonk
- **Graphics:** Canva templates for burn announcements
- **Monitoring:** Custom Polymarket watcher script

---

*Last Updated: December 2024*
