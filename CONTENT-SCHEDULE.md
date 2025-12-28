# $LIST Content Schedule

## Daily Posting Schedule

| Time (EST) | Content Type | Example |
|------------|--------------|---------|
| 9:00 AM | Odds Update | "Polymarket update: Tony Blair 13%, Oprah 12%..." |
| 2:00 PM | Engagement | "25% already burned. Who's next?" |
| 7:00 PM | Meme/FOMO | "Imagine not holding $LIST when the next name drops..." |

## Weekly Content Calendar

### Monday
- AM: Weekly odds recap
- PM: "Week ahead" prediction post
- Evening: Engagement bait (polls/questions)

### Tuesday
- AM: Odds update
- PM: Proof/transparency post (TX links)
- Evening: Meme

### Wednesday
- AM: Odds update
- PM: Supply shock stats
- Evening: FOMO tweet

### Thursday
- AM: Odds update
- PM: Community shoutout
- Evening: News jacking (if relevant)

### Friday
- AM: Odds update
- PM: Weekend prediction contest
- Evening: Meme

### Saturday
- AM: Casual engagement
- PM: Community highlight
- Evening: Countdown to Sunday

### Sunday
- AM: Weekly recap
- PM: Prediction contest results
- Evening: Week ahead tease

## Content Categories

### 1. Burns (High Priority)
Post IMMEDIATELY when:
- Polymarket confirms a name
- Burn TX is executed
- New name added to tracker

### 2. Odds Updates (Daily)
- Pull from Polymarket
- Highlight top 5 candidates
- Show probability changes

### 3. Engagement (Daily)
- Questions: "Who's next?"
- Polls: "Rate your bag"
- Predictions: "Comment your pick"

### 4. FOMO (2-3x/week)
- Scarcity messaging
- Supply reduction stats
- "Don't miss out" angle

### 5. Memes (2-3x/week)
- Relatable crypto humor
- List-specific jokes
- Current event reactions

### 6. Proof/Transparency (Weekly)
- TX links
- Solscan verification
- On-chain evidence

## Tweet Templates Location
`src/automation/social.ts` - Contains all templates

## Automation Commands
```bash
# Generate weekly calendar
npx ts-node scripts/generate-calendar.ts

# Post scheduled content
npx ts-node scripts/post-scheduled.ts

# Manual tweet
npx ts-node scripts/post-tweet.ts
```

## KOL Coordination
When KOLs post:
1. Retweet immediately
2. Reply with key stats
3. Pin if major account
4. Thank them in Telegram

## Response Templates

### New Follower DM
"Welcome to $LIST! The more names drop, the more $LIST pops. 25% already burned. Check list-coin.com for the tracker."

### FUD Response
"Every burn is on-chain and verifiable. Check solscan.io/token/5oKiB... Don't trust, verify."

### Price Question
"We don't give price predictions. We burn tokens when names drop. That's it. 25% gone, more pending."

## Hashtags
Primary: #LIST #Solana
Secondary: #Memecoin #TokenBurn #Crypto
Event-specific: #Epstein #Polymarket

## Best Practices
1. Never promise price action
2. Always link to proof
3. Respond to comments within 1 hour
4. Never engage with trolls
5. Retweet community content
6. Use threads for announcements
