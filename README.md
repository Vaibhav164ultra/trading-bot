# Zerodha Live Trading Bot (Alert-Only Mode)

An automated trading analysis system for Indian stock markets using Zerodha Kite Connect API with real-time monitoring, strategy-based signal detection, and Telegram notifications. **Alert-only mode - no trading execution.**

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Zerodha Kite Connect API credentials
- Telegram bot token and chat ID

### Local Setup
```bash
# Clone repository
git clone https://github.com/Vaibhav164ultra/trading-bot.git
cd trading-bot

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in alert-only mode
npm run live
```

### Cloud Deployment (Render)
See [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) for step-by-step instructions.

---

## 📊 Features

| Feature | Description |
|---------|-------------|
| **Real-time Monitoring** | WebSocket connection to Kite for live price updates |
| **7 Trading Strategies** | MA Crossover, RSI Reversion, MACD, Bollinger Bands, Conservative RSI, Tight BBands, Scalper |
| **Alert-Only Mode** | Sends detailed market alerts — NO trading execution |
| **AI-Like Messages** | Natural language alerts that don't sound repetitive |
| **30-Second Updates** | Market scans every 30 seconds during trading hours |
| **90-Second Summaries** | Detailed market overviews with sentiment analysis |
| **Telegram Alerts** | Instant notifications for signals and updates |
| **History Logging** | All scans and signals saved to JSONL files |
| **HTTP API** | Health checks and status endpoints for monitoring |

---

## ⚠️ Important: Alert-Only Mode

This bot runs in **ALERT-ONLY** mode. It will:
- ✅ Monitor 21 NSE stocks continuously
- ✅ Analyze using 7 trading strategies
- ✅ Send detailed Telegram alerts when signals trigger (strength ≥ 55%)
- ✅ Provide market summaries every 90 seconds
- ❌ **NOT place any trades** (no paper or live trading)

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Kite Connect API (required)
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_ACCESS_TOKEN=your_access_token_here

# Telegram (required for alerts)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Trading Parameters (for reference only - not executed)
TRADING_MODE=paper
DEFAULT_QUANTITY=1
MAX_POSITIONS=5
STOP_LOSS_PCT=0.5
TARGET_PCT=1.5
MAX_DAILY_LOSS_PCT=2

# Data Settings
HISTORICAL_DAYS=365
TIMEFRAME=5minute           # minute | 5minute | day

# Watchlist (NSE symbols, comma-separated)
WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,ICICIBANK,KOTAKBANK,SBIN,AXISBANK,ADANIENT,ADANIPORTS,MARUTI,TATASTEEL,HCLTECH,WIPRO,BHARTIARTL,ITC,LICI,POWERGRID,NTPC,ONGC,JSWSTEEL

# Server
PORT=3000
```

> **Security**: Never commit `.env` to GitHub. Use environment variables in your deployment platform.

---

## 📈 Trading Strategies

| Strategy | Logic | Best For |
|----------|-------|----------|
| **MA Crossover** | Fast MA crosses above/below slow MA | Trend following |
| **RSI Mean Reversion** | Buy when RSI < 30, sell when RSI > 70 | Range-bound markets |
| **MACD** | MACD line crosses signal line | Momentum detection |
| **Bollinger Bands** | Price touches upper/lower bands | Volatility breakouts |
| **Conservative RSI** | Only trade extreme RSI (< 20 or > 80) | Low-risk trading |
| **Tight BBands** | Price near outer bands with squeeze | High volatility |
| **Scalper** | Quick entries/exits with tight stops | Intraday scalping |

---

## 🔧 Architecture

```
src/
├── live.ts              # Entry point for production
├── liveBot.ts           # Core bot logic (WebSocket + analysis)
├── websocketClient.ts   # Kite WebSocket connection
├── liveOrderExecutor.ts # Order execution (kept for compatibility)
├── server.ts            # HTTP API for monitoring
├── autoTrader.ts        # Periodic scan mode
├── strategies.ts        # 7 trading strategies
├── indicators.ts        # Technical indicators (RSI, MACD, BB, etc.)
├── kiteClient.ts        # Kite API wrapper
├── telegram.ts          # Telegram notifications
├── logger.ts            # History logging
├── config.ts            # Environment validation
└── types.ts             # TypeScript interfaces
```

---

## 📡 HTTP API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (for Render uptime monitoring) |
| `/api/status` | GET | Bot status and watchlist |
| `/api/alerts` | GET | Alert statistics |

### Example Health Check Response
```json
{
  "status": "running",
  "uptime": 3600,
  "symbols": 21,
  "alertsSent": 45,
  "signalsFired": 12,
  "timestamp": "2026-10-15T10:00:00.000Z"
}
```

---

## 📱 Telegram Alerts

The bot sends AI-like, natural language alerts during market hours (9:15 AM - 3:30 PM IST):

| Event | Message Format |
|-------|----------------|
| **Bot Start** | "🤖 Alert-Only Bot Started" with watchlist |
| **Signal Alert** | Natural language: "{symbol} is showing bullish momentum with {strategy} at ₹{price}" |
| **Strong Signal** | "🔥 {symbol} just triggered a strong {strategy} buy signal!" |
| **Market Summary** | Every 90 seconds: detailed overview with buy/sell signals and sentiment |
| **Bot Stop** | "🛑 Alert Bot Stopped" |

### Example Alerts

**Buy Signal:**
```
🟢 Strong BUY signal on RELIANCE! MACD is firing with high conviction at ₹2,450. 
This one's worth watching closely.

