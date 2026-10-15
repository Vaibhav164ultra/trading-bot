# Zerodha Live Trading Bot

An automated trading system for Indian stock markets using Zerodha Kite Connect API with real-time WebSocket monitoring, strategy-based signal detection, and Telegram notifications.

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

# Run in paper trading mode (safe testing)
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
| **Automated Execution** | Places orders when signals trigger (paper/live mode) |
| **Risk Management** | Stop loss, target, position limits, daily loss limits |
| **Telegram Alerts** | Instant notifications for signals, orders, and summaries |
| **History Logging** | All scans and trades saved to JSONL files |
| **HTTP API** | Health checks and status endpoints for monitoring |

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

# Trading Parameters
TRADING_MODE=paper          # paper | live
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
├── liveOrderExecutor.ts # Order placement & position management
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
| `/api/positions` | GET | Open positions |
| `/api/risk` | GET | Risk metrics |

### Example Health Check Response
```json
{
  "status": "running",
  "uptime": 3600,
  "symbols": 21,
  "timestamp": "2026-10-15T10:00:00.000Z"
}
```

---

## 🚨 Risk Management

The bot enforces multiple safety controls:

1. **Stop Loss**: 0.5% below entry price (configurable)
2. **Target Profit**: 1.5% above entry price (configurable)
3. **Max Positions**: 5 simultaneous positions (configurable)
4. **Daily Loss Limit**: 2% of starting equity (configurable)
5. **Symbol Cooldown**: 5 minutes between trades per symbol
6. **Paper/Live Mode**: Always test in paper mode first

---

## 📱 Telegram Alerts

| Event | Message Format |
|-------|----------------|
| **Bot Start** | "🤖 Live Bot Started" with watchlist |
| **Signal** | "🟢 BUY RELIANCE - MA Crossover" with strength % |
| **Order Placed** | "📤 Order placed: BUY RELIANCE ×1 @ 2450" |
| **Stop Loss Hit** | "🛑 STOP LOSS hit for RELIANCE" |
| **Target Hit** | "🎯 TARGET hit for RELIANCE" |
| **Position Closed** | "📤 Position closed: RELIANCE | P&L: ₹+150" |
| **Daily Summary** | Position details, P&L, risk metrics every minute |

---

## 📝 Logs

All activity is logged to the `logs/` directory:

| File | Content |
|------|---------|
| `scan_YYYY-MM-DD.jsonl` | All market scans |
| `signal_YYYY-MM-DD.jsonl` | Trading signals |
| `trade_YYYY-MM-DD.jsonl` | Order executions |
| `daily_summary.json` | End-of-day summary |

---

## 🌐 Deployment

### Render (Recommended)
- **Cost**: Free tier (750 hours/month)
- **Setup**: See [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)
- **Health Check**: `/health` endpoint required

### Oracle Cloud (Best Performance)
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
2. **Test thoroughly** - Always start with `TRADING_MODE=paper`
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

**Built with ❤️ for automated trading**
