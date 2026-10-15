/**
 * Live trading bot entry point - ALERT ONLY MODE
 * Sends detailed, AI-like market alerts without executing trades
 */

import 'dotenv/config';
import { LiveBot } from './liveBot.js';
import { getConfig } from './config.js';
import { setBot, startServer } from './server.js';

async function main() {
  const config = getConfig();

  console.log('🚀 Zerodha Alert Bot v2.0');
  console.log(`Mode: 📱 ALERTS ONLY (No Trading)`);
  console.log(`Watchlist: ${config.WATCHLIST}`);
  console.log(`Timeframe: ${config.TIMEFRAME}`);
  console.log(`Historical Days: ${config.HISTORICAL_DAYS}\n`);

  const bot = new LiveBot();
  setBot(bot);

  try {
    // Initialize and start
    await bot.initialize();
    await bot.start();

    // Start HTTP API server on configured port
    const server = startServer(config.PORT);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down...`);
      bot.stop();
      server.close(() => {
        console.log('🛑 Server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('\n✅ Alert Bot is running!');
    console.log('📱 You will receive Telegram alerts during market hours (9:15 AM - 3:30 PM IST)');
    console.log('💡 Alerts are sent every 30 seconds with AI-like natural language\n');

  } catch (error: any) {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
