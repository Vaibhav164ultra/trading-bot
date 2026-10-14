# How to Use the Trading System — Complete Guide

## 📊 Today's Status
- ✅ Connected to Kite API
- ✅ Telegram bot connected (@vzerodha2024_bot)
- ✅ 21 stocks in watchlist
- ✅ Auto-scan every 10 minutes during market hours
- ✅ History logging enabled

---

## 🚀 How to Run Tomorrow (in College)

### Option 1: Deploy to Cloud (Recommended — No Laptop Needed)

#### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add auto-trading with history logging"
git push origin master
```

#### Step 2: Deploy on Render.com (Free)
1. Go to https://render.com
2. Sign up with GitHub
3. Click **"New +" → "Web Service"**
4. Connect your repository
5. Configure:
   ```
   Name: zerodha-bot
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: node dist/index.js --auto
   ```
6. Add **Environment Variables**:
   ```
   KITE_API_KEY=ypiygsv6trqk8d47
   KITE_API_SECRET=bmixgfskh5n2kqtoab3vqfovju61e7sn
   KITE_ACCESS_TOKEN=HbMZABcQNT4jhGoHfnxg33f8tgu1dBAL
   TELEGRAM_BOT_TOKEN=8834718967:AAG36tGwq7WxJVD83gEv0wNpsYa2cxPFvR4
   TELEGRAM_CHAT_ID=8228599589
   WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,ICICIBANK,KOTAKBANK,SBIN,AXISBANK,ADANIENT,ADANIPORTS,MARUTI,TATASTEEL,HCLTECH,WIPRO,BHARTIARTL,ITC,LICI,POWERGRID,NTPC,ONGC,JSWSTEEL
   SCAN_INTERVAL_MIN=10
   ```
7. Click **"Create Web Service"**
8. Done! It will run 24/7 for free.

---

### Option 2: Keep Laptop at Home (If You Have a Desk at Home)

```bash
# Run this before leaving for college
npm run dev -- --auto
```

Your laptop must stay **on and plugged in**.

---

## 📱 What You'll Get on Telegram

Every 10 minutes during market hours (9:15 AM - 3:30 PM):

### Normal Scan (No Strong Signals)
```
📊 RELIANCE — Price: ₹1166.70
RSI: 36.0 | SMA20: ₹1207.35
No strong signals right now. Waiting for entry...
```

### Strong Buy Signal
```
🔔 RELIANCE — ALERT
Price: ₹1150.50

🟢 Conservative RSI
Action: BUY
Strength: 85%
Reason: RSI (18.5) deeply oversold (<20)
Indicators: rsi: 18.50

📈 Overview: RSI=18.5 (Oversold - potential buy)

⏰ 10/15/2026, 10:30:00 AM
```

---

## 📁 Trading History (Saved Automatically)

All data is logged to `logs/` folder:

```
logs/
├── scan_2026-10-15.jsonl    # Every 10-min scan result
├── signal_2026-10-15.jsonl  # All signals fired
├── trade_2026-10-15.jsonl   # Trades (if paper trading)
└── daily_summary.json       # End-of-day summary
```

### View History Anytime

**Check today's scans:**
```bash
cat logs/scan_2026-10-15.jsonl
```

**View all signals:**
```bash
cat logs/signal_2026-10-15.jsonl
```

**End-of-day summary:**
```bash
cat logs/daily_summary.json
```

---

## 🔧 Add More Stocks to Watchlist

Edit `.env`:
```env
WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,YOUR_STOCK_HERE
```

Then restart:
```bash
npm run dev -- --auto
```

---

## ⏰ Market Hours

- **Monday to Friday** (excluding holidays)
- **9:15 AM to 3:30 PM IST**
- Scans happen every **10 minutes** during these hours
- Bot sleeps outside market hours

---

## 🛑 Stop the Bot

If deployed on cloud:
- Go to Render dashboard → Settings → Restart
- Or delete the service

If running locally:
- Press `Ctrl+C` in terminal

---

## 📝 Notes

1. **Kite historical data** requires paid subscription. System uses Yahoo Finance fallback (works fine for daily candles).
2. **Access tokens expire** after ~24 hours. If you get permission errors, regenerate token from https://developers.kite.trade/
3. **Free tier limits**: Render/Railway free tiers have 750 hours/month — enough for 24/7 running.

---

## Need Help?

Check logs for errors:
```bash
tail -f logs/scan_*.jsonl
```

Or test manually:
```bash
npm run dev
```
