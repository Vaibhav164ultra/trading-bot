/**
 * Trading Strategies
 */

import type { Candle, Strategy, StrategySignal, BacktestResult, BacktestTrade, IndicatorResult } from './types.js';
import { calculateAllIndicators, rsi } from './indicators.js';

// ---------------------------------------------------------------------------
// Base Strategy Class
// ---------------------------------------------------------------------------

export abstract class BaseStrategy implements Strategy {
  abstract name: string;
  abstract description: string;

  abstract analyze(candles: Candle[]): Promise<StrategySignal>;

  backtest(candles: Candle[]): BacktestResult {
    const trades: BacktestTrade[] = [];
    let position: BacktestTrade | null = null;
    let equity = 100000; // Starting capital
    const equityCurve: { date: Date; equity: number }[] = [{ date: candles[0].timestamp, equity }];

    for (let i = 1; i < candles.length; i++) {
      const signal = this.generateSignal(candles.slice(0, i + 1));
      const candle = candles[i];

      // Entry logic
      if (!position && signal.action === 'buy') {
        position = {
          entryDate: candle.timestamp,
          entryPrice: candle.close,
          exitDate: null,
          exitPrice: null,
          quantity: Math.floor(equity * 0.1 / candle.close),
          side: 'long',
          pnl: null,
          pnlPct: null,
        };
      } else if (!position && signal.action === 'sell') {
        position = {
          entryDate: candle.timestamp,
          entryPrice: candle.close,
          exitDate: null,
          exitPrice: null,
          quantity: Math.floor(equity * 0.1 / candle.close),
          side: 'short',
          pnl: null,
          pnlPct: null,
        };
      }

      // Exit logic
      if (position) {
        const shouldExit =
          (position.side === 'long' && signal.action === 'sell') ||
          (position.side === 'short' && signal.action === 'buy');

        if (shouldExit || i === candles.length - 1) {
          position.exitDate = candle.timestamp;
          position.exitPrice = candle.close;
          position.pnl =
            position.side === 'long'
              ? (position.exitPrice - position.entryPrice) * position.quantity
              : (position.entryPrice - position.exitPrice) * position.quantity;
          position.pnlPct = (position.pnl / (position.entryPrice * position.quantity)) * 100;
          equity += position.pnl;
          trades.push(position);
          position = null;
        }
      }

      equityCurve.push({ date: candle.timestamp, equity });
    }

    const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0).length;
    const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalPnlPct = (totalPnl / 100000) * 100;

    // Calculate max drawdown
    let peak = equityCurve[0].equity;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    for (const point of equityCurve) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak - point.equity;
      const ddPct = (dd / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }

    // Simple Sharpe ratio (assuming risk-free rate = 0)
    const returns = equityCurve.slice(1).map((p, i) => (p.equity - equityCurve[i].equity) / equityCurve[i].equity);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev * Math.sqrt(252) : 0;

    return {
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
      totalPnl,
      totalPnlPct,
      maxDrawdown,
      maxDrawdownPct,
      sharpeRatio,
      trades,
      equityCurve,
    };
  }

  protected abstract generateSignal(candles: Candle[]): StrategySignal;
}

// ---------------------------------------------------------------------------
// Moving Average Crossover Strategy
// ---------------------------------------------------------------------------

export class MACrossoverStrategy extends BaseStrategy {
  name = 'MA Crossover';
  description = 'Buy when fast MA crosses above slow MA, sell when it crosses below';

  private fastPeriod: number;
  private slowPeriod: number;

