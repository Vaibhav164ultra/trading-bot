/**
 * Live trading bot entry point
 * Runs the bot in production mode with graceful shutdown
 */

import 'dotenv/config';
import { LiveBot } from './liveBot.js';
import { getConfig } from './config.js';
import { setBot, setExecutor, startServer } from './server.js';

async function main() {
  const config = getConfig();

  console.log('🚀 Zerodha Live Trading Bot');
  console.log(`Mode: 🔴 LIVE TRADING`);
  console.log(`Trading Mode: ${config.TRADING_MODE}`);
  console.log(`Watchlist: ${config.WATCHLIST}`);
  console.log(`Timeframe: ${config.TIMEFRAME}`);
  console.log(`Historical Days: ${config.HISTORICAL_DAYS}\n`);

  const bot = new LiveBot();
  setBot(bot);
  setExecutor(bot['executor']);

  try {
    // Initialize and start
    await bot.initialize();
    await bot.start();

    // Start HTTP API server
    try {
      startServer(config.PORT);
    } catch (e) {
      console.log('⚠️  API server failed to start (port may be in use)');
    }

    console.log('\n✅ Bot is running. Monitoring markets...\n');
    console.log('Press Ctrl+C to stop\n');

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main().catch(console.error);
