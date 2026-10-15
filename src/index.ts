/**
 * Zerodha Trading Analysis & Execution System
 * Main entry point — supports analysis, paper, and live trading modes
 */

import 'dotenv/config';
import { getConfig } from './config.js';
import { KiteClient } from './kiteClient.js';
import { getStrategy, listStrategies } from './strategies.js';
import { PaperTradingEngine } from './paperTrading.js';
import { TelegramNotifier } from './telegram.js';
import { AutoTrader } from './autoTrader.js';
import { LiveBot } from './liveBot.js';
import type { Candle, StrategySignal } from './types.js';

async function main() {
  const config = getConfig();
  const args = process.argv.slice(2);
  const mode = args[0] ?? 'paper'; // 'paper' | 'live' | 'scan'
  const isAutoMode = args.includes('--auto') || mode === 'scan';
  const isLiveMode = mode === 'live';

  console.log('🚀 Zerodha Trading System Starting...');
  console.log(`Mode: ${isLiveMode ? '🔴 LIVE TRADING' : isAutoMode ? '🔄 AUTO-SCAN' : '📊 ONE-TIME ANALYSIS'}`);
  console.log(`Timeframe: ${config.TIMEFRAME}`);
  console.log(`Historical Days: ${config.HISTORICAL_DAYS}`);
  console.log(`Watchlist: ${config.WATCHLIST}`);
  console.log(`Trading Mode: ${config.TRADING_MODE}`);

  const kiteClient = new KiteClient(config.KITE_ACCESS_TOKEN);
  const telegram = new TelegramNotifier();

  // Test Telegram connection immediately
  if (telegram.isConnected) {
    console.log('📱 Testing Telegram connection...');
    await telegram.testConnection();
    console.log('✅ Telegram test message sent! Check your bot.');
  }

  // Show login URL if no access token
  if (!config.KITE_ACCESS_TOKEN) {
    console.log('\n🔐 No access token found. Visit this URL to login:');
    console.log(kiteClient.getLoginURL());
    console.log('\nAfter login, you will be redirected with a request_token.');
    console.log('Use that to generate session: await kiteClient.generateSession(requestToken)');
    return;
  }

  if (isLiveMode) {
    // ── LIVE TRADING MODE ──────────────────────────────────────────────────
    console.log('\n🔴 LIVE TRADING MODE ENABLED');
    console.log('WebSocket + order execution active.\n');

    const bot = new LiveBot();

    // Parse watchlist
    const symbols = config.WATCHLIST.split(',').map(s => s.trim()).filter(Boolean);
    const instruments = await kiteClient.getInstruments('NSE');

    for (const symbol of symbols) {
      const instrument = instruments.find((i: any) => i.tradingsymbol === symbol);
      if (instrument) {
        await bot.addSymbol(symbol, instrument.instrument_token);
      } else {
        console.warn(`⚠️  Symbol "${symbol}" not found in NSE instruments`);
      }
    }

    if (bot['watchlist'].length === 0) {
      console.error('❌ No valid symbols in watchlist. Check WATCHLIST in .env');
      return;
    }

    await bot.initialize();
    await bot.start();

    // Keep running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping live bot...');
      bot.stop();
      process.exit(0);
    });

  } else if (isAutoMode) {
    // ── AUTO-SCAN MODE (analysis only) ─────────────────────────────────────
    console.log('\n🤖 Auto-Scan Mode Enabled');
    console.log('This will scan your watchlist every 10 minutes during market hours.');
    console.log('Press Ctrl+C to stop.\n');

    const autoTrader = new AutoTrader();

    // Parse watchlist
    const symbols = config.WATCHLIST.split(',').map(s => s.trim()).filter(Boolean);
    const instruments = await kiteClient.getInstruments('NSE');

    for (const symbol of symbols) {
      const instrument = instruments.find((i: any) => i.tradingsymbol === symbol);
      if (instrument) {
        autoTrader.addSymbol(symbol, instrument.instrument_token);
      } else {
        console.warn(`⚠️  Symbol "${symbol}" not found in NSE instruments`);
      }
    }

    if ((autoTrader as any)['watchlist'].length === 0) {
      console.error('❌ No valid symbols in watchlist. Check WATCHLIST in .env');
      return;
    }

    await autoTrader.start();

    // Keep running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping auto-trader...');
      autoTrader.stop();
      process.exit(0);
    });

  } else {
    // ── ONE-TIME ANALYSIS MODE ─────────────────────────────────────────────
    // List available strategies
    console.log('\n📊 Available Strategies:');
    for (const name of listStrategies()) {
      const strategy = getStrategy(name);
      if (strategy) {
        console.log(`  - ${name}: ${strategy.description}`);
      }
    }

    // Demo: Analyze RELIANCE
    const symbol = 'RELIANCE';
    console.log(`\n📈 Analyzing ${symbol}...`);

    try {
      const instruments = await kiteClient.getInstruments('NSE');
      const reliance = instruments.find((i: any) => i.tradingsymbol === 'RELIANCE');

      if (!reliance) {
        console.log(`Instrument ${symbol} not found`);
        return;
      }

      console.log(`Found instrument: ${reliance.tradingsymbol} (token: ${reliance.instrument_token})`);

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

        const backtest = strategy.backtest(candles);
        console.log(`    Backtest: ${backtest.totalTrades} trades, ${backtest.winRate.toFixed(1)}% win rate, ${backtest.totalPnlPct.toFixed(2)}% return, ${backtest.maxDrawdownPct.toFixed(2)}% max DD`);
      }

    } catch (error) {
      console.error('Error:', error);
    }
  }
}

main().catch(console.error);