  constructor(fastPeriod: number = 20, slowPeriod: number = 50) {
    super();
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
  }

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < this.slowPeriod + 1) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const indicators = calculateAllIndicators(candles);
    const fastMA = indicators[`SMA${this.fastPeriod}`].values;
    const slowMA = indicators[`SMA${this.slowPeriod}`].values;

    const currentFast = fastMA[fastMA.length - 1];
    const prevFast = fastMA[fastMA.length - 2];
    const currentSlow = slowMA[slowMA.length - 1];
    const prevSlow = slowMA[slowMA.length - 2];

    if (isNaN(currentFast) || isNaN(currentSlow) || isNaN(prevFast) || isNaN(prevSlow)) {
      return { action: 'hold', strength: 0, reason: 'MA values not ready', indicators: {} };
    }

    const crossedUp = prevFast <= prevSlow && currentFast > currentSlow;
    const crossedDown = prevFast >= prevSlow && currentFast < currentSlow;

    if (crossedUp) {
      return {
        action: 'buy',
        strength: 0.7,
        reason: `SMA${this.fastPeriod} crossed above SMA${this.slowPeriod}`,
        indicators: { fastMA: currentFast, slowMA: currentSlow },
      };
    } else if (crossedDown) {
      return {
        action: 'sell',
        strength: 0.7,
        reason: `SMA${this.fastPeriod} crossed below SMA${this.slowPeriod}`,
        indicators: { fastMA: currentFast, slowMA: currentSlow },
      };
    }

    return {
      action: 'hold',
      strength: 0.3,
      reason: 'No crossover',
      indicators: { fastMA: currentFast, slowMA: currentSlow },
    };
  }
}

// ---------------------------------------------------------------------------
// RSI Mean Reversion Strategy
// ---------------------------------------------------------------------------

export class RSIMeanReversionStrategy extends BaseStrategy {
  name = 'RSI Mean Reversion';
  description = 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)';

  private period: number;
  private oversold: number;
  private overbought: number;

  constructor(period: number = 14, oversold: number = 30, overbought: number = 70) {
    super();
    this.period = period;
    this.oversold = oversold;
    this.overbought = overbought;
  }

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < this.period + 1) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const indicators = calculateAllIndicators(candles);
    const rsi = indicators[`RSI${this.period}`].values;
    const currentRSI = rsi[rsi.length - 1];

    if (isNaN(currentRSI)) {
      return { action: 'hold', strength: 0, reason: 'RSI not ready', indicators: {} };
    }

    if (currentRSI < this.oversold) {
      return {
        action: 'buy',
        strength: 0.8 - currentRSI / 100,
        reason: `RSI (${currentRSI.toFixed(1)}) below oversold threshold (${this.oversold})`,
        indicators: { rsi: currentRSI },
      };
    } else if (currentRSI > this.overbought) {
      return {
        action: 'sell',
        strength: currentRSI / 100 - 0.2,
        reason: `RSI (${currentRSI.toFixed(1)}) above overbought threshold (${this.overbought})`,
        indicators: { rsi: currentRSI },
      };
    }

    return {
      action: 'hold',
      strength: 0.2,
      reason: `RSI (${currentRSI.toFixed(1)}) in neutral zone`,
      indicators: { rsi: currentRSI },
    };
  }
}

// ---------------------------------------------------------------------------
// MACD Strategy
// ---------------------------------------------------------------------------

export class MACDStrategy extends BaseStrategy {
  name = 'MACD';
  description = 'Buy on MACD bullish crossover, sell on bearish crossover';

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < 35) { // Need enough for MACD (26 slow + 9 signal)
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const indicators = calculateAllIndicators(candles);
    const macd = indicators.MACD.values;

    const current = macd[macd.length - 1];
    const prev = macd[macd.length - 2];

    if (isNaN(current) || isNaN(prev)) {
      return { action: 'hold', strength: 0, reason: 'MACD not ready', indicators: {} };
    }

    // MACD values directly represent the MACD line
    // Signal would need to be tracked separately, using histogram as proxy
    if (prev <= 0 && current > 0) {
      return {
        action: 'buy',
        strength: 0.7,
        reason: 'MACD crossed above zero (bullish)',
        indicators: { macd: current },
      };
    } else if (prev >= 0 && current < 0) {
      return {
        action: 'sell',
        strength: 0.7,
        reason: 'MACD crossed below zero (bearish)',
        indicators: { macd: current },
      };
    }

    return {
      action: 'hold',
      strength: 0.3,
      reason: `MACD ${current > 0 ? 'positive' : 'negative'}`,
      indicators: { macd: current },
    };
  }
}

// ---------------------------------------------------------------------------
// Bollinger Bands Strategy
// ---------------------------------------------------------------------------

export class BollingerBandsStrategy extends BaseStrategy {
  name = 'Bollinger Bands';
  description = 'Buy at lower band, sell at upper band (mean reversion)';

  private period: number;
  private stdDev: number;