💡 MACD crossed above zero (bullish)
⏰ 10:30 AM
```

**Market Summary:**
```
📊 Market Update — 11:00 AM

Midday check-in — reviewing what's happening across the watchlist:

🟢 Buy Signals (2):
• INFY — RSI Mean Reversion @ ₹1,520 (85% strength)
• TCS — Bollinger Bands @ ₹3,850 (72% strength)

🔴 Sell Signals (1):
• HDFCBANK — MACD @ ₹1,620 (68% strength)

Active session — several signals detected across the watchlist.

📡 Scanning 21 stocks | 45 scans completed
```

---

## 📝 Logs

All activity is logged to the `logs/` directory:

| File | Content |
|------|---------|
| `scan_YYYY-MM-DD.jsonl` | All market scans |
| `signal_YYYY-MM-DD.jsonl` | Trading signals |
| `daily_summary.json` | End-of-day summary |

---

## 🌐 Deployment

### Render (Recommended)
- **Cost**: Free tier (750 hours/month)
- **Setup**: See [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)
- **Health Check**: `/health` endpoint required
- **URL**: https://zerodha-bot.onrender.com

### Alternative: Oracle Cloud (Best Performance)
- **Cost**: Free forever (2 ARM cores, 24GB RAM)
- **Setup**: SSH to VM, install Node.js, run with PM2
- **Advantage**: No timeout, full WebSocket support

### Docker
```bash
# Build image
docker build -t zerodha-bot .

# Run locally
docker run -p 3000:3000 --env-file .env zerodha-bot
```

---

## ⚠️ Important Disclaimers

1. **Trading involves risk of loss** - This software is for educational purposes only
2. **Alert-Only Mode** - This bot does NOT execute trades
3. **Past performance ≠ future results** - Backtests don't guarantee profitability
4. **API rate limits** - Kite API has limits; monitor your usage
5. **Token expiration** - Access tokens expire every 24 hours; refresh as needed
6. **Consult professionals** - Seek advice from a financial advisor before trading

---

## 🔐 Security & Credential Rotation

⚠️ **Important**: After testing is complete, rotate your Kite API credentials:

1. Go to Zerodha Dashboard → **Settings** → **API**
2. Click **"Regenerate Secret"**
3. Update your environment variables with the new secret
4. Delete the old `.env` from your local machine

**Never commit `.env` to GitHub** - it's automatically ignored.

---

## 📞 Support

For issues:
1. Check bot logs: `pm2 logs zerodha-bot` or Render dashboard
2. Verify Telegram bot works: Send any message to your bot
3. Test Kite API: Run `npm run dev` locally
4. Review [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) for common fixes

---

## 📄 License

MIT License - Use at your own risk.

---

## 🙏 Acknowledgments

- [Zerodha Kite Connect](https://kite.trade/) - Trading API
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram integration
- [ws](https://github.com/websockets/ws) - WebSocket library

---

**Built with ❤️ for informed trading decisions**
