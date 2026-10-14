/**
 * Auto-trader — continuously scans during market hours
 * Sends DETAILED alerts to Telegram every 10 minutes
 */

import { getConfig } from './config.js';
import { getStrategy, listStrategies } from './strategies.js';
import { KiteClient } from './kiteClient.js';
import { TelegramNotifier } from './telegram.js';
import { calculateAllIndicators } from './indicators.js';
import { TradingLogger } from './logger.js';
import type { Candle, StrategySignal } from './types.js';

const MARKET_OPEN = { hour: 9, minute: 15 };
const MARKET_CLOSE = { hour: 15, minute: 30 };
const STRONG_SIGNAL_THRESHOLD = 0.5; // Alert when strength > 50%

interface ScannedSymbol {
  symbol: string;
  token: number;
  lastAlert?: Date;
}

export class AutoTrader {
  private config = getConfig();
  private kiteClient: KiteClient;
  private telegram: TelegramNotifier;
  private watchlist: ScannedSymbol[] = [];
  private isRunning = false;
  private scanCount = 0;

  constructor() {
    this.kiteClient = new KiteClient(this.config.KITE_ACCESS_TOKEN);
    this.telegram = new TelegramNotifier();
  }

  /**
   * Add a symbol to the watchlist
   */
  addSymbol(symbol: string, token: number) {
    this.watchlist.push({ symbol, token });
    console.log(`📌 Added ${symbol} to watchlist`);
  }

  /**
   * Check if current time is within market hours (IST)
   */
  isInMarketHours(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hour = ist.getHours();
    const minute = ist.getMinutes();
    const totalMinutes = hour * 60 + minute;
    const openMinutes = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute;
    const closeMinutes = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute;
    return totalMinutes >= openMinutes && totalMinutes <= closeMinutes;
  }

  /**
   * Check if today is a trading day (Mon-Fri)
   */
  isTradingDay(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = ist.getDay() === 0 ? 7 : ist.getDay(); // 1=Mon, 7=Sun
    return day >= 1 && day <= 5;
  }

  /**
   * Get detailed analysis for a symbol
   */
  async analyzeSymbol(symbol: string, candles: Candle[]): Promise<{
    signals: Array<{ strategy: string; signal: StrategySignal }>;
    indicators: Record<string, any>;
    price: number;
  }> {
    const price = candles[candles.length - 1].close;
    const indicators = calculateAllIndicators(candles);
    const signals: Array<{ strategy: string; signal: StrategySignal }> = [];

    // Run all strategies
    for (const name of listStrategies()) {
      const strategy = getStrategy(name);
      if (!strategy) continue;

      const signal = await strategy.analyze(candles);
      signals.push({ strategy: name, signal });
    }

    return { signals, indicators, price };
  }

