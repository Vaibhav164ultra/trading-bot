# Cloud Deployment Guide — Zerodha Alert Bot (Alert-Only Mode)

Deploy your trading alert bot to the cloud for 24/7 automated monitoring.

---

## 🎯 Recommended: Render.com (Free Tier)

**Cost**: $0/month | **Limits**: 750 hours/month free

### Step 1: Push Code to GitHub

```bash
git add -A
git commit -m "Update for Render deployment"
git push origin main
```

Verify your repository is public or grant Render access.

### Step 2: Create Render Account

1. Go to https://render.com
2. Click **"Sign Up"** → Connect with GitHub
3. Verify your email

### Step 3: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Select your repository: `Vaibhav164ultra/trading-bot`
3. Click **"Connect"**

### Step 4: Configure Service

Fill in these exact values:

| Setting | Value |
|---------|-------|
| **Name** | `zerodha-bot` |
| **Region** | `US East (Northern Virginia)` |
| **Branch** | `main` |
| **Root Directory** | *(leave empty)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/live.js` |
| **Instance Type** | `Free` |

### Step 5: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add each one:

```
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_ACCESS_TOKEN=your_access_token_here
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,ICICIBANK,KOTAKBANK,SBIN,AXISBANK,ADANIENT,ADANIPORTS,MARUTI,TATASTEEL,HCLTECH,WIPRO,BHARTIARTL,ITC,LICI,POWERGRID,NTPC,ONGC,JSWSTEEL
PORT=3000
```

### Step 6: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (2-3 minutes)
3. Copy the URL: `https://zerodha-bot.onrender.com`

### Step 7: Verify Deployment

Visit the health endpoint:
```
https://zerodha-bot.onrender.com/health
```

Expected response:
```json
{
  "status": "running",
  "uptime": 45,
  "symbols": 21,
  "alertsSent": 0,
  "signalsFired": 0,
  "timestamp": "..."
}
```

### Step 8: Check Telegram

You should receive:
```
🤖 Alert-Only Bot Started

Mode: ALERTS ONLY
Watchlist: RELIANCE, INFY, TCS, ...

I'll send you detailed market updates every 30 seconds during trading hours. No trades will be placed.
```

---

## ⚠️ Common Issues & Fixes

### Build Fails
```
Error: Cannot find module 'dist/live.js'
```
**Fix**: Ensure `npm run build` completes successfully before deploying.

### WebSocket Connection Fails
```
WebSocket connection failed
```
**Fix**: This is normal on Render free tier. Bot continues with polling mode (30s intervals).

### Bot Not Starting
Check Render logs:
```
Logs → Download logs → Search for "Error"
```

### Telegram Not Sending
- Verify bot token is correct
- Test with: `curl "https://api.telegram.org/bot<TOKEN>/getMe"`
- Ensure chat ID is numeric (no quotes)

### Token Expired
Access tokens expire every 24 hours. Update environment variable:
1. Go to Render Dashboard → Your Service → Environment
2. Update `KITE_ACCESS_TOKEN` with fresh token
3. Service auto-restarts

### Service Showing 502 Error
**This is normal on Render free tier!** The free tier puts services to sleep after 15 minutes of inactivity.

**To wake it up:**
1. Visit your health endpoint: `https://zerodha-bot.onrender.com/health`
2. Wait 30-60 seconds for the service to warm up
3. The service will stay active while receiving requests

**Better alternative:** Use a free uptime monitor like [UptimeRobot](https://uptimerobot.com/) to ping your bot every 5 minutes, keeping it warm.

---

## 📊 Monitoring

### Render Dashboard
- **Logs**: Real-time output
- **Metrics**: CPU, memory usage
- **Settings**: Edit environment variables

### Health Check
```bash
curl https://zerodha-bot.onrender.com/health
```

### Manual Restart
```bash
# In Render dashboard
Settings → Manual Deploy → Deploy
```

---

## 🔒 Security Notes

- Never commit `.env` to GitHub
- Rotate API keys periodically
- Use different tokens for paper vs live trading
- Monitor your Zerodha account for unauthorized activity

---

## 🆘 Need Help?

1. Check Render logs for errors
2. Test locally first: `npm run live`
3. Verify all environment variables are set
4. Ensure your Kite access token is valid

---

**Happy Trading! 🚀**
