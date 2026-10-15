/**
 * Live trading bot - real-time monitoring and execution
 * Connects to Kite WebSocket, monitors positions, executes trades
 */

import { KiteClient } from './kiteClient.js';
import { KiteWebSocket } from './websocketClient.js';
import { LiveOrderExecutor } from './liveOrderExecutor.js';
import { TelegramNotifier } from './telegram.js';
import { TradingLogger } from './logger.js';
import { getStrategy, listStrategies } from './strategies.js';
import { getConfig } from './config.js';
import type { Candle, StrategySignal, Ticker } from './types.js';

const MARKET_OPEN = { hour: 9, minute: 15 };
const MARKET_CLOSE = { hour: 15, minute: 30 };
const STRONG_SIGNAL_THRESHOLD = 0.55;
const POSITION_CHECK_INTERVAL = 10000; // 10 seconds
const SUMMARY_INTERVAL = 60000; // 1 minute
const SIGNAL_COOLDOWN = 300000; // 5 minutes between signals per symbol

interface SymbolState {
  symbol: string;
  token: number;
  candles: Candle[];
  lastSignalTime: Record<string, number>;
}

interface BotStats {
  scansCompleted: number;
  signalsFired: number;
  ordersPlaced: number;
  ordersFailed: number;
  errors: number;
  startedAt: Date;
}

