/**
 * Live order executor - handles placing, managing, and tracking orders
 */

import { KiteClient } from './kiteClient.js';
import { TelegramNotifier } from './telegram.js';
import { TradingLogger } from './logger.js';
import { getConfig } from './config.js';
import type { StrategySignal, KiteOrder } from './types.js';

export interface ExecutedOrder {
  symbol: string;
  instrumentToken: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  orderId: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
  stopLoss: number;
  target: number;
  timestamp: Date;
  strategy: string;
  reason: string;
}

export interface LivePosition {
  symbol: string;
  instrumentToken: number;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  target: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  order: ExecutedOrder;
}

export class LiveOrderExecutor {
  private config = getConfig();
  private kiteClient: KiteClient;
  private telegram: TelegramNotifier;
  private executedOrders: Map<string, ExecutedOrder> = new Map();
  private positions: Map<string, LivePosition> = new Map();
  private dailyPnl = 0;
  private dayStartEquity = 100000;
  private lastOrderTime: Record<string, number> = {}; // Per-symbol cooldown

  constructor() {
    this.kiteClient = new KiteClient(this.config.KITE_ACCESS_TOKEN);
    this.telegram = new TelegramNotifier();
  }

  setDayStartEquity(equity: number): void {
    this.dayStartEquity = equity;
  }

  /**
   * Check if we can open a new position
   */
  canOpenPosition(symbol: string): { ok: boolean; reason?: string } {
    if (this.positions.has(symbol)) {
      return { ok: false, reason: `Already holding ${symbol}` };
    }
    if (this.positions.size >= this.config.MAX_POSITIONS) {
      return { ok: false, reason: `Max positions (${this.config.MAX_POSITIONS}) reached` };
    }
    const dailyLossLimit = this.dayStartEquity * (this.config.MAX_DAILY_LOSS_PCT / 100);
    if (this.dailyPnl <= -dailyLossLimit) {
      return { ok: false, reason: `Daily loss limit (${this.config.MAX_DAILY_LOSS_PCT}%) reached` };
    }
    // Check cooldown (5 min between trades per symbol)
    const now = Date.now();
    const lastTrade = this.lastOrderTime[symbol] ?? 0;
    if (now - lastTrade < 5 * 60 * 1000) {
      const remaining = Math.ceil((5 * 60 * 1000 - (now - lastTrade)) / 60000);
      return { ok: false, reason: `Cooldown for ${symbol} (${remaining} min remaining)` };
    }
    return { ok: true };
  }

