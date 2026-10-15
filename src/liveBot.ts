/**
 * Live trading bot - Alert Only Mode
 * Sends detailed, AI-like market alerts during market hours
 * No trading execution - monitoring and analysis only
 */

import { KiteClient } from './kiteClient.js';
import { KiteWebSocket } from './websocketClient.js';
import { TelegramNotifier } from './telegram.js';
import { getStrategy, listStrategies } from './strategies.js';
import { getConfig } from './config.js';
import type { Candle, StrategySignal, Ticker } from './types.js';

const MARKET_OPEN = { hour: 9, minute: 15 };
const MARKET_CLOSE = { hour: 15, minute: 30 };
const STRONG_SIGNAL_THRESHOLD = 0.55;
const ALERT_INTERVAL = 30000; // 30 seconds
const SUMMARY_INTERVAL = 120000; // 2 minutes for detailed summary
const SIGNAL_COOLDOWN = 180000; // 3 minutes cooldown per symbol per strategy
const GLOBAL_ALERT_COOLDOWN = 15000; // 15 seconds between any alerts
const API_CALL_DELAY = 500; // 500ms delay between API calls

interface SymbolState {
  symbol: string;
  token: number;
  candles: Candle[];
  lastSignalTime: Record<string, number>;
  currentPrice: number;
}

interface BotStats {
  scansCompleted: number;
  signalsFired: number;
  alertsSent: number;
  errors: number;
  startedAt: Date;
}

// AI-like message variations for natural responses
const ALERT_VARIATIONS = {
  bullish: [
    "Looks like {symbol} is showing some bullish momentum right now. The {strategy} strategy is picking up strength at {price}.",
    "Interesting move on {symbol} — we're seeing a {strategy} setup forming at ₹{price}. The technicals are leaning positive.",
    "{symbol} is catching my attention with a {strategy} signal. Price action at ₹{price} suggests potential upside.",
    "{symbol} is picking up — {strategy} indicator is active around ₹{price}. Worth watching closely.",
  ],
  bearish: [
    "Seeing some weakness in {symbol} here. The {strategy} pattern is flashing bearish at ₹{price}.",
    "{symbol} might be heading lower — {strategy} is showing a sell signal near ₹{price}.",
    "Caution on {symbol}: {strategy} indicates bearish pressure building at ₹{price}.",
    "Downward pressure detected on {symbol}. The {strategy} setup at ₹{price} suggests sellers are in control.",
  ],
  strong_buy: [
    "Strong BUY signal on {symbol}! {strategy} is firing with high conviction at ₹{price}. This one's worth watching closely.",
    "{symbol} is lighting up — {strategy} shows a powerful buy setup right at ₹{price}.",
    "High-confidence buy alert: {symbol} with {strategy} at ₹{price}. The indicators are aligned here.",
    "🔥 {symbol} just triggered a strong {strategy} buy signal at ₹{price}. This is a notable setup.",
  ],
  strong_sell: [
    "Strong SELL signal on {symbol}! {strategy} is firing with conviction at ₹{price}. Consider taking profits or avoiding.",
    "{symbol} is showing serious bearish pressure — {strategy} at ₹{price} suggests downside ahead.",
    "🔴 Heavy sell pressure on {symbol}. {strategy} confirms bearish momentum at ₹{price}.",
    "Significant sell signal: {symbol} with {strategy} firing hard at ₹{price}. Market sentiment shifting.",
  ],
  neutral: [
    "{symbol} is sitting in neutral territory at ₹{price}. No clear directional bias from {strategy} right now.",
    "Consolidation phase on {symbol} — {strategy} shows nothing actionable at ₹{price}.",
    "{symbol} at ₹{price}: {strategy} is flat. Market's taking a breather here.",
  ],
  market_open: [
    "Market just opened! Let me get my bearings on all {symbol_count} stocks. First scan coming up...",
    "Good morning! Market's open and I'm scanning through the watchlist. Let me check what's moving.",
    "9:15 AM — markets are live. Running my first pass across all symbols now.",
  ],
  midday: [
    "Midday check-in. Let me see what's happened since we started — scanning the watchlist now.",
    "Halfway through the session. Running through my analysis on all {symbol_count} stocks.",
    "Lunchtime update — checking in on {symbol_count} stocks to see what the market's doing.",
  ],
};

export class LiveBot {
  private config = getConfig();
  private kiteClient: KiteClient;
  private webSocket: KiteWebSocket;
  private telegram: TelegramNotifier;
  private watchlist: SymbolState[] = [];
  private isRunning = false;
  private stats: BotStats = {
    scansCompleted: 0,
    signalsFired: 0,
    alertsSent: 0,
    errors: 0,
    startedAt: new Date(),
  };
  private pollingTimer: NodeJS.Timeout | null = null;
  private summaryTimer: NodeJS.Timeout | null = null;
  private messageIndex = 0;
  private lastAlertKey = '';
  private lastSummaryTime = 0;
  private lastGlobalAlertTime = 0;