export class LiveBot {
  private config = getConfig();
  private kiteClient: KiteClient;
  private webSocket: KiteWebSocket;
  private executor: LiveOrderExecutor;
  private telegram: TelegramNotifier;
  private watchlist: SymbolState[] = [];
  private isRunning = false;
  private stats: BotStats = {
    scansCompleted: 0,
    signalsFired: 0,
    ordersPlaced: 0,
    ordersFailed: 0,
    errors: 0,
    startedAt: new Date(),
  };
  private positionCheckTimer: NodeJS.Timeout | null = null;
  private summaryTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.kiteClient = new KiteClient(this.config.KITE_ACCESS_TOKEN);
    this.webSocket = new KiteWebSocket();
    this.executor = new LiveOrderExecutor();
    this.telegram = new TelegramNotifier();
  }

  /**
   * Add a symbol to the watchlist
   */
  async addSymbol(symbol: string, token: number): Promise<void> {
    const candles = await this.kiteClient.getHistoricalCandles(
      token,
      this.config.HISTORICAL_DAYS,
      this.config.TIMEFRAME
    );

    this.watchlist.push({
      symbol,
      token,
      candles,
      lastSignalTime: {},
    });

    console.log(`📌 Added ${symbol} (token: ${token}, ${candles.length} historical candles)`);
  }

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    // Fetch initial data for all symbols
    const instruments = await this.kiteClient.getInstruments('NSE');
    const symbols = this.config.WATCHLIST.split(',').map(s => s.trim()).filter(Boolean);

    for (const symbol of symbols) {
      const instrument = instruments.find((i: any) => i.tradingsymbol === symbol);
      if (instrument) {
        await this.addSymbol(symbol, instrument.instrument_token);
      } else {
        console.warn(`⚠️  Symbol "${symbol}" not found in NSE instruments`);
      }
    }

    if (this.watchlist.length === 0) {
      throw new Error('No valid symbols in watchlist. Check WATCHLIST in .env');
    }

    // Set starting equity
    try {
      const margins = await this.kiteClient.getMargins();
      const equity = margins.net?.available?.cash ?? 100000;
      this.executor.setDayStartEquity(equity);
      console.log(`💰 Starting equity: ₹${equity.toLocaleString()}`);
    } catch {}

    // Subscribe to WebSocket
    const tokens = this.watchlist.map(s => s.token);
    this.webSocket.subscribe(tokens);
    this.webSocket.onTick(this.handleTick.bind(this));

    console.log(`\n✅ Initialized ${this.watchlist.length} symbols for live trading\n`);
  }

  /**
   * Start the live bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Bot is already running');
      return;
    }

    this.isRunning = true;
    this.stats.startedAt = new Date();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 LIVE TRADING BOT STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Trading days: Mon-Fri`);
    console.log(`🕐 Market hours: 9:15 AM - 3:30 PM IST`);
    console.log(`📊 Watchlist: ${this.watchlist.map(s => s.symbol).join(', ')}`);
    console.log(`🔌 WebSocket: ${this.webSocket.getConnectionState()}`);
    console.log(`📱 Telegram: ${this.telegram.isConnected ? '✅ Connected' : '❌ Not configured'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Send startup message
    if (this.telegram.isConnected) {
      await this.telegram.send(
        `🤖 <b>Live Bot Started</b>\nMode: <b>LIVE TRADING</b>\nWatchlist: ${this.watchlist.map(s => s.symbol).join(', ')}`
      );
    }

    // Connect WebSocket (with timeout - might fail in some environments)
    try {
      this.webSocket.connect();
      console.log('🔌 WebSocket initiated');
    } catch (wsErr) {
      console.warn('⚠️  WebSocket connection failed:', wsErr);
      console.log('   Bot will continue in monitoring mode without live ticks');
    }

    // Start periodic tasks
    this.positionCheckTimer = setInterval(() => this.checkPositions(), POSITION_CHECK_INTERVAL);
    this.summaryTimer = setInterval(() => this.sendSummary(), SUMMARY_INTERVAL);

    // Handle shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    console.log('✅ Bot is running. Monitoring markets...\n');
  }

  /**
   * Handle incoming ticks from WebSocket
   */
  private handleTick(ticker: Ticker): void {
    const state = this.watchlist.find(s => s.token === ticker.instrumentToken);
    if (!state) return;

    // Update last price in state
    const lastCandle = state.candles[state.candles.length - 1];
    if (lastCandle && Math.abs(lastCandle.close - ticker.lastPrice) > 0.01) {
      // Update the last candle's close price (simulate real-time update)
      lastCandle.close = ticker.lastPrice;
      lastCandle.high = Math.max(lastCandle.high, ticker.lastPrice);
      lastCandle.low = Math.min(lastCandle.low, ticker.lastPrice);
      lastCandle.volume = ticker.volume;
    }

    // Check for signals if we have enough data
    if (state.candles.length >= 50) {
      this.analyzeSymbol(state);
    }
  }

  /**
   * Analyze a symbol and check for trading signals
   */
  private async analyzeSymbol(state: SymbolState): Promise<void> {
    const now = Date.now();
    const currentPrice = state.candles[state.candles.length - 1].close;

    // Run all strategies
    for (const name of listStrategies()) {
      // Skip if cooldown active
      const lastSignal = state.lastSignalTime[name] ?? 0;
      if (now - lastSignal < SIGNAL_COOLDOWN) continue;

      const strategy = getStrategy(name);
      if (!strategy) continue;

      try {
        const signal = await strategy.analyze(state.candles);

        if (signal.action === 'buy' && signal.strength >= STRONG_SIGNAL_THRESHOLD) {
          this.stats.signalsFired++;
          state.lastSignalTime[name] = now;

          console.log(`🔔 Signal: ${state.symbol} - ${name} - BUY (strength: ${(signal.strength * 100).toFixed(0)}%)`);

          // Execute trade
          const order = await this.executor.placeBuyOrder(
            state.symbol,
            state.token,
            signal,
            currentPrice
          );

          if (order) {
            this.stats.ordersPlaced++;
          } else {
            this.stats.ordersFailed++;
          }
        }
      } catch (error) {
        console.error(`Error analyzing ${state.symbol}:`, error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Periodically check and update positions
   */
  private async checkPositions(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.executor.refreshPositions();
      await this.executor.checkExitConditions();
    } catch (error) {
      console.error('Error checking positions:', error);
    }
  }

  /**
   * Send periodic summary to Telegram
   */
  private async sendSummary(): Promise<void> {
    if (!this.isRunning) return;

    const positions = this.executor.getPositions();
    const metrics = this.executor.getRiskMetrics();
    const uptime = this.formatUptime();

    let message = `📊 <b>Bot Summary</b>\n`;
    message += `Uptime: ${uptime}\n`;
    message += `Scans: ${this.stats.scansCompleted} | Signals: ${this.stats.signalsFired} | Orders: ${this.stats.ordersPlaced}\n\n`;

    if (positions.length > 0) {
      message += `<b>Open Positions:</b>\n`;
      for (const pos of positions) {
        const pnlEmoji = pos.unrealizedPnl >= 0 ? '🟢' : '🔴';
        message += `${pnlEmoji} ${pos.symbol}: ${pos.side} ×${pos.quantity} @ ₹${pos.entryPrice.toFixed(0)}\n`;
        message += `  Current: ₹${pos.currentPrice.toFixed(0)} | P&L: ${pnlEmoji}₹${pos.unrealizedPnl.toFixed(0)} (${pos.unrealizedPct.toFixed(2)}%)\n`;
        message += `  SL: ₹${pos.stopLoss.toFixed(0)} | Target: ₹${pos.target.toFixed(0)}\n`;
      }
      message += '\n';
    }

    message += `<b>Risk:</b> Daily P&L: ₹${metrics.dailyPnl.toFixed(0)} (${metrics.dailyPnlPct.toFixed(2)}%)\n`;
    message += `Exposure: ₹${metrics.totalExposure.toFixed(0)} / ₹${metrics.marginAvailable.toFixed(0)} available`;

    await this.telegram.send(message.trim());
  }

  /**
   * Format uptime
   */
  private formatUptime(): string {
    const secs = Math.floor((Date.now() - this.stats.startedAt.getTime()) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  }

  /**
   * Stop the bot
   */
  stop(): void {
    this.isRunning = false;

    if (this.positionCheckTimer) {
      clearInterval(this.positionCheckTimer);
      this.positionCheckTimer = null;
    }
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }

    this.webSocket.disconnect();

    console.log('🛑 Live bot stopped');
    this.telegram.send('🛑 <b>Live Bot Stopped</b>').catch(() => {});
  }

  private async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down...');
    this.stop();
    process.exit(0);
  }

  // Getters for monitoring
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
