/**
 * Paper Trading Engine - Simulates trades without real money
 */

import { getConfig } from './config.js';
import type { Candle, PaperPosition, RiskMetrics, StrategySignal, Strategy } from './types.js';
import { getKiteClient } from './kiteClient.js';

export class PaperTradingEngine {
  private config = getConfig();
  private positions: Map<string, PaperPosition> = new Map();
  private closedPositions: PaperPosition[] = [];
  private dailyPnl = 0;
  private dayStartEquity = 100000;
  private currentEquity = 100000;
  private strategy: Strategy;
  private kiteClient = getKiteClient();

  constructor(strategy: Strategy) {
    this.strategy = strategy;
  }

  async initialize(): Promise<void> {
    // Initialize day start equity
    this.dayStartEquity = this.currentEquity;
    this.dailyPnl = 0;
  }

  // -------------------------------------------------------------------
  // Market Data & Signal Generation
  // -------------------------------------------------------------------

  async analyzeSymbol(symbol: string, instrumentToken: number): Promise<StrategySignal> {
    try {
      const candles = await this.kiteClient.getHistoricalCandles(
        instrumentToken,
        this.config.HISTORICAL_DAYS,
        this.config.TIMEFRAME
      );
      return await this.strategy.analyze(candles);
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      return { action: 'hold', strength: 0, reason: 'Analysis failed', indicators: {} };
    }
  }

  // -------------------------------------------------------------------
  // Position Management
  // -------------------------------------------------------------------

  async openPosition(
    symbol: string,
    side: 'long' | 'short',
    quantity: number,
    entryPrice: number,
    stopLossPct?: number,
    targetPct?: number
  ): Promise<PaperPosition | null> {
    const maxPositions = this.config.MAX_POSITIONS;
    if (this.positions.size >= maxPositions) {
      console.log(`Max positions (${maxPositions}) reached`);
      return null;
    }

    // Check daily loss limit
    if (this.dailyPnl <= -this.dayStartEquity * (this.config.MAX_DAILY_LOSS_PCT / 100)) {
      console.log(`Daily loss limit (${this.config.MAX_DAILY_LOSS_PCT}%) reached`);
      return null;
    }

    const sl = stopLossPct ?? this.config.STOP_LOSS_PCT;
    const target = targetPct ?? this.config.TARGET_PCT;

    const stopLoss = side === 'long'
      ? entryPrice * (1 - sl / 100)
      : entryPrice * (1 + sl / 100);

    const targetPrice = side === 'long'
      ? entryPrice * (1 + target / 100)
      : entryPrice * (1 - target / 100);

    const position: PaperPosition = {
      symbol,
      side,
      quantity,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss,
      target: targetPrice,
      pnl: 0,
      pnlPct: 0,
      entryTime: new Date(),
    };

    this.positions.set(symbol, position);
    console.log(`Opened ${side} position: ${symbol} x${quantity} @ ${entryPrice} (SL: ${stopLoss.toFixed(2)}, Target: ${targetPrice.toFixed(2)})`);
    return position;
  }

  updatePosition(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (!position) return;

    position.currentPrice = currentPrice;

    if (position.side === 'long') {
      position.pnl = (currentPrice - position.entryPrice) * position.quantity;
      position.pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    } else {
      position.pnl = (position.entryPrice - currentPrice) * position.quantity;
      position.pnlPct = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    }

    // Check stop loss / target
    this.checkExitConditions(position);
  }

  private checkExitConditions(position: PaperPosition): void {
    let shouldExit = false;
    let exitReason = '';

    if (position.side === 'long') {
      if (position.currentPrice <= position.stopLoss) {
        shouldExit = true;
        exitReason = 'Stop Loss hit';
      } else if (position.currentPrice >= position.target) {
        shouldExit = true;
        exitReason = 'Target hit';
      }
    } else {
      if (position.currentPrice >= position.stopLoss) {
        shouldExit = true;
        exitReason = 'Stop Loss hit';
      } else if (position.currentPrice <= position.target) {
        shouldExit = true;
        exitReason = 'Target hit';
      }
    }

    // Check position loss limit
    if (Math.abs(position.pnlPct) >= this.config.MAX_POSITION_LOSS_PCT) {
      shouldExit = true;
      exitReason = `Position loss limit (${this.config.MAX_POSITION_LOSS_PCT}%) reached`;
    }

    if (shouldExit) {
      this.closePosition(position.symbol, exitReason);
    }
  }

  closePosition(symbol: string, reason: string = 'Manual'): PaperPosition | null {
    const position = this.positions.get(symbol);
    if (!position) return null;

    // Finalize P&L
    if (position.side === 'long') {
      position.pnl = (position.currentPrice - position.entryPrice) * position.quantity;
      position.pnlPct = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
    } else {
      position.pnl = (position.entryPrice - position.currentPrice) * position.quantity;
      position.pnlPct = ((position.entryPrice - position.currentPrice) / position.entryPrice) * 100;
    }

    this.dailyPnl += position.pnl;
    this.currentEquity += position.pnl;
    this.closedPositions.push(position);
    this.positions.delete(symbol);

    console.log(`Closed ${position.side} position: ${symbol} - ${reason} | P&L: ${position.pnl.toFixed(2)} (${position.pnlPct.toFixed(2)}%)`);
    return position;
  }

  closeAllPositions(reason: string = 'End of day'): void {
    for (const symbol of this.positions.keys()) {
      this.closePosition(symbol, reason);
    }
  }

  // -------------------------------------------------------------------
  // Risk Metrics
  // -------------------------------------------------------------------

  getRiskMetrics(): RiskMetrics {
    const openPositions = this.positions.size;
    const totalExposure = Array.from(this.positions.values())
      .reduce((sum, p) => sum + p.entryPrice * p.quantity, 0);

    return {
      dailyPnl: this.dailyPnl,
      dailyPnlPct: (this.dailyPnl / this.dayStartEquity) * 100,
      maxDailyLoss: this.dayStartEquity * (this.config.MAX_DAILY_LOSS_PCT / 100),
      openPositions,
      totalExposure,
      marginUsed: totalExposure,
      marginAvailable: this.currentEquity - totalExposure,
    };
  }

  getPositions(): PaperPosition[] {
    return Array.from(this.positions.values());
  }

  getClosedPositions(): PaperPosition[] {
    return [...this.closedPositions];
  }

  getEquity(): number {
    return this.currentEquity;
  }

  // -------------------------------------------------------------------
  // Backtest
  // -------------------------------------------------------------------

  async backtest(symbol: string, instrumentToken: number): Promise<any> {
    const candles = await this.kiteClient.getHistoricalCandles(
      instrumentToken,
      this.config.HISTORICAL_DAYS,
      this.config.TIMEFRAME
    );
    return this.strategy.backtest(candles);
  }
}