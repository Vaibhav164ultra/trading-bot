# 🚀 How to Deploy the Fixed Bot

## Step 1: Trigger Manual Deploy on Render

1. Go to https://render.com
2. Click on your **zerodha-bot** service
3. Click **"Manual Deploy"** → **"Deploy Latest"**
4. Wait 2-3 minutes for build and deploy

## Step 2: What You'll See

The bot will now:
1. ✅ Send initial confirmation: "🤖 Initializing Bot..."
2. ✅ Load watchlist with proper rate limiting (500ms between calls)
3. ✅ Start polling every 30 seconds
4. ✅ Send alerts every 2 minutes during market hours (9:15 AM - 3:30 PM IST)
5. ✅ Handle rate limits gracefully (waits 5-10 seconds if needed)

## Step 3: Expected Telegram Messages

### Startup Message:
```
🤖 Initializing Bot...

Mode: ALERTS ONLY
Loading watchlist...
```

### After Loading (2-3 seconds later):
```
🤖 Alert-Only Bot Started

Mode: ALERTS ONLY
Watchlist: RELIANCE, INFY, TCS, ...

I'll send you detailed market updates every 2 minutes during trading hours. No trades will be placed.
```

### Market Updates (every 2 minutes during trading hours):
```
📊 Market Update — 10:30 AM

Midday check-in — reviewing what's happening across the watchlist:

🟢 Buy Signals (2):
• RELIANCE — MA Crossover @ ₹2,450 (85%)
• INFY — RSI Mean Reversion @ ₹1,520 (72%)

🔴 Sell Signals (1):
• TCS — MACD @ ₹3,850 (68%)

Active session — several signals detected across the watchlist.

📡 Scanning 21 stocks | 45 scans
```

### Signal Alert (when strength ≥ 55%):
```
Looks like RELIANCE is showing some bullish momentum right now. 
The MA Crossover strategy is picking up strength at 2450.00.

💡 SMA20 crossed above SMA50
⏰ 10:35 AM
```

## Step 4: If You Still Get "Too many requests"

This means your Kite API token has been rate-limited. Do this:

1. **Wait 10-15 minutes** for the rate limit to reset
2. **Redeploy** on Render
3. If it still fails, **regenerate your Kite access token**:
   - Go to Zerodha Dashboard → Settings → API
   - Click "Regenerate Secret"
   - Update the token in Render environment variables
   - Redeploy

## Step 5: Keep the Bot Alive (Optional)

Render free tier puts the service to sleep after 15 minutes of inactivity. To keep it warm:

**Option A: Upgrade to Render Starter ($7/month)**
- Always on, no cooldown issues

**Option B: Use Free Uptime Monitor**
1. Go to https://uptimerobot.com
2. Create account (free)
3. Add new monitor:
   - Type: HTTP
   - URL: `https://zerodha-bot.onrender.com/health`
   - Interval: Every 5 minutes
4. This will keep your bot warm 24/7

**Option C: Oracle Cloud Free Tier**
- 2 ARM cores, 24GB RAM forever
- No timeout issues
- Full WebSocket support

## Troubleshooting

### Bot not sending messages?
1. Check if it's market hours (9:15 AM - 3:30 PM IST)
2. Check Telegram bot token and chat ID in Render env vars
3. Send a message to your bot to activate it

### Rate limit errors persist?
1. Wait 10-15 minutes
2. Regenerate Kite API token
3. Update in Render environment variables
4. Redeploy

### Service showing 502?
This is normal on free tier. Just visit the health URL to wake it up:
```
https://zerodha-bot.onrender.com/health
```

Wait 30-60 seconds, then check again.

## Files Changed

- `src/liveBot.ts` - Added rate limiting, delays, and confirmation messages
- `src/telegram.ts` - Improved error handling
- All changes pushed to GitHub and ready for deploy

---

**You're all set! Just deploy on Render and you'll get AI-like market alerts.** 🚀
