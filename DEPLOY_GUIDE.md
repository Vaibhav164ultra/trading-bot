# Cloud Deployment Guide — Zerodha Live Trading Bot

Deploy your trading bot to the cloud for 24/7 automated trading.

---

## 🎯 Recommended: Render.com (Free Tier)

**Cost**: $0/month | **Limits**: 750 hours/month free

### Step 1: Push Code to GitHub

```bash
git add -A
git commit -m "Ready for Render deployment"
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
TRADING_MODE=paper
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
  "timestamp": "..."
}
```

### Step 8: Check Telegram

You should receive:
```
🤖 Live Bot Started
Mode: LIVE TRADING
Watchlist: RELIANCE, INFY, TCS, ...
```

---

## 🚀 Alternative: Oracle Cloud (Always Free)

**Cost**: $0 forever | **Specs**: 2 ARM cores, 24GB RAM

### Why Oracle Cloud?
- No timeout issues (unlike Render free tier)
- Full WebSocket support
- 24/7 uptime guaranteed
- Generous free resources

### Setup Steps

1. **Create Account**: https://www.oracle.com/cloud/free/
2. **Create VM**: 
   - Shape: ARM Ampere (free tier)
   - Image: Ubuntu 22.04
3. **SSH into VM** and run:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Clone repo
git clone https://github.com/Vaibhav164ultra/trading-bot.git
cd trading-bot

# Install and build
npm install
npm run build

# Set environment variables
cp .env.example .env
nano .env  # Add your credentials

# Start with PM2 (process manager)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd
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
**Fix**: This is normal on Render free tier. Bot continues with Yahoo Finance fallback data.

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
