# Cloud Deployment Guide — Zerodha Live Trading Bot v2.0

## Quick Deploy Options

### Option A: Render.com (Free Tier) ⭐ Recommended
**Cost:** $0/month | **Uptime:** 99.9% | **Limits:** 750hrs/month free

#### Steps:
1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add live trading bot v2.0"
   git push origin master
   ```

2. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

3. **Deploy Web Service**
   - Click "New +" → "Web Service"
   - Connect your repo
   - Configure:
     ```
     Name: zerodha-bot
     Environment: Node
     Build Command: npm install && npm run build
     Start Command: npm start
     Instance Type: Free
     ```

4. **Add Environment Variables**
   ```
   KITE_API_KEY=ypiygsv6trqk8d47
   KITE_API_SECRET=bmixgfskh5n2kqtoab3vqfovju61e7sn
   KITE_ACCESS_TOKEN=your_token_here
   TELEGRAM_BOT_TOKEN=8834718967:AAG36tGwq7WxJVD83gEv0wNpsYa2cxPFvR4
   TELEGRAM_CHAT_ID=8228599589
   WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,ICICIBANK,KOTAKBANK,SBIN,AXISBANK,ADANIENT,ADANIPORTS,MARUTI,TATASTEEL,HCLTECH,WIPRO,BHARTIARTL,ITC,LICI,POWERGRID,NTPC,ONGC,JSWSTEEL
   TRADING_MODE=paper
   PORT=3000
   ```

5. **Deploy!**
   - Click "Create Web Service"
   - Monitor logs in real-time

---

### Option B: Railway.app (Free Tier)
**Cost:** $5 credit/month | **Uptime:** 99.9%

#### Steps:
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub"
4. Select your repo
5. Add environment variables (same as above)
6. Deploy automatically

---

### Option C: Oracle Cloud Free Tier (Forever Free) ⭐ Best Value
**Cost:** $0/month forever | **Specs:** 2 ARM cores, 24GB RAM, 200GB storage

#### Steps:
1. Sign up at https://www.oracle.com/cloud/free/ (need credit card)
2. Create a VM (Oracle Cloud Always Free)
3. SSH into the VM
4. Run these commands:
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   
   # Clone and setup
   git clone <your-repo-url>
   cd zerodha-trading-analysis-execution
   npm install
   npm run build
   
   # Install PM2
   npm install -g pm2
   
   # Create .env file
   nano .env
   # Paste your environment variables
   
   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup systemd
   ```

---

### Option D: Docker (Any Cloud Provider)

#### Build and Run:
```bash
# Build Docker image
docker build -t zerodha-bot .

# Run locally
docker run -p 3000:3000 --env-file .env zerodha-bot

# Push to Docker Hub
docker tag zerodha-bot yourusername/zerodha-bot:latest
docker push yourusername/zerodha-bot:latest
```

#### Docker Compose (for local dev):
```yaml
version: '3.8'
services:
  bot:
    build: .
    env_file: .env
    ports:
      - "3000:3000"
    restart: unless-stopped
```

---

## Monitoring & Management

### Check Status
```bash
# Local
npm run scan

# PM2 (Cloud)
pm2 status
pm2 logs zerodha-bot
```

### View Logs
```bash
# PM2 logs
pm2 logs zerodha-bot --lines 100

# App logs
tail -f logs/pm2-out.log
```

### Control Bot
```bash
# Stop
pm2 stop zerodha-bot

# Restart
pm2 restart zerodha-bot

# Delete
pm2 delete zerodha-bot
```

---

## Post-Deployment Checklist

- [ ] Verify Telegram bot sends startup message
- [ ] Check API health endpoint: `http://your-domain/health`
- [ ] Confirm WebSocket connection in logs
- [ ] Test with `TRADING_MODE=paper` first
- [ ] Monitor for 24 hours before switching to live
- [ ] Set up alerting for bot downtime

---

## Troubleshooting

### Bot Not Starting
```bash
# Check logs
pm2 logs zerodha-bot --err

# Common issues:
# - Missing KITE_ACCESS_TOKEN (expire every 24h)
# - Invalid TELEGRAM_BOT_TOKEN
# - Network/firewall blocking WebSocket
```

### WebSocket Disconnections
- Token expires every 24 hours - refresh it
- Check internet connectivity
- Render free tier has 15min idle timeout - use a ping service

### Order Failures
- Check margin availability
- Verify symbols are in your watchlist
- Review Kite API error messages in logs

---

## Security Notes

⚠️ **Never commit `.env` to Git!**
- Add to `.gitignore`
- Use secret management in cloud platforms
- Rotate tokens regularly

## Support

For issues, check:
1. `logs/pm2-out.log` - Main logs
2. `logs/pm2-error.log` - Error logs
3. Telegram bot @vzerodha2024_bot - Alert messages
