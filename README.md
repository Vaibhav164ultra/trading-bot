# Zerodha Trading Analysis & Execution System

A TypeScript-based trading system for Zerodha Kite Connect API featuring:
- **Technical Analysis** - Built-in indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic)
- **7 Strategies** - Pluggable strategies with backtesting (4 original + 3 small-margin)
- **Paper Trading** - Risk-managed simulated trading
- **Live Trading Ready** - Kite Connect integration for real execution
- **Telegram Alerts** - Real-time notifications
- **Auto-Scan** - Continuous monitoring during market hours
- **History Logging** - All scans, signals, and trades saved to `logs/`

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Credentials
```bash
cp .env.example .env
# Edit .env with your credentials (see below)
```

### 3. Get Kite API Credentials
1. Go to https://developers.kite.trade/
2. Create a new app (Personal type)
3. Get your API Key and API Secret
4. Login and get request_token:
```
https://kite.zerodha.com/connect/login?api_key=YOUR_KEY&v=3
```
5. Copy request_token from redirect URL
6. Use it to generate access token (done automatically by script)

### 4. Get Telegram Bot Credentials
1. Message @BotFather on Telegram
2. Create new bot: `/newbot`
3. Get BOT_TOKEN
4. Get your Chat ID from @userinfobot

### 5. Run
```bash
# One-time analysis
npm run dev

# Auto-scan mode (continuous during market hours)
npm run dev -- --auto
```

## Project Structure

```
src/
├── config.ts         # Configuration management (Zod validation)
├── types.ts          # TypeScript type definitions
├── kiteClient.ts     # Kite Connect API wrapper
├── indicators.ts     # Technical indicators (SMA, EMA, RSI, MACD, BB, ATR, Stoch)
├── strategies.ts     # 7 trading strategies with backtesting
├── paperTrading.ts   # Paper trading engine with risk management
├── telegram.ts       # Telegram notification bot
├── autoTrader.ts     # Continuous scanning during market hours
├── logger.ts         # Trading history logger
└── historicalData.ts # Yahoo Finance / NSE fallback data
logs/                  # Historical data, signals, and trades
```

## Available Strategies

| Strategy | Description | Margin Fit |
|----------|-------------|------------|
| `ma-crossover` | Moving Average Crossover (fast vs slow MA) | Moderate |
| `rsi-reversion` | RSI Mean Reversion (oversold/overbought) | Moderate |
| `macd` | MACD Zero-line Crossover | Moderate |
| `bollinger-bands` | Bollinger Bands Mean Reversion | Moderate |
| `conservative-rsi` | **Deep** oversold/overbought (RSI <20 or >80) — only strong signals | ✅ Small (500) |
| `tight-bbands` | Price at outer bands with tight squeeze entries | ✅ Small (500) |
| `scalper` | Quick entries/exits with tight stops (7-period RSI) | ✅ Small (500) |

## Configuration

Key environment variables in `.env`:

```env
# Kite Connect API
KITE_API_KEY=your_api_key
KITE_API_SECRET=your_api_secret
KITE_ACCESS_TOKEN=  # Generated after login flow

# Trading Parameters
TRADING_MODE=paper  # paper | live
DEFAULT_QUANTITY=1
MAX_POSITIONS=5

# Risk Management
MAX_DAILY_LOSS_PCT=2
MAX_POSITION_LOSS_PCT=1
STOP_LOSS_PCT=0.5
TARGET_PCT=1.5

# Data & Analysis
DATA_DIR=./data
HISTORICAL_DAYS=365
TIMEFRAME=day  # minute | 5minute | 15minute | 30minute | 60minute | day

# Telegram Notifications
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Watchlist (comma-separated NSE symbols)
WATCHLIST=RELIANCE,INFY,TCS,HDFCBANK,ICICIBANK,KOTAKBANK,SBIN,AXISBANK

# Scan Settings
SCAN_INTERVAL_MIN=10  # Minutes between scans during market hours
```

## Running Tests

```bash
npm test
```

## Auto-Scan Mode (During Market Hours)

Run continuously while you're at college — sends Telegram alerts for strong signals:

```bash
npm run dev -- --auto
```

**How it works:**
- Scans your watchlist every 10 minutes during market hours (9:15 AM - 3:30 PM IST)
- Only runs on Mon-Fri
- Sends detailed Telegram alerts when strategy strength > 50%
- Logs all scans, signals, and trades to `logs/` directory
- 2-hour cooldown per symbol/strategy (no spam)
- Press `Ctrl+C` to stop

## Trading History

All data is saved to `logs/`:

```
logs/
├── scan_2024-10-15.jsonl    # Each scan result
├── signal_2024-10-15.jsonl  # All signals fired
├── trade_2024-10-15.jsonl   # Trades opened/closed
├── summary_2024-10-15.jsonl # Daily summaries
└── daily_summary.json       # Aggregated stats
```

Each `.jsonl` file contains one JSON object per line. View with:
```bash
cat logs/scan_2024-10-15.jsonl | jq .
```

## Deployment Options

Since you can't keep your laptop running at college, deploy to cloud:

### Option 1: Render.com (Free Tier)
1. Push code to GitHub
2. Go to https://render.com → New Web Service
3. Connect repo, add env vars, deploy

### Option 2: Railway.app (Free Tier)
1. Go to https://railway.app
2. Deploy from GitHub
3. Add env vars
4. Auto-deploys on push

### Option 3: Oracle Cloud Free Tier (Forever Free)
1. Sign up at https://www.oracle.com/cloud/free/
2. Create a free VPS (2 ARM cores, 24GB RAM)
3. Install Node.js, clone repo, run with PM2

See `DEPLOY_GUIDE.md` for detailed steps.

## Adding Custom Strategies

1. Extend `BaseStrategy` class in `strategies.ts`
2. Implement `generateSignal(candles)` method
3. Add to `STRATEGIES` factory object
4. Run backtest with `strategy.backtest(candles)`

## License

MIT
