/**
 * Zerodha Trading Analysis & Execution System
 * Main entry point
 */

import 'dotenv/config';
import { getConfig } from './config.js';
import { KiteClient } from './kiteClient.js';
import { getStrategy, listStrategies } from './strategies.js';
import { PaperTradingEngine } from './paperTrading.js';
import type { Candle, StrategySignal } from './types.js';

async function main() {
  const config = getConfig();
  console.log('🚀 Zerodha Trading System Starting...');
  console.log(`Mode: ${config.TRADING_MODE}`);
  console.log(`Timeframe: ${config.TIMEFRAME}`);
  console.log(`Historical Days: ${config.HISTORICAL_DAYS}`);

  const kiteClient = new KiteClient(config.KITE_ACCESS_TOKEN);

  // Show login URL if no access token
  if (!config.KITE_ACCESS_TOKEN) {
    console.log('\n🔐 No access token found. Visit this URL to login:');
    console.log(kiteClient.getLoginURL());
    console.log('\nAfter login, you will be redirected with a request_token.');
    console.log('Use that to generate session: await kiteClient.generateSession(requestToken)');
    return;
  }

  // List available strategies
  console.log('\n📊 Available Strategies:');
  for (const name of listStrategies()) {
    const strategy = getStrategy(name);
    if (strategy) {
      console.log(`  - ${name}: ${strategy.description}`);
    }
  }

  // Demo: Analyze a symbol
  const symbol = 'RELIANCE';
  console.log(`\n📈 Analyzing ${symbol}...`);

  try {
    // Get instrument token for RELIANCE (this would typically come from instruments list)
    const instruments = await kiteClient.getInstruments('NSE');
    const reliance = instruments.find((i) => i.tradingsymbol === 'RELIANCE');

    if (!reliance) {
      console.log(`Instrument ${symbol} not found`);
      return;
    }

    console.log(`Found instrument: ${reliance.tradingsymbol} (token: ${reliance.instrument_token})`);

    // Get historical candles
    const candles = await kiteClient.getHistoricalCandles(
      reliance.instrument_token,
      config.HISTORICAL_DAYS,
      config.TIMEFRAME
    );

    console.log(`Retrieved ${candles.length} candles`);

    // Test each strategy
    for (const name of listStrategies()) {
      const strategy = getStrategy(name);
      if (!strategy) continue;

      const signal = await strategy.analyze(candles);
      console.log(`\n  ${name}:`);
      console.log(`    Action: ${signal.action.toUpperCase()}`);
      console.log(`    Strength: ${(signal.strength * 100).toFixed(0)}%`);
      console.log(`    Reason: ${signal.reason}`);
      console.log(`    Indicators:`, signal.indicators);

      // Run backtest
      const backtest = strategy.backtest(candles);
      console.log(`    Backtest: ${backtest.totalTrades} trades, ${backtest.winRate.toFixed(1)}% win rate, ${backtest.totalPnlPct.toFixed(2)}% return, ${backtest.maxDrawdownPct.toFixed(2)}% max DD`);
    }

    // Paper trading demo
    console.log('\n📝 Paper Trading Demo:');
    const paperEngine = new PaperTradingEngine(getStrategy('ma-crossover')!);
    await paperEngine.initialize();

    // Simulate a trade
    const signal = await paperEngine.analyzeSymbol('RELIANCE', reliance.instrument_token);
    console.log(`Signal: ${signal.action} (${(signal.strength * 100).toFixed(0)}%)`);

    if (signal.action === 'buy') {
      await paperEngine.openPosition('RELIANCE', 'long', 10, candles[candles.length - 1].close);
    }

    console.log('\nRisk Metrics:', paperEngine.getRiskMetrics());
    console.log('Positions:', paperEngine.getPositions());

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);