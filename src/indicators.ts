/**
 * Technical Indicators for strategy analysis
 */

import type { Candle, IndicatorResult } from './types.js';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

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

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  let emaValue = NaN;

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      emaValue = values[i];
    } else if (!isNaN(emaValue)) {
      emaValue = (values[i] - emaValue) * multiplier + emaValue;
    }
    result.push(emaValue);
  }
  return result;
}

export function rsi(values: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else if (i === period) {
      const rs = avgGain / (avgLoss || 0.0001);
      result.push(100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
      const rs = avgGain / (avgLoss || 0.0001);
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

function macd(
  values: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(values, fastPeriod);
  const slowEma = ema(values, slowPeriod);

  const macdLine = fastEma.map((f, i) => (isNaN(f) || isNaN(slowEma[i]) ? NaN : f - slowEma[i]));
  const signalLine = ema(macdLine.filter((v) => !isNaN(v)), signalPeriod);

  // Pad signal line to match length
  const paddedSignal = [...Array(macdLine.length - signalLine.length).fill(NaN), ...signalLine];
  const histogram = macdLine.map((m, i) => (isNaN(m) || isNaN(paddedSignal[i]) ? NaN : m - paddedSignal[i]));

  return { macd: macdLine, signal: paddedSignal, histogram };
}

function bollingerBands(values: number[], period: number = 20, stdDev: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
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

function atr(candles: Candle[], period: number = 14): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
    } else {
      const prevClose = candles[i - 1].close;
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevClose),
        Math.abs(candles[i].low - prevClose)
      );
      trueRanges.push(tr);
    }
  }

  // Simple moving average of true ranges
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }

  return result;
}

function stoch(candles: Candle[], period: number = 14): { k: number[]; d: number[] } {
  const k: number[] = [];
  const d: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      k.push(NaN);
      d.push(NaN);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const high = Math.max(...slice.map((c) => c.high));
      const low = Math.min(...slice.map((c) => c.low));
      const close = candles[i].close;
      const kVal = ((close - low) / (high - low)) * 100;
      k.push(kVal);
    }
  }

  // D is SMA of K
  for (let i = 0; i < k.length; i++) {
    if (i < 2) { // 3-period SMA
      d.push(NaN);
    } else {
      const sum = k.slice(i - 2, i + 1).reduce((a, b) => (isNaN(a) ? 0 : a) + (isNaN(b) ? 0 : b), 0);
      const valid = k.slice(i - 2, i + 1).filter((v) => !isNaN(v)).length;
      d.push(valid > 0 ? sum / valid : NaN);
    }
  }

  return { k, d };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function calculateSMA(candles: Candle[], period: number = 20): IndicatorResult {
  const closes = candles.map((c) => c.close);
  return { name: `SMA${period}`, values: sma(closes, period) };
}

export function calculateEMA(candles: Candle[], period: number = 20): IndicatorResult {
  const closes = candles.map((c) => c.close);
  return { name: `EMA${period}`, values: ema(closes, period) };
}

export function calculateRSI(candles: Candle[], period: number = 14): IndicatorResult {
  const closes = candles.map((c) => c.close);
  const values = rsi(closes, period);
  const signals = values.map((v) => (v > 70 ? 'sell' : v < 30 ? 'buy' : 'hold'));
  return { name: `RSI${period}`, values, signals: signals as ('buy' | 'sell' | 'hold')[] };
}

export function calculateMACD(candles: Candle[]): IndicatorResult {
  const closes = candles.map((c) => c.close);
  const { macd: macdLine, signal, histogram } = macd(closes);
  return { name: 'MACD', values: macdLine, signals: histogram.map((h) => (h > 0 ? 'buy' : h < 0 ? 'sell' : 'hold')) };
}

export function calculateBollingerBands(candles: Candle[], period: number = 20): IndicatorResult {
  const closes = candles.map((c) => c.close);
  const { upper, middle, lower } = bollingerBands(closes, period);
  return { name: `BB${period}`, values: middle };
}

export function calculateATR(candles: Candle[], period: number = 14): IndicatorResult {
  return { name: `ATR${period}`, values: atr(candles, period) };
}

export function calculateStochastic(candles: Candle[], period: number = 14): IndicatorResult {
  const { k, d } = stoch(candles, period);
  const signals = k.map((v, i) => (v > 80 ? 'sell' : v < 20 ? 'buy' : 'hold'));
  return { name: `STOCH${period}`, values: k, signals: signals as ('buy' | 'sell' | 'hold')[] };
}

export function calculateAllIndicators(candles: Candle[]): Record<string, IndicatorResult> {
  return {
    SMA10: calculateSMA(candles, 10),
    SMA20: calculateSMA(candles, 20),
    SMA30: calculateSMA(candles, 30),
    SMA50: calculateSMA(candles, 50),
    SMA100: calculateSMA(candles, 100),
    SMA200: calculateSMA(candles, 200),
    EMA10: calculateEMA(candles, 10),
    EMA20: calculateEMA(candles, 20),
    EMA50: calculateEMA(candles, 50),
    EMA100: calculateEMA(candles, 100),
    EMA200: calculateEMA(candles, 200),
    RSI14: calculateRSI(candles, 14),
    MACD: calculateMACD(candles),
    BB20: calculateBollingerBands(candles, 20),
    ATR14: calculateATR(candles, 14),
    STOCH14: calculateStochastic(candles, 14),
  };
}