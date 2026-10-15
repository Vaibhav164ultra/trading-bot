/**
 * Configuration for Zerodha Kite Connect trading system
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Kite Connect API credentials
  KITE_API_KEY: z.string().min(1, 'KITE_API_KEY is required'),
  KITE_API_SECRET: z.string().min(1, 'KITE_API_SECRET is required'),
  KITE_ACCESS_TOKEN: z.string().optional(), // Set after login flow

  // Trading parameters
  TRADING_MODE: z.enum(['paper', 'live']).default('paper'),
  DEFAULT_QUANTITY: z.coerce.number().default(1),
  MAX_POSITIONS: z.coerce.number().default(5),

  // Risk management
  MAX_DAILY_LOSS_PCT: z.coerce.number().default(2),
  MAX_POSITION_LOSS_PCT: z.coerce.number().default(1),
  STOP_LOSS_PCT: z.coerce.number().default(0.5),
  TARGET_PCT: z.coerce.number().default(1.5),

  // Data & Analysis
  DATA_DIR: z.string().default('./data'),
  HISTORICAL_DAYS: z.coerce.number().default(365),
  TIMEFRAME: z.enum(['minute', '5minute', '15minute', '30minute', '60minute', 'day']).default('day'),

  // Server
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),

  // Live bot
  WEBSOCKET_RECONNECT_MS: z.coerce.number().default(5000),
  ORDER_TIMEOUT_MS: z.coerce.number().default(30000),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Watchlist (comma-separated symbols like "RELIANCE,INFY,TCS")
  WATCHLIST: z.string().default('RELIANCE'),

  // Scan config
  SCAN_INTERVAL_MIN: z.coerce.number().default(10), // minutes between scans
  ENABLE_EMAIL_REPORTS: z.string().default('false'),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

let _config: Env | null = null;
export function getConfig(): Env {
  if (_config) return _config;
  _config = loadConfig();
  return _config;
}