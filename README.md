# Zerodha Trading Analysis & Execution System

A TypeScript-based trading system for Zerodha Kite Connect API featuring:
- **Technical Analysis** - Built-in indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic)
- **Strategy Framework** - Pluggable strategies with backtesting
- **Paper Trading** - Risk-managed simulated trading
- **Live Trading Ready** - Kite Connect integration for real execution

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Credentials
```bash
cp .env.example .env
# Edit .env with your Kite Connect credentials from https://developers.kite.trade/
```

### 3. Get Access Token
```bash
npm run dev
# Visit the login URL shown in console
# After login, copy the request_token from redirect URL
# Use it to generate session (see auth.ts)
```

### 4. Run Analysis
```bash
npm run dev
```

## Project Structure

```
src/
├── config.ts         # Configuration management
├── types.ts          # TypeScript type definitions
├── kiteClient.ts     # Kite Connect API wrapper
├── indicators.ts     # Technical indicators (SMA, EMA, RSI, MACD, BB, ATR, Stoch)
├── strategies.ts     # Trading strategies with backtesting
├── paperTrading.ts   # Paper trading engine
└── index.ts          # Main entry point
```

## Available Strategies

| Strategy | Description |
|----------|-------------|
| `ma-crossover` | Moving Average Crossover (fast vs slow MA) |
| `rsi-reversion` | RSI Mean Reversion (oversold/overbought) |
| `macd` | MACD Zero-line Crossover |
| `bollinger-bands` | Bollinger Bands Mean Reversion |

## Configuration

Key environment variables in `.env`:

```env
# Kite Connect API
KITE_API_KEY=your_api_key
KITE_API_SECRET=your_api_secret
KITE_ACCESS_TOKEN=  # Generated after login flow

# Trading
TRADING_MODE=paper  # paper | live
MAX_POSITIONS=5

# Risk Management
MAX_DAILY_LOSS_PCT=2
STOP_LOSS_PCT=0.5
TARGET_PCT=1.5

# Data
HISTORICAL_DAYS=365
TIMEFRAME=day  # minute, 5minute, 15minute, 30minute, 60minute, day
```

## Running Tests

```bash
npm test
```

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build
```

## Adding Custom Strategies

1. Extend `BaseStrategy` class in `strategies.ts`
2. Implement `generateSignal(candles)` method
3. Register in `STRATEGIES` factory object
4. Run backtest with `strategy.backtest(candles)`

## Paper Trading Features

- Position sizing based on equity percentage
- Stop loss & take profit management
- Daily loss limits
- Max position limits
- Real-time P&L tracking
- Risk metrics dashboard

## Live Trading

Set `TRADING_MODE=live` in `.env` and ensure:
- Valid Kite Access Token
- Sufficient margins
- Proper risk controls tested in paper mode first

## License

MIT