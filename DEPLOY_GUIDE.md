/**
 * Cloud Deployment Guide — Run trading bot on free cloud server
 * No laptop needed — runs 24/7 in the cloud
 */

// ═══════════════════════════════════════════════════════════
// OPTION A: Render.com (Free Tier — $0/month)
// ═══════════════════════════════════════════════════════════

// Steps:
// 1. Push code to GitHub
// 2. Go to https://render.com
// 3. Sign up with GitHub
// 4. Click "New +" → "Web Service"
// 5. Connect your repo
// 6. Configure:
//    - Name: zerodha-bot
//    - Environment: Node
//    - Build: npm run build
//    - Start: node dist/index.js
// 7. Add environment variables:
//    KITE_API_KEY=ypiygsv6trqk8d47
//    KITE_API_SECRET=bmixgfskh5n2kqtoab3vqfovju61e7sn
//    KITE_ACCESS_TOKEN=HbMZABcQNT4jhGoHfnxg33f8tgu1dBAL
//    TELEGRAM_BOT_TOKEN=8834718967:AAG36tGwq7WxJVD83gEv0wNpsYa2cxPFvR4
//    TELEGRAM_CHAT_ID=8228599589
//    WATCHLIST=RELIANCE,INFY,TCS,HDFC,BANKBARODA
//    SCAN_INTERVAL_MIN=10
// 8. Deploy!

// ═══════════════════════════════════════════════════════════
// OPTION B: Railway.app (Free Tier — $5 credit/month)
// ═══════════════════════════════════════════════════════════

// Steps:
// 1. Go to https://railway.app
// 2. Sign up with GitHub
// 3. Click "New Project" → "Deploy from GitHub"
// 4. Select your repo
// 5. Add env vars (same as above)
// 6. Deploy automatically

// ═══════════════════════════════════════════════════════════
// OPTION C: Oracle Cloud Free Tier (Forever Free)
// ═══════════════════════════════════════════════════════════

// Steps:
// 1. https://www.oracle.com/cloud/free/ — sign up (need credit card)
// 2. Create a VM (free tier: 2 ARM cores, 24GB RAM!)
// 3. SSH into it
// 4. Clone repo → npm install → pm2 start dist/index.js
// 5. Done! Completely free forever

// Commands for Oracle Cloud:
// sudo apt update && sudo apt install -y nodejs npm git
// git clone <your-repo-url>
// cd zerodha-trading-analysis-execution
// npm install
// npm run build
// npx pm2 start dist/index.js --name zerodha-bot
// npx pm2 save
// npx pm2 startup systemd (to auto-start on boot)

// ═══════════════════════════════════════════════════════════
// OPTION D: Keep Laptop at Home + Auto-Wake (No Cost)
// ═══════════════════════════════════════════════════════════

// If you can't afford cloud, configure your laptop:
// 1. Control Panel → Power Options → Choose what closing the lid does → Do nothing
// 2. Control Panel → Power Options → Change plan settings → Put computer to sleep: Never
// 3. Run: npm run setup:wake
//    (This creates scheduled tasks that wake laptop for scans)

// Then just leave laptop at home plugged in!