  /**
   * Send detailed alert to Telegram
   */
  async sendDetailedAlert(symbol: string, analysis: any) {
    const { signals, indicators, price } = analysis;
    const strongSignals = signals.filter((s: any) => s.signal.strength >= STRONG_SIGNAL_THRESHOLD);

    if (strongSignals.length === 0) {
      // Still send summary for price tracking
      const rsi = indicators['RSI14']?.values[indicators['RSI14'].values.length - 1]?.toFixed(1) || 'N/A';
      const ma = indicators['SMA20']?.values[indicators['SMA20'].values.length - 1]?.toFixed(2) || 'N/A';

      await this.telegram.send(`
📊 <b>${symbol}</b>
Price: <b>₹${price.toFixed(2)}</b>
RSI: <code>${rsi}</code> | SMA20: <code>₹${ma}</code>

No strong signals right now. Waiting for entry...
⏱️ Last scan: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
      `.trim());
      return;
    }

    // Build detailed message
    let message = `🔔 <b>${symbol} — ALERT</b>\n`;
    message += `Price: <b>₹${price.toFixed(2)}</b>\n\n`;

    for (const { strategy, signal } of strongSignals) {
      const emoji = signal.action === 'buy' ? '🟢' : signal.action === 'sell' ? '🔴' : '⚪';
      message += `${emoji} <b>${strategy}</b>\n`;
      message += `Action: <code>${signal.action.toUpperCase()}</code>\n`;
      message += `Strength: <b>${Math.round(signal.strength * 100)}%</b>\n`;
      message += `Reason: ${signal.reason}\n`;

      // Add indicator values
      const indEntries = Object.entries(signal.indicators)
        .map(([k, v]) => typeof v === 'number' ? `${k}: <b>${v.toFixed(2)}</b>` : `${k}: ${v}`)
        .join(', ');
      if (indEntries) message += `Indicators: ${indEntries}\n`;

      message += '\n';
    }

    // Add overall context
    const rsi = indicators['RSI14']?.values[indicators['RSI14'].values.length - 1];
    if (rsi && !isNaN(rsi)) {
      message += `📈 <b>Overview:</b> RSI=${rsi.toFixed(1)} `;
      if (rsi < 30) message += '(Oversold - potential buy)';
      else if (rsi > 70) message += '(Overbought - potential sell)';
      else message += '(Neutral)';
      message += '\n';
    }

    message += `\n⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

    await this.telegram.send(message.trim());
  }

  /**
   * Scan all symbols in watchlist
   */
  async scan(): Promise<void> {
    this.scanCount++;
    console.log(`\n[${this.scanCount}] 🔍 Scanning ${this.watchlist.length} symbols...`);

    for (const item of this.watchlist) {
      try {
        const candles = await this.kiteClient.getHistoricalCandles(
          item.token,
          this.config.HISTORICAL_DAYS,
          this.config.TIMEFRAME
        );

        if (candles.length < 20) continue;

        const analysis = await this.analyzeSymbol(item.symbol, candles);
        const price = candles[candles.length - 1].close;
        // Save to history
        await TradingLogger.logScan(item.symbol, candles, analysis.signals, price);

        // Send detailed alert (always, not just on strong signals)
        await this.sendDetailedAlert(item.symbol, analysis);

        console.log(`   ✅ ${item.symbol}: ${analysis.signals.filter((s: any) => s.signal.strength >= 0.5).length} strong signals`);

      } catch (error) {
        console.error(`   ❌ Error scanning ${item.symbol}:`, error);
      }
    }

    console.log('   ✅ Scan complete');
  }

  /**
   * Start auto-trading loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Auto-trader already running');
      return;
    }
    this.isRunning = true;

    const intervalMs = this.config.SCAN_INTERVAL_MIN * 60 * 1000;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 AUTO-TRADER STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Trading days: Mon-Fri`);
    console.log(`🕐 Market hours: 9:15 AM - 3:30 PM IST`);
    console.log(`⏱️  Scan interval: ${this.config.SCAN_INTERVAL_MIN} minutes`);
    console.log(`📊 Watchlist: ${this.watchlist.map(s => s.symbol).join(', ')}`);
    console.log(`📱 Telegram: ${this.telegram.isConnected ? '✅ Connected' : '❌ Not configured'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Send startup message
    if (this.telegram.isConnected) {
      await this.telegram.send(`🤖 <b>Auto-Trader Started</b>\nScanning every ${this.config.SCAN_INTERVAL_MIN} min\n\nWatchlist: ${this.watchlist.map(s => s.symbol).join(', ')}`);
    }

    const runScan = async () => {
      if (!this.isRunning) return;

      const now = new Date();
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const day = ist.getDay() === 0 ? 7 : ist.getDay();
      const hour = ist.getHours();
      const minute = ist.getMinutes();

      // Check if it's a trading day and market hours
      const isTradingDay = day >= 1 && day <= 5;
      const isInHours = (hour * 60 + minute) >= (MARKET_OPEN.hour * 60 + MARKET_OPEN.minute) &&
                        (hour * 60 + minute) <= (MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute);

      if (isTradingDay && isInHours) {
        await this.scan();
      } else if (this.scanCount % 6 === 0) { // Only log every ~hour to reduce noise
        console.log(`⏸️  Outside market hours (${ist.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})`);
      }
    };

    // Run immediately
    await runScan();

    // Schedule periodic scans
    setInterval(async () => {
      await runScan();
    }, intervalMs);

    console.log(`📡 Next scan in ${this.config.SCAN_INTERVAL_MIN} minutes\n`);
  }

  /**
   * Stop the auto-trader
   */
  stop(): void {
    this.isRunning = false;
    console.log('🛑 Auto-trader stopped');
  }
}
