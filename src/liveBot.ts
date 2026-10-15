/**
 * Live trading bot - Alert Only Mode
 * Simple, resilient implementation that avoids rate limits
 */

import { KiteClient } from './kiteClient.js';
import { KiteWebSocket } from './websocketClient.js';
import { TelegramNotifier } from './telegram.js';
import { getStrategy, listStrategies } from './strategies.js';
import { getConfig } from './config.js';
import type { Candle, StrategySignal, Ticker } from './types.js';

const MARKET_OPEN = 9 * 60 + 15; // 9:15 AM
const MARKET_CLOSE = 15 * 60 + 30; // 3:30 PM
const STRONG_SIGNAL_THRESHOLD = 0.55;
const POLL_INTERVAL = 60000; // 1 minute
const SUMMARY_INTERVAL = 180000; // 3 minutes
const SIGNAL_COOLDOWN = 300000; // 5 minutes
const GLOBAL_COOLDOWN = 30000; // 30 seconds

interface SymbolState {
  symbol: string;
  token: number;
  candles: Candle[];
  lastSignal: string;
  lastSignalTime: number;
  currentPrice: number;
}

interface BotStats {
  scansCompleted: number;
  signalsFired: number;
  alertsSent: number;
  errors: number;
  rateLimits: number;
  startedAt: Date;
}

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
    rateLimits: 0,
    startedAt: new Date(),
  };
  private lastAlertTime = 0;
  private lastSummaryTime = 0;
  private pollingTimer: NodeJS.Timeout | null = null;
  private summaryTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.kiteClient = new KiteClient(this.config.KITE_ACCESS_TOKEN);
    this.webSocket = new KiteWebSocket();
    this.telegram = new TelegramNotifier();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async send(text: string): Promise<void> {
    if (!this.telegram.isConnected) return;
    await this.telegram.send(text);
  }

  async initialize(): Promise<void> {
    await this.send('🤖 <b>Initializing Bot...</b>');
    await this.delay(2000);

    let instruments: any[] = [];
    try {
      await this.send('📊 Fetching market instruments...');
      instruments = await this.kiteClient.getInstruments('NSE');
      console.log(`✅ Got ${instruments.length} instruments`);
    } catch (error: any) {
      console.error('❌ Failed to get instruments:', error.message);
      await this.send(`⚠️  Could not fetch instruments: ${error.message}`);
      await this.delay(10000);
      return;
    }

    const symbols = this.config.WATCHLIST.split(',').map(s => s.trim()).filter(Boolean);

    for (const symbol of symbols) {
      const instrument = instruments.find((i: any) => i.tradingsymbol === symbol);
      if (!instrument) {
        console.warn(`⚠️  ${symbol} not found`);
        continue;
      }

      await this.send(`📌 Adding ${symbol}...`);
      await this.delay(1000);

      try {
        const candles = await this.kiteClient.getHistoricalCandles(
          instrument.instrument_token,
          3,
          this.config.TIMEFRAME
        );

        this.watchlist.push({
          symbol,
          token: instrument.instrument_token,
          candles,
          lastSignal: '',
          lastSignalTime: 0,
          currentPrice: candles.length > 0 ? candles[candles.length - 1].close : 0,
        });

        console.log(`✅ Added ${symbol}`);
      } catch (error: any) {
        console.error(`❌ Failed ${symbol}:`, error.message);
        if (error.message?.includes('Too many requests')) {
          console.log('⏳ Rate limited. Waiting 15 seconds...');
          await this.delay(15000);
        }
      }
    }

    if (this.watchlist.length === 0) {
      await this.send('❌ No symbols loaded. Check your WATCHLIST.');
      throw new Error('No valid symbols');
    }

    console.log(`\n✅ Loaded ${this.watchlist.length} symbols\n`);

    const tokens = this.watchlist.map(s => s.token);
    this.webSocket.subscribe(tokens);
    this.webSocket.onTick(this.handleTick.bind(this));

    await this.send(`✅ <b>Bot Initialized</b>\n\nWatchlist: ${this.watchlist.map(s => s.symbol).join(', ')}\n\nStarting monitoring...`);
    await this.delay(2000);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 BOT STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Watchlist: ${this.watchlist.length} symbols`);
    console.log(`📱 Telegram: ${this.telegram.isConnected ? '✅' : '❌'}`);
    console.log(`⏰ Market hours: 9:15 AM - 3:30 PM IST`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      this.webSocket.connect();
      console.log('🔌 WebSocket started');
    } catch (e: any) {
      console.log('⚠️  WebSocket failed, using polling mode');
    }

    this.pollingTimer = setInterval(() => this.poll(), POLL_INTERVAL);
    this.summaryTimer = setInterval(() => this.sendSummary(), SUMMARY_INTERVAL);

    console.log('✅ Bot is running!\n');
  }

  private handleTick(ticker: Ticker): void {
    const state = this.watchlist.find(s => s.token === ticker.instrumentToken);
    if (!state) return;

    state.currentPrice = ticker.lastPrice;
    this.analyzeSymbol(state);
  }

  private async analyzeSymbol(state: SymbolState): Promise<void> {
    const now = Date.now();
    if (now - this.lastAlertTime < GLOBAL_COOLDOWN) return;

    const currentPrice = state.candles[state.candles.length - 1]?.close || state.currentPrice;
    if (!currentPrice || state.candles.length < 10) return;

    for (const name of listStrategies()) {
      if (now - state.lastSignalTime < SIGNAL_COOLDOWN) continue;

      const strategy = getStrategy(name);
      if (!strategy) continue;

      try {
        const signal = await strategy.analyze(state.candles);
        if (!signal || signal.strength < STRONG_SIGNAL_THRESHOLD) continue;

        state.lastSignal = name;
        state.lastSignalTime = now;
        this.lastAlertTime = now;
        this.stats.signalsFired++;

        console.log(`🔔 ${state.symbol} ${signal.action.toUpperCase()} ${name} ${Math.round(signal.strength * 100)}%`);

        const message = `🔔 <b>${state.symbol}</b>\n\n${signal.action.toUpperCase()} Signal from ${name}\nPrice: ₹${currentPrice.toFixed(0)}\nStrength: ${Math.round(signal.strength * 100)}%\n\n💡 ${signal.reason}`;

        await this.send(message);
        this.stats.alertsSent++;
        break;
      } catch (error) {
        console.error(`Error analyzing ${state.symbol}:`, error);
        this.stats.errors++;
      }
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    this.stats.scansCompleted++;

    for (const state of this.watchlist) {
      try {
        const candles = await this.kiteClient.getHistoricalCandles(
          state.token,
          1,
          this.config.TIMEFRAME
        );

        if (candles.length > 0) {
          state.candles = candles;
          state.currentPrice = candles[0].close;
          await this.analyzeSymbol(state);
        }
      } catch (error: any) {
        if (error.message?.includes('Too many requests')) {
          this.stats.rateLimits++;
          console.log('⏳ Rate limited, waiting 30s...');
          await this.send('⚠️  Rate limited. Waiting 30 seconds...');
          await this.delay(30000);
          break;
        }
      }
      await this.delay(500);
    }
  }

  private async sendSummary(): Promise<void> {
    if (!this.isRunning || !this.isMarketHours()) return;

    const now = Date.now();
    if (now - this.lastSummaryTime < SUMMARY_INTERVAL) return;
    this.lastSummaryTime = now;

    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const time = ist.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

    let buyCount = 0;
    let sellCount = 0;

    for (const state of this.watchlist) {
      if (state.candles.length < 10) continue;
      for (const name of listStrategies()) {
        const strategy = getStrategy(name);
        if (!strategy) continue;
        try {
          const signal = await strategy.analyze(state.candles);
          if (signal?.strength >= STRONG_SIGNAL_THRESHOLD) {
            if (signal.action === 'buy') buyCount++;
            else if (signal.action === 'sell') sellCount++;
          }
        } catch {}
      }
    }

    let message = `📊 <b>Market Update</b> — ${time}\n\n`;

    if (buyCount > 0 || sellCount > 0) {
      message += `🟢 Buy Signals: ${buyCount}\n`;
      message += `🔴 Sell Signals: ${sellCount}\n\n`;
    }

    message += `📡 ${this.watchlist.length} stocks monitored\n⏰ ${time} IST`;

    await this.send(message.trim());
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const minutes = ist.getHours() * 60 + ist.getMinutes();
    return minutes >= MARKET_OPEN && minutes <= MARKET_CLOSE;
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    this.webSocket.disconnect();
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