  /**
   * Place a buy order
   */
  async placeBuyOrder(
    symbol: string,
    instrumentToken: number,
    signal: StrategySignal,
    currentPrice: number
  ): Promise<ExecutedOrder | null> {
    const riskCheck = this.canOpenPosition(symbol);
    if (!riskCheck.ok) {
      console.warn(`⚠️  Order rejected: ${riskCheck.reason} — ${symbol}`);
      return null;
    }

    const quantity = this.config.DEFAULT_QUANTITY;
    const slPct = this.config.STOP_LOSS_PCT;
    const targetPct = this.config.TARGET_PCT;
    const stopLoss = currentPrice * (1 - slPct / 100);
    const target = currentPrice * (1 + targetPct / 100);

    try {
      const result: any = await this.kiteClient.placeOrder('NORMAL', {
        exchange: 'NSE',
        tradingsymbol: symbol,
        transaction_type: 'BUY',
        quantity,
        product: 'MIS', // Intraday
        order_type: 'MARKET',
        validity: 'DAY',
      });

      const orderId = result.order_id;
      const order: ExecutedOrder = {
        symbol,
        instrumentToken,
        side: 'BUY',
        quantity,
        entryPrice: currentPrice,
        orderId,
        status: 'PENDING',
        stopLoss,
        target,
        timestamp: new Date(),
        strategy: signal.reason.substring(0, 30),
        reason: signal.reason,
      };

      this.executedOrders.set(orderId, order);
      this.lastOrderTime[symbol] = Date.now();

      console.log(`📤 Order placed: BUY ${symbol} ×${quantity} @ ${currentPrice.toFixed(2)} (ID: ${orderId})`);

      // Send Telegram alert
      await this.telegram.sendOrderAlert(order, 'OPEN');

      // Log to file
      TradingLogger.logOrder('open', symbol, order);

      return order;
    } catch (error: any) {
      console.error(`❌ Failed to place BUY order for ${symbol}:`, error?.message || error);
      await this.telegram.send(`❌ <b>Order Failed: ${symbol}</b>\nReason: ${error?.message || 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Close a position (sell)
   */
  async closePosition(symbol: string, reason: string, currentPrice?: number): Promise<LivePosition | null> {
    const position = this.positions.get(symbol);
    if (!position) return null;

    const exitPrice = currentPrice ?? position.currentPrice;
    const pnl = (exitPrice - position.entryPrice) * position.quantity;
    this.dailyPnl += pnl;

    try {
      const result: any = await this.kiteClient.placeOrder('NORMAL', {
        exchange: 'NSE',
        tradingsymbol: symbol,
        transaction_type: 'SELL',
        quantity: position.quantity,
        product: 'MIS',
        order_type: 'MARKET',
        validity: 'DAY',
      });

      const order: ExecutedOrder = {
        symbol,
        instrumentToken: position.instrumentToken,
        side: 'SELL',
        quantity: position.quantity,
        entryPrice: exitPrice,
        orderId: result.order_id,
        status: 'CONFIRMED',
        stopLoss: position.stopLoss,
        target: position.target,
        timestamp: new Date(),
        strategy: 'exit',
        reason,
      };

      this.executedOrders.set(order.orderId, order);
      this.lastOrderTime[symbol] = Date.now();

      // Remove from positions
      this.positions.delete(symbol);

      console.log(`📤 Position closed: ${symbol} | P&L: ₹${pnl.toFixed(2)}`);

      // Send Telegram alert
      await this.telegram.sendOrderAlert(order, 'CLOSE', pnl);

      // Log to file
      TradingLogger.logOrder('close', symbol, order, pnl);

      return { ...position, currentPrice: exitPrice, unrealizedPnl: pnl, unrealizedPct: (pnl / position.entryPrice) * 100, order };
    } catch (error: any) {
      console.error(`❌ Failed to close ${symbol}:`, error?.message || error);
      return null;
    }
  }

  /**
   * Refresh positions from Kite
   */
  async refreshPositions(): Promise<void> {
    try {
      const kitePositions: any = await this.kiteClient.getPositions();
      const positions = kitePositions.net || kitePositions.day || [];

      for (const kp of positions) {
        const pos = this.positions.get(kp.tradingsymbol);
        if (pos) {
          pos.currentPrice = kp.last_price;
          pos.unrealizedPnl = kp.unrealised || 0;
          pos.unrealizedPct = kp.m2m ? (kp.m2m / pos.entryPrice) * 100 : 0;
        }
      }
    } catch (error) {
      console.error('Error refreshing positions:', error);
    }
  }

  /**
   * Check stop loss and target for all positions
   */
  async checkExitConditions(): Promise<void> {
    const positions = Array.from(this.positions.values());

    for (const position of positions) {
      // Check stop loss
      if (position.currentPrice <= position.stopLoss) {
        console.log(`🛑 STOP LOSS hit for ${position.symbol} @ ${position.currentPrice.toFixed(2)}`);
        await this.closePosition(position.symbol, 'Stop Loss hit', position.currentPrice);
        continue;
      }

      // Check target
      if (position.currentPrice >= position.target) {
        console.log(`🎯 TARGET hit for ${position.symbol} @ ${position.currentPrice.toFixed(2)}`);
        await this.closePosition(position.symbol, 'Target hit', position.currentPrice);
      }
    }
  }

  getPositions(): LivePosition[] {
    return Array.from(this.positions.values());
  }

  getDailyPnl(): number {
    return this.dailyPnl;
  }

  getRiskMetrics() {
    const positionsArray = Array.from(this.positions.values());
    const totalExposure = positionsArray.reduce((sum: number, p: LivePosition) => sum + p.entryPrice * p.quantity, 0);
    return {
      dailyPnl: this.dailyPnl,
      dailyPnlPct: (this.dailyPnl / this.dayStartEquity) * 100,
      maxDailyLoss: this.dayStartEquity * (this.config.MAX_DAILY_LOSS_PCT / 100),
      openPositions: this.positions.size,
      totalExposure,
      marginUsed: totalExposure,
      marginAvailable: this.dayStartEquity - totalExposure,
    };
  }
}