  constructor(period: number = 20, stdDev: number = 2) {
    super();
    this.period = period;
    this.stdDev = stdDev;
  }

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < this.period + 1) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const indicators = calculateAllIndicators(candles);
    const bb = indicators[`BB${this.period}`];
    const closes = candles.map((c) => c.close);
    const currentClose = closes[closes.length - 1];

    // We need upper/lower bands - calculate them
    const { upper, middle, lower } = calculateBollingerBandsValues(closes, this.period, this.stdDev);
    const currentUpper = upper[upper.length - 1];
    const currentLower = lower[lower.length - 1];
    const currentMiddle = middle[middle.length - 1];

    if (isNaN(currentUpper) || isNaN(currentLower)) {
      return { action: 'hold', strength: 0, reason: 'Bollinger Bands not ready', indicators: {} };
    }

    const pctB = (currentClose - currentLower) / (currentUpper - currentLower);

    if (pctB <= 0) {
      return {
        action: 'buy',
        strength: 0.8,
        reason: `Price at/below lower Bollinger Band (${currentClose.toFixed(2)} <= ${currentLower.toFixed(2)})`,
        indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
      };
    } else if (pctB >= 1) {
      return {
        action: 'sell',
        strength: 0.8,
        reason: `Price at/above upper Bollinger Band (${currentClose.toFixed(2)} >= ${currentUpper.toFixed(2)})`,
        indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
      };
    }

    return {
      action: 'hold',
      strength: 0.2,
      reason: `Price within bands (${(pctB * 100).toFixed(1)}% from lower)`,
      indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
    };
  }
}

// ---------------------------------------------------------------------------
// Small-margin Strategy: Conservative RSI
// ---------------------------------------------------------------------------

export class ConservativeRSIStrategy extends BaseStrategy {
  name = 'Conservative RSI';
  description = 'Only trade when RSI is deeply oversold (>35% below 30) or overbought (>35% above 70), with extra confirmation';

  private period: number;

  constructor(period: number = 14) {
    super();
    this.period = period;
  }

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < this.period + 1) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const indicators = calculateAllIndicators(candles);
    const rsi = indicators[`RSI${this.period}`].values;
    const currentRSI = rsi[rsi.length - 1];

    if (isNaN(currentRSI)) {
      return { action: 'hold', strength: 0, reason: 'RSI not ready', indicators: {} };
    }

    // Only take very extreme signals: deeply oversold (<20) or overbought (>80)
    if (currentRSI < 20) {
      return {
        action: 'buy',
        strength: (30 - currentRSI) / 30, // 0.3 to 1.0
        reason: `RSI (${currentRSI.toFixed(1)}) deeply oversold (<20)`,
        indicators: { rsi: currentRSI },
      };
    } else if (currentRSI > 80) {
      return {
        action: 'sell',
        strength: (currentRSI - 80) / 30,
        reason: `RSI (${currentRSI.toFixed(1)}) deeply overbought (>80)`,
        indicators: { rsi: currentRSI },
      };
    }

    return {
      action: 'hold',
      strength: 0.1,
      reason: `RSI (${currentRSI.toFixed(1)}) in caution zone`,
      indicators: { rsi: currentRSI },
    };
  }
}

// ---------------------------------------------------------------------------
// Small-margin Strategy: Tight Bollinger Bands
// ---------------------------------------------------------------------------

export class TightBollingerBandsStrategy extends BaseStrategy {
  name = 'Tight BBands';
  description = 'Trade when price touches outer bands with tight squeeze — high momentum revert';

  private period: number;
  private stdDev: number;

