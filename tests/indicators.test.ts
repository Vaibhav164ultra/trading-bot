import { describe, it, expect } from 'vitest';
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD, calculateAllIndicators } from '../src/indicators.js';
import type { Candle } from '../src/types.js';

// Generate test candles
function generateCandles(count: number, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 4; // -2 to +2
    price = Math.max(1, price + change);

    const open = price;
    const high = price + Math.random() * 2;
    const low = price - Math.random() * 2;
    const close = price + (Math.random() - 0.5) * 1;
    const volume = Math.floor(Math.random() * 100000) + 10000;

    candles.push({
      timestamp: new Date(now.getTime() + i * 60000),
      open,
      high,
      low,
      close: Math.max(0.01, close),
      volume,
    });
  }
  return candles;
}

describe('Technical Indicators', () => {
  const candles = generateCandles(100, 100);

  describe('SMA', () => {
    it('calculates SMA correctly', () => {
      const result = calculateSMA(candles, 20);
      expect(result.name).toBe('SMA20');
      expect(result.values.length).toBe(candles.length);

      // First 19 values should be NaN
      for (let i = 0; i < 19; i++) {
        expect(Number.isNaN(result.values[i])).toBe(true);
      }

      // 20th value should be valid
      expect(Number.isNaN(result.values[19])).toBe(false);
    });

    it('SMA matches manual calculation', () => {
      const period = 5;
      const result = calculateSMA(candles, period);

      // Manual calculation for index 5
      const manualSMA = candles.slice(1, 6).reduce((sum, c) => sum + c.close, 0) / period;
      expect(result.values[5]).toBeCloseTo(manualSMA, 5);
    });
  });

  describe('EMA', () => {
    it('calculates EMA correctly', () => {
      const result = calculateEMA(candles, 20);
      expect(result.name).toBe('EMA20');
      expect(result.values.length).toBe(candles.length);

      // First value should equal first close
      expect(result.values[0]).toBe(candles[0].close);
    });
  });

  describe('RSI', () => {
    it('calculates RSI in valid range', () => {
      const result = calculateRSI(candles, 14);
      expect(result.name).toBe('RSI14');
      expect(result.values.length).toBe(candles.length);

      // Valid RSI values should be between 0 and 100
      for (const value of result.values) {
        if (!Number.isNaN(value)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    });

    it('generates buy/sell signals', () => {
      const result = calculateRSI(candles, 14);
      expect(result.signals).toBeDefined();

      if (result.signals) {
        for (const signal of result.signals) {
          expect(['buy', 'sell', 'hold']).toContain(signal);
        }
      }
    });
  });

  describe('MACD', () => {
    it('calculates MACD components', () => {
      const result = calculateMACD(candles);
      expect(result.name).toBe('MACD');
      expect(result.values.length).toBe(candles.length);
    });
  });

  describe('calculateAllIndicators', () => {
    it('returns all standard indicators', () => {
      const result = calculateAllIndicators(candles);

      expect(result).toHaveProperty('SMA20');
      expect(result).toHaveProperty('SMA50');
      expect(result).toHaveProperty('EMA20');
      expect(result).toHaveProperty('EMA50');
      expect(result).toHaveProperty('RSI14');
      expect(result).toHaveProperty('MACD');
      expect(result).toHaveProperty('BB20');
      expect(result).toHaveProperty('ATR14');
      expect(result).toHaveProperty('STOCH14');
    });
  });
});

describe('Strategy Backtesting', () => {
  // Use a trending dataset for clearer signals
  const trendingCandles = generateCandles(200, 100);

  it('MA Crossover backtest runs without errors', async () => {
    const { MACrossoverStrategy } = await import('../src/strategies.js');
    const strategy = new MACrossoverStrategy(10, 30);
    const result = strategy.backtest(trendingCandles);

    expect(result).toHaveProperty('totalTrades');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('totalPnlPct');
    expect(result).toHaveProperty('maxDrawdownPct');
    expect(result).toHaveProperty('sharpeRatio');
    expect(result.trades).toBeInstanceOf(Array);
    expect(result.equityCurve).toBeInstanceOf(Array);
  });

  it('RSI Mean Reversion backtest runs without errors', async () => {
    const { RSIMeanReversionStrategy } = await import('../src/strategies.js');
    const strategy = new RSIMeanReversionStrategy(14, 30, 70);
    const result = strategy.backtest(trendingCandles);

    expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(100);
  });
});