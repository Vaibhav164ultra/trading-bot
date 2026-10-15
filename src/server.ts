/**
 * Express HTTP API server for monitoring the live trading bot
 */

import { LiveBot } from './liveBot.js';
import { LiveOrderExecutor } from './liveOrderExecutor.js';
import { getConfig } from './config.js';

let bot: LiveBot | null = null;
let executor: LiveOrderExecutor | null = null;

// Simple in-memory store for HTTP server (no external dependencies needed)
const routes: Map<string, (req: any, res: any) => void> = new Map();

function getBot(): LiveBot {
  if (!bot) throw new Error('Bot not initialized');
  return bot;
}

function getExecutor(): LiveOrderExecutor {
  if (!executor) throw new Error('Executor not initialized');
  return executor;
}

// Export functions to set bot and executor
export function setBot(b: LiveBot): void {
  bot = b;
}

export function setExecutor(e: LiveOrderExecutor): void {
  executor = e;
}

// HTTP server using built-in http module
import http from 'http';

export function startServer(port: number = 3000): void {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    // Simple routing
    if (req.method === 'GET' && path === '/health') {
      const bot = getBot();
      res.writeHead(200);
      res.end(JSON.stringify({
        status: bot.isRunningState ? 'running' : 'stopped',
        uptime: Math.floor((Date.now() - bot.botStats.startedAt.getTime()) / 1000),
        symbols: bot.watchlistState.length,
      }));
    }
    else if (req.method === 'GET' && path === '/api/status') {
      const bot = getBot();
      const executor = getExecutor();
      res.writeHead(200);
      res.end(JSON.stringify({
        bot: {
          isRunning: bot.isRunningState,
          stats: bot.botStats,
          watchlist: bot.watchlistState,
        },
        positions: executor.getPositions(),
        risk: executor.getRiskMetrics(),
      }));
    }
    else if (req.method === 'GET' && path === '/api/positions') {
      const executor = getExecutor();
      res.writeHead(200);
      res.end(JSON.stringify(executor.getPositions()));
    }
    else if (req.method === 'GET' && path === '/api/risk') {
      const executor = getExecutor();
      res.writeHead(200);
      res.end(JSON.stringify(executor.getRiskMetrics()));
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(port, () => {
    console.log(`🌐 API server listening on http://localhost:${port}`);
  });
}
