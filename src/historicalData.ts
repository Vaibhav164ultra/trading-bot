/**
 * Free historical data fallback (Yahoo Finance / NSE)
 * Used when Kite Connect historical data subscription is not available
 */

export interface Candle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getHistoricalDataYahoo(
  symbol: string,
  days: number = 365,
  interval: string = '1d'
): Promise<Candle[]> {
  // Map common symbols to Yahoo format
  const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;

  const endDate = Math.floor(Date.now() / 1000);
  const startDate = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=${interval}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const jsonData = await response.json() as any;
    const data = jsonData;
    const result = data.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error('Invalid data format from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const opens = quotes.open;
    const highs = quotes.high;
    const lows = quotes.low;
    const closes = quotes.close;
    const volumes = quotes.volume;

    const candles: Candle[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      // Skip null values
      if (opens[i] === null || highs[i] === null || lows[i] === null || closes[i] === null) {
        continue;
      }

      candles.push({
        timestamp: new Date(timestamps[i] * 1000),
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i] || 0,
      });
    }

    return candles;
  } catch (error) {
    console.error('Yahoo Finance fetch error:', error);
    throw error;
  }
}

export async function getHistoricalDataNSE(
  symbol: string,
  days: number = 365
): Promise<Candle[]> {
  // NSE India API (requires proper headers)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const url = `https://www.nseindia.com/api/historical/cm/equity?symbol=${symbol}&series=%22EQ%22&from=${startDate}&to=${endDate}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`NSE API error: ${response.status}`);
    }

    const jsonData = await response.json() as any;
    const data = jsonData;
    const records = data.data || [];

    const candles: Candle[] = records.map((r: any) => ({
      timestamp: new Date(r.CH_TIMESTAMP || r.CH_TIMESTAMP_IST),
      open: r.CH_OPENING_PRICE,
      high: r.CH_TRADE_HIGH_PRICE,
      low: r.CH_TRADE_LOW_PRICE,
      close: r.CH_CLOSING_PRICE,
      volume: r.CH_TOT_TRADED_QTY || 0,
    })).reverse(); // NSE returns oldest first

    return candles;
  } catch (error) {
    console.error('NSE API fetch error:', error);
    throw error;
  }
}

export async function getHistoricalData(
  kiteClient: any,
  instrumentToken: number,
  days: number,
  timeframe: string,
  fallbackSymbol?: string
): Promise<Candle[]> {
  // Try Kite Connect first
  try {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const to = new Date();

    const data = await kiteClient.getHistoricalData(instrumentToken, timeframe, from, to);
    if (data && data.length > 0) {
      return data.map((d: any) => ({
        timestamp: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }));
    }
  } catch (error: any) {
    console.log('Kite historical data failed, trying fallback...', error.message);
  }

  // Fallback to Yahoo Finance
  if (fallbackSymbol) {
    try {
      const interval = timeframe === 'day' ? '1d' :
                       timeframe === 'minute' ? '1m' :
                       timeframe === '5minute' ? '5m' : '15m';
      const candles = await getHistoricalDataYahoo(fallbackSymbol, days, interval);
      if (candles.length > 0) {
        console.log(`✅ Using Yahoo Finance fallback for ${fallbackSymbol}`);
        return candles;
      }
    } catch (error) {
      console.log('Yahoo Finance fallback failed, trying NSE...');
    }

    // Fallback to NSE
    try {
      const candles = await getHistoricalDataNSE(fallbackSymbol, days);
      if (candles.length > 0) {
        console.log(`✅ Using NSE fallback for ${fallbackSymbol}`);
        return candles;
      }
    } catch (error) {
      console.error('All data sources failed');
    }
  }

  throw new Error('No historical data available from any source');
}