  constructor(period: number = 20, stdDev: number = 2) {
    super();
    this.period = period;
    this.stdDev = stdDev;
  }

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < this.period + 1) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const indicators = calculateAllIndicators(candles);
    const closes = candles.map((c) => c.close);
    const currentClose = closes[closes.length - 1];

    const bb = calculateBollingerBandsValues(closes, this.period, this.stdDev);
    const currentUpper = bb.upper[bb.upper.length - 1];
    const currentLower = bb.lower[bb.lower.length - 1];

    if (isNaN(currentUpper) || isNaN(currentLower)) {
      return { action: 'hold', strength: 0, reason: 'Bollinger Bands not ready', indicators: {} };
    }

    const pctB = (currentClose - currentLower) / (currentUpper - currentLower);

    // Price at or below lower band — strong buy signal
    if (pctB <= 0) {
      return {
        action: 'buy',
        strength: 0.9,
        reason: `Price at/below lower BB (${currentClose.toFixed(2)} <= ${currentLower.toFixed(2)})`,
        indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
      };
    }
    // Price at or above upper band — strong sell signal
    else if (pctB >= 1) {
      return {
        action: 'sell',
        strength: 0.9,
        reason: `Price at/above upper BB (${currentClose.toFixed(2)} >= ${currentUpper.toFixed(2)})`,
        indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
      };
    }

    // Price within but near bands
    if (pctB < 0.1) {
      return {
        action: 'buy',
        strength: 0.6,
        reason: `Price near lower BB (${(pctB * 100).toFixed(1)}% from lower)`,
        indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
      };
    } else if (pctB > 0.9) {
      return {
        action: 'sell',
        strength: 0.6,
        reason: `Price near upper BB (${((1 - pctB) * 100).toFixed(1)}% from upper)`,
        indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
      };
    }

    return {
      action: 'hold',
      strength: 0.1,
      reason: `Price within bands (${(pctB * 100).toFixed(1)}% from lower)`,
      indicators: { close: currentClose, upper: currentUpper, lower: currentLower, pctB },
    };
  }
}

// ---------------------------------------------------------------------------
// Small-margin Strategy: Scalper (quick entries/exits)
// ---------------------------------------------------------------------------

export class ScalperStrategy extends BaseStrategy {
  name = 'Scalper';
  description = 'Very short-term — captures small moves, tight stops, quick targets';

  private rsiPeriod: number;
  private takeProfitPct: number;
  private stopLossPct: number;

  constructor(rsiPeriod: number = 7, takeProfitPct: number = 0.5, stopLossPct: number = 0.3) {
    super();
    this.rsiPeriod = rsiPeriod;
    this.takeProfitPct = takeProfitPct;
    this.stopLossPct = stopLossPct;
  }

  async analyze(candles: Candle[]): Promise<StrategySignal> {
    return this.generateSignal(candles);
  }

  protected generateSignal(candles: Candle[]): StrategySignal {
    if (candles.length < this.rsiPeriod + 1) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', indicators: {} };
    }

    const closes = candles.map(c => c.close);
    const rsiValues = rsi(closes, this.rsiPeriod);
    const currentRSI = rsiValues[rsiValues.length - 1];

    if (isNaN(currentRSI)) {
      return { action: 'hold', strength: 0, reason: 'RSI not ready', indicators: {} };
    }

    // RSI < 30 → buy with tight stops
    if (currentRSI < 30) {
      return {
        action: 'buy',
        strength: (30 - currentRSI) / 30,
        reason: `RSI ${currentRSI.toFixed(1)} oversold — scalper buy`,
        indicators: { rsi: currentRSI },
      };
    }
    // RSI > 70 → sell
    else if (currentRSI > 70) {
      return {
        action: 'sell',
        strength: (currentRSI - 70) / 30,
        reason: `RSI ${currentRSI.toFixed(1)} overbought — scalper sell`,
        indicators: { rsi: currentRSI },
      };
    }

    return {
      action: 'hold',
      strength: 0.1,
      reason: `RSI ${currentRSI.toFixed(1)} neutral - wait`,
      indicators: { rsi: currentRSI },
    };
  }
}

// Helper function for Bollinger Bands
function calculateBollingerBandsValues(values: number[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
      const sd = Math.sqrt(variance);
      upper.push(mean + stdDev * sd);
      lower.push(mean - stdDev * sd);
    }
  }

  return { upper, middle, lower };
}

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Strategy Factory
// ---------------------------------------------------------------------------

export const STRATEGIES: Record<string, () => Strategy> = {
  'ma-crossover': () => new MACrossoverStrategy(),
  'rsi-reversion': () => new RSIMeanReversionStrategy(),
  'macd': () => new MACDStrategy(),
  'bollinger-bands': () => new BollingerBandsStrategy(),
  'conservative-rsi': () => new ConservativeRSIStrategy(),
  'tight-bbands': () => new TightBollingerBandsStrategy(),
  'scalper': () => new ScalperStrategy(),
};

export function getStrategy(name: string): Strategy | null {
  const factory = STRATEGIES[name];
  return factory ? factory() : null;
}

export function listStrategies(): string[] {
  return Object.keys(STRATEGIES);
}