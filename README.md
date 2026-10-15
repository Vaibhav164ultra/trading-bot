# Zerodha Live Trading Bot v2.0

AI-powered automated trading system with real-time WebSocket monitoring, live order execution, and Telegram alerts.

## What's New in v2.0

- **Live Trading Mode** - Real-time market monitoring with WebSocket
- **Automatic Order Execution** - Places trades when signals trigger
- **Risk Management** - Stop loss, target, position limits, daily loss limits
- **Position Tracking** - Real-time P&L monitoring
- **Telegram Alerts** - Instant notifications for orders and summaries
- **Cloud Deployment Ready** - Docker + PM2 support

## Architecture

```
src/
├── index.ts          # Main entry (analysis + scan modes)
├── live.ts           # Live trading entry point
├── liveBot.ts        # Core live bot logic
├── websocketClient.ts # Kite WebSocket connection
├── liveOrderExecutor.ts # Order placement & management
├── autoTrader.ts     # Periodic scan mode
├── strategies.ts     # 7 trading strategies
├── indicators.ts     # Technical indicators
├── kiteClient.ts     # Kite API wrapper
├── telegram.ts       # Telegram notifications
├── logger.ts         # History logging
└── config.ts         # Configuration
```

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run live trading bot
npm run live

# Or run analysis mode
npm run dev

# Or run periodic scan mode
npm run scan
```

### Cloud Deployment

#### Option 1: Render.com (Free Tier)

1. Push code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your repo
4. Configure:
   - Name: `zerodha-bot`
   - Environment: `Node`
   - Build: `npm run build`
   - Start: `npm start`
5. Add environment variables (see below)
6. Deploy!

#### Option 2: Railway.app (Free Tier)

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub"
4. Select your repo
5. Add environment variables
6. Deploy automatically

#### Option 3: Docker (Any Cloud Provider)

```bash
# Build Docker image
docker build -t zerodha-bot .

# Run locally
docker run -p 3000:3000 --env-file .env zerodha-bot

# Or push to Docker Hub / ECR / GCR
docker tag zerodha-bot yourusername/zerodha-bot:latest
docker push yourusername/zerodha-bot:latest
```

## Environment Variables

Create a `.env` file:

```env
# Kite Connect API Credentials
KITE_API_KEY=ypiygsv6trqk8d47
KITE_API_SECRET=bmixgfskh5n2kqtoab3vqfovju61e7sn
KITE_ACCESS_TOKEN=your_access_token_here

# Trading Configuration
TRADING_MODE=paper           # paper or live
DEFAULT_QUANTITY=1
MAX_POSITIONS=5
STOP_LOSS_PCT=0.5
TARGET_PCT=1.5
MAX_DAILY_LOSS_PCT=2

# Data & Analysis
HISTORICAL_DAYS=365
TIMEFRAME=5minute

# Telegram
TELEGRAM_BOT_TOKEN=8834718967:AAG36tGwq7WxJVD83gEv0wNpsYa2cxPFvR4
TELEGRAM_CHAT_ID=8228599589

# Watchlist (comma-separated)
WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,ICICIBANK,KOTAKBANK,SBIN,AXISBANK,ADANIENT,ADANIPORTS,MARUTI,TATASTEEL,HCLTECH,WIPRO,BHARTIARTL,ITC,LICI,POWERGRID,NTPC,ONGC,JSWSTEEL

# Server
PORT=3000
```

## Trading Modes

### 1. Live Trading Mode (`npm run live`)
- Connects to Kite WebSocket for real-time data
- Monitors all watchlist symbols every second
- Automatically executes trades when signals trigger
- Sends Telegram alerts for every order
- Manages stop loss and target automatically

### 2. Periodic Scan Mode (`npm run scan`)
- Scans watchlist every 10 minutes
- Generates signals but doesn't execute
- Good for testing and paper trading

### 3. One-Time Analysis (`npm run dev`)
- Single analysis run
- Shows signals for all strategies
- Runs backtests

## Strategies

| Strategy | Description |
|----------|-------------|
| MA Crossover | Buy when fast MA crosses above slow MA |
| RSI Mean Reversion | Buy when RSI < 30, sell when RSI > 70 |
| MACD | Buy on MACD bullish crossover |
| Bollinger Bands | Buy at lower band, sell at upper band |
| Conservative RSI | Only trade extreme RSI (< 20 or > 80) |
| Tight BBands | Trade when price touches outer bands |
| Scalper | Quick entries/exits with tight stops |

## Risk Management

- **Stop Loss**: 0.5% below entry (configurable)
- **Target**: 1.5% above entry (configurable)
- **Max Positions**: 5 simultaneous positions
- **Daily Loss Limit**: 2% of starting equity
- **Position Cooldown**: 5 minutes between trades per symbol

## Monitoring

### Telegram Alerts

The bot sends real-time updates to your Telegram:
- 🟢 Buy signal with strategy details
- 🔴 Sell/close signal with P&L
- 📊 Periodic summary with open positions
- ❌ Order failures

### Logs

All trades and signals are logged to:
- `logs/scan_YYYY-MM-DD.jsonl` - Scan results
- `logs/signal_YYYY-MM-DD.jsonl` - Signal alerts
- `logs/trade_YYYY-MM-DD.jsonl` - Order executions
- `logs/daily_summary.json` - Daily summary

### PM2 Logs (Cloud)

```bash
# View logs
pm2 logs zerodha-bot

# Check status
pm2 status

# Restart bot
pm2 restart zerodha-bot
```

## Deployment Checklist

### Before Deploying Live

1. ✅ Test with `TRADING_MODE=paper` first
2. ✅ Verify all credentials in `.env`
3. ✅ Test Telegram notifications
4. ✅ Run backtests on all strategies
5. ✅ Set appropriate position sizes
6. ✅ Review risk parameters
7. ✅ Monitor for first few hours
8. ✅ Have kill switch ready (Ctrl+C or `pm2 stop`)

### Cloud Setup

1. Push to GitHub
2. Deploy to Render/Railway/Oracle Cloud
3. Add all environment variables
4. Verify bot starts successfully
5. Check Telegram for startup message
6. Monitor initial trades

## Kite Access Token

Your access token expires after ~24 hours. To regenerate:

1. Visit: https://kite.zerodha.com/connect/login?api_key=ypiygsv6trqk8d47&v=3
2. Login with Zerodha credentials
3. Copy the `request_token` from redirect URL
4. Generate new access token:
   ```bash
   node -e "const {KiteConnect}=require('kiteconnect'); const k=new KiteConnect({api_key:'ypiygsv6trqk8d47'}); (async()=>{const s=await k.generateSession('REQUEST_TOKEN','bmixgfskh5n2kqtoab3vqfovju61e7sn'); console.log(s.access_token);})();"
   ```
5. Update `.env` with new token

## Oracle Cloud Free Tier (Recommended)

Oracle offers generous free resources:
- 2 ARM cores
- 24GB RAM
- 200GB storage
- Always free

Setup:
```bash
# After creating VM
sudo apt update && sudo apt install -y nodejs npm git
git clone <your-repo>
cd zerodha-trading-analysis-execution
npm install
npm run build
npx pm2 start ecosystem.config.js
npx pm2 save
npx pm2 startup systemd
```

## Troubleshooting

### WebSocket Not Connecting
- Ensure `KITE_ACCESS_TOKEN` is valid
- Check internet connection
- Token may need refresh every 24h

### No Trades Executing
- Check `TRADING_MODE=live` in `.env`
- Verify watchlist symbols exist in NSE
- Check signal strength threshold (default: 55%)
- Review logs: `pm2 logs zerodha-bot`

### Order Failures
- Check margin availability
- Verify symbol is in your watchlist
- Check for cooldown period
- Review Kite API error messages

### Telegram Not Sending
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Test with: `curl "https://api.telegram.org/bot<TOKEN>/getMe"`
- Check bot is not blocked

## Important Disclaimers

⚠️ **Trading involves risk of loss. This software is for educational purposes.**

- Always test with paper trading first
- Never invest more than you can afford to lose
- past performance does not guarantee future results
- Consult a financial advisor before trading
- You are responsible for your trading decisions

## License

MIT License - Use at your own risk.
