# Live Trading Bot v2.0 - Summary

## What's New

### Core Features
- **Real-time WebSocket monitoring** - Subscribes to Kite's WebSocket for live price updates
- **Automated order execution** - Places BUY orders when strategies trigger signals
- **Position management** - Tracks open positions, P&L, stop loss, and targets
- **Risk controls** - Daily loss limits, position limits, per-symbol cooldowns
- **Telegram alerts** - Instant notifications for orders, positions, and summaries

### Architecture
```
src/
├── live.ts              # Entry point for live mode
├── liveBot.ts           # Main bot logic (WebSocket + analysis)
├── websocketClient.ts   # Kite WebSocket connection
├── liveOrderExecutor.ts # Order placement & position management
├── server.ts            # HTTP API for monitoring
└── (existing files...)
```

### Deployment
- **Docker support** - Multi-stage build included
- **PM2 config** - Process management for cloud
- **Render/Railway ready** - Follow DEPLOY_GUIDE.md

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run live bot
npm run live

# Or scan mode (analysis only)
npm run scan
```

## Environment Variables

```env
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_ACCESS_TOKEN=your_access_token_here
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
WATCHLIST=RELIANCE,INFY,TCS,...
TRADING_MODE=paper  # Change to 'live' for real trades
PORT=3000
```

## ⚠️ Important

**Always test with `TRADING_MODE=paper` first!**

The bot will place real orders when `TRADING_MODE=live`. Start in paper mode to verify everything works.