  constructor() {
    this.kiteClient = new KiteClient(this.config.KITE_ACCESS_TOKEN);
    this.webSocket = new KiteWebSocket();
    this.telegram = new TelegramNotifier();
  }

  /**
   * Delay helper to prevent rate limiting
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async addSymbol(symbol: string, token: number): Promise<void> {
    // Fetch fewer candles to avoid rate limits - only need 100 for analysis
    const candles = await this.kiteClient.getHistoricalCandles(
      token,
      10, // 10 days instead of 365
      this.config.TIMEFRAME
    );

    await this.delay(API_CALL_DELAY); // Small delay between calls

    this.watchlist.push({
      symbol,
      token,
      candles,
      lastSignalTime: {},
      currentPrice: candles.length > 0 ? candles[candles.length - 1].close : 0,
    });

    console.log(`📌 Added ${symbol} (token: ${token}, ${candles.length} historical candles)`);
  }

  async initialize(): Promise<void> {
    // Send initial confirmation immediately (before heavy API calls)
    if (this.telegram.isConnected) {
      await this.telegram.send(
        `🤖 <b>Initializing Bot...</b>\n\nMode: <b>ALERTS ONLY</b>\nLoading watchlist...`
      );
    }

    await this.delay(2000); // Wait before making API calls

    // Fetch instruments list
    const instruments = await this.kiteClient.getInstruments('NSE');
    const symbols = this.config.WATCHLIST.split(',').map(s => s.trim()).filter(Boolean);

    console.log(`Found ${instruments.length} instruments in NSE`);

    // Add symbols with delays between each
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const instrument = instruments.find((inst: any) => inst.tradingsymbol === symbol);

      if (instrument) {
        try {
          await this.addSymbol(symbol, instrument.instrument_token);
        } catch (error: any) {
          console.error(`⚠️  Failed to add ${symbol}:`, error.message);
          if (error.message?.includes('Too many requests')) {
            console.log(`   Waiting 5 seconds before continuing...`);
            await this.delay(5000);
            // Try again once
            try {
              await this.addSymbol(symbol, instrument.instrument_token);
            } catch (retryError) {
              console.error(`   Still failed after retry`);
            }
          }
        }
      } else {
        console.warn(`⚠️  Symbol "${symbol}" not found in NSE instruments`);
      }
    }

    if (this.watchlist.length === 0) {
      throw new Error('No valid symbols in watchlist. Check WATCHLIST in .env');
    }

    // Subscribe to WebSocket
    const tokens = this.watchlist.map(s => s.token);
    this.webSocket.subscribe(tokens);
    this.webSocket.onTick(this.handleTick.bind(this));

    console.log(`\n✅ Initialized ${this.watchlist.length} symbols for live monitoring\n`);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Bot is already running');
      return;
    }

    this.isRunning = true;
    this.stats.startedAt = new Date();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 ALERT-ONLY BOT STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Trading days: Mon-Fri`);
    console.log(`🕐 Market hours: 9:15 AM - 3:30 PM IST`);
    console.log(`📊 Watchlist: ${this.watchlist.length} symbols`);
    console.log(`🔌 WebSocket: ${this.webSocket.getConnectionState()}`);
    console.log(`📱 Telegram: ${this.telegram.isConnected ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`⚠️  Mode: ALERTS ONLY (no trading execution)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Send startup message
    if (this.telegram.isConnected) {
      await this.telegram.send(
        `🤖 <b>Alert-Only Bot Started</b>\n\nMode: <b>ALERTS ONLY</b>\nWatchlist: ${this.watchlist.map(s => s.symbol).join(', ')}\n\nI'll send you detailed market updates every 2 minutes during trading hours. No trades will be placed.`
      );
    }

    await this.delay(2000);

    // Connect WebSocket
    try {
      this.webSocket.connect();
      console.log('🔌 WebSocket initiated');
    } catch (wsErr: any) {
      console.warn('⚠️  WebSocket connection failed:', wsErr?.message);
      console.log('   Bot will continue with polling mode');
    }

    console.log('📡 Starting polling mode (30s intervals)...');
    this.pollingTimer = setInterval(() => this.pollMarketData(), ALERT_INTERVAL);
    this.summaryTimer = setInterval(() => this.sendSummary(), SUMMARY_INTERVAL);

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    console.log('✅ Bot is running. Sending alerts during market hours...\n');
  }

  private handleTick(ticker: Ticker): void {
    const state = this.watchlist.find(s => s.token === ticker.instrumentToken);
    if (!state) return;

    state.currentPrice = ticker.lastPrice;

    const lastCandle = state.candles[state.candles.length - 1];
    if (lastCandle && Math.abs(lastCandle.close - ticker.lastPrice) > 0.01) {
      lastCandle.close = ticker.lastPrice;
      lastCandle.high = Math.max(lastCandle.high, ticker.lastPrice);
      lastCandle.low = Math.min(lastCandle.low, ticker.lastPrice);
      lastCandle.volume = ticker.volume;
    }

    if (state.candles.length >= 50) {
      this.analyzeSymbol(state);
    }
  }

  private async analyzeSymbol(state: SymbolState): Promise<void> {
    if (!this.isMarketHours()) return;

    // Check global alert cooldown
    const now = Date.now();
    if (now - this.lastGlobalAlertTime < GLOBAL_ALERT_COOLDOWN) return;

    const currentPrice = state.currentPrice || state.candles[state.candles.length - 1].close;

    for (const name of listStrategies()) {
      const lastSignal = state.lastSignalTime[name] ?? 0;
      if (now - lastSignal < SIGNAL_COOLDOWN) continue;

      const strategy = getStrategy(name);
      if (!strategy) continue;

      try {
        const signal = await strategy.analyze(state.candles);

        if (signal.strength >= STRONG_SIGNAL_THRESHOLD) {
          this.stats.signalsFired++;
          state.lastSignalTime[name] = now;
          this.lastGlobalAlertTime = now;

          console.log(`🔔 Signal: ${state.symbol} - ${name} - ${signal.action.toUpperCase()} (strength: ${(signal.strength * 100).toFixed(0)}%)`);

          await this.sendAIAlert(state.symbol, name, signal, currentPrice);
        }
      } catch (error) {
        console.error(`Error analyzing ${state.symbol}:`, error);
        this.stats.errors++;
      }
    }
  }

  private async sendAIAlert(symbol: string, strategy: string, signal: StrategySignal, price: number): Promise<void> {
    const strength = Math.round(signal.strength * 100);
    const action = signal.action;

    let category: string;
    if (action === 'buy' && strength >= 70) {
      category = 'strong_buy';
    } else if (action === 'buy') {
      category = 'bullish';
    } else if (action === 'sell' && strength >= 70) {
      category = 'strong_sell';
    } else if (action === 'sell') {
      category = 'bearish';
    } else {
      category = 'neutral';
    }

    const messages = ALERT_VARIATIONS[category as keyof typeof ALERT_VARIATIONS];
    if (!messages || messages.length === 0) return;

    let template = messages[this.messageIndex % messages.length];
    this.messageIndex++;

    let attempts = 0;
    while (template === this.lastAlertKey && attempts < messages.length) {
      template = messages[this.messageIndex % messages.length];
      this.messageIndex++;
      attempts++;
    }
    this.lastAlertKey = template;

    let message = template
      .replace(/{symbol}/g, symbol)
      .replace(/{strategy}/g, strategy)
      .replace(/{price}/g, price.toFixed(2))
      .replace(/{strength}/g, strength.toString())
      .replace(/{symbol_count}/g, this.watchlist.length.toString());

    message += `\n\n💡 ${signal.reason}`;
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    message += `\n⏰ ${time}`;

    await this.telegram.send(message.trim());
    this.stats.alertsSent++;
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hour = ist.getHours();
    const minute = ist.getMinutes();
    const totalMin = hour * 60 + minute;
    return totalMin >= (9 * 60 + 15) && totalMin <= (15 * 60 + 30);
  }

  private async sendSummary(): Promise<void> {
    if (!this.isRunning) return;
    if (!this.isMarketHours()) return;

    // Check cooldown
    const now = Date.now();
    if (now - this.lastSummaryTime < SUMMARY_INTERVAL) return;
    this.lastSummaryTime = now;

    this.stats.scansCompleted++;

    const signals: Array<{ symbol: string; strategy: string; signal: StrategySignal; price: number }> = [];

    for (const state of this.watchlist) {
      if (state.candles.length < 50) continue;

      for (const name of listStrategies()) {
        const strategy = getStrategy(name);
        if (!strategy) continue;

        try {
          const signal = await strategy.analyze(state.candles);
          if (signal.strength >= STRONG_SIGNAL_THRESHOLD) {
            signals.push({
              symbol: state.symbol,
              strategy: name,
              signal,
              price: state.currentPrice || state.candles[state.candles.length - 1].close,
            });
          }
        } catch {}
      }
    }

    const summary = this.generateMarketSummary(signals);
    await this.telegram.send(summary);
  }

  private generateMarketSummary(signals: Array<{ symbol: string; strategy: string; signal: StrategySignal; price: number }>): string {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const timeStr = ist.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const totalMin = ist.getHours() * 60 + ist.getMinutes();

    let openingNote = '';
    if (totalMin >= 9 * 60 + 15 && totalMin < 9 * 60 + 45) {
      openingNote = "Just started — scanning the market for early opportunities...\n\n";
    } else if (totalMin >= 12 * 60 && totalMin < 13 * 60) {
      openingNote = "Midday check-in — reviewing what's happening across the watchlist:\n\n";
    } else if (totalMin >= 15 * 60 && totalMin <= 15 * 60 + 30) {
      openingNote = "Market's wrapping up — here's how things are shaping up:\n\n";
    }

    if (signals.length === 0) {
      return `📊 <b>Market Status</b> — ${timeStr}\n\n${openingNote}No strong signals detected right now. The market is in a consolidation phase across most of the watchlist. I'll keep monitoring and alert you when something interesting comes up.\n\n📈 ${this.watchlist.length} stocks being tracked`;
    }

    const buys = signals.filter(s => s.signal.action === 'buy');
    const sells = signals.filter(s => s.signal.action === 'sell');

    let message = `📊 <b>Market Update</b> — ${timeStr}\n\n${openingNote}`;

    if (buys.length > 0) {
      message += `<b>🟢 Buy Signals (${buys.length}):</b>\n`;
      for (const s of buys.slice(0, 3)) {
        const strength = Math.round(s.signal.strength * 100);
        message += `• ${s.symbol} — ${s.strategy} @ ₹${s.price.toFixed(0)} (${strength}%)\n`;
      }
      if (buys.length > 3) {
        message += `• ...and ${buys.length - 3} more\n`;
      }
      message += '\n';
    }

    if (sells.length > 0) {
      message += `<b>🔴 Sell Signals (${sells.length}):</b>\n`;
      for (const s of sells.slice(0, 3)) {
        const strength = Math.round(s.signal.strength * 100);
        message += `• ${s.symbol} — ${s.strategy} @ ₹${s.price.toFixed(0)} (${strength}%)\n`;
      }
      if (sells.length > 3) {
        message += `• ...and ${sells.length - 3} more\n`;
      }
      message += '\n';
    }

    const totalSignals = signals.length;
    let sentiment = '';
    if (totalSignals <= 2) {
      sentiment = 'Low activity — market is quiet right now.';
    } else if (totalSignals <= 5) {
      sentiment = 'Moderate movement — a few setups are forming.';
    } else if (totalSignals <= 10) {
      sentiment = 'Active session — several signals detected across the watchlist.';
    } else {
      sentiment = 'High volatility — lots of action happening across multiple stocks!';
    }

    message += `<i>${sentiment}</i>\n\n`;
    message += `📡 Scanning ${this.watchlist.length} stocks | ${this.stats.scansCompleted} scans`;

    return message.trim();
  }

  private async pollMarketData(): Promise<void> {
    if (!this.isRunning) return;

    this.stats.scansCompleted++;

    for (const state of this.watchlist) {
      try {
        const candles = await this.kiteClient.getHistoricalCandles(
          state.token,
          1,
          this.config.TIMEFRAME
        );

        await this.delay(API_CALL_DELAY);

        if (candles.length > 0) {
          const latestCandle = candles[0];

          if (state.candles.length === 0 ||
              Math.abs(state.candles[state.candles.length - 1].close - latestCandle.close) > 0.01) {
            state.candles.push(latestCandle);
            if (state.candles.length > 500) {
              state.candles = state.candles.slice(-500);
            }
            state.currentPrice = latestCandle.close;
          }

          if (state.candles.length >= 50) {
            await this.analyzeSymbol(state);
          }
        }
      } catch (error: any) {
        console.error(`Error polling ${state.symbol}:`, error.message);
        this.stats.errors++;

        // Handle rate limiting gracefully
        if (error.message?.includes('Too many requests')) {
          console.log(`   Rate limited. Waiting 10 seconds...`);
          await this.delay(10000);
        }
      }
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }

    this.webSocket.disconnect();

    console.log('🛑 Live bot stopped');
    this.telegram.send('🛑 <b>Alert Bot Stopped</b>').catch(() => {});
  }

  private async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down...');
    this.stop();
    process.exit(0);
  }

  get isRunningState(): boolean {
    return this.isRunning;
  }

  get botStats(): BotStats {
    return { ...this.stats };
  }

  get watchlistState(): Array<{ symbol: string; token: number; candles: number }> {
    return this.watchlist.map(s => ({
      symbol: s.symbol,
      token: s.token,
      candles: s.candles.length,
    }));
  }
}
