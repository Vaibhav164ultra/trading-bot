/**
 * Express HTTP API server for monitoring the alert-only trading bot
 */

import { LiveBot } from './liveBot.js';
import { getConfig } from './config.js';
import http from 'http';

let bot: LiveBot | null = null;

// Export functions to set bot
export function setBot(b: LiveBot): void {
  bot = b;
}

export function startServer(port: number = 3000): http.Server {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'application/json');

    const url = new URL(req.url!, `http://localhost:${port}`);
    const path = url.pathname;

    try {
      // Health check endpoint
      if (path === '/health' || path === '/') {
        const botState = bot?.isRunningState ?? false;
        const uptime = bot ? Math.floor((Date.now() - bot.botStats.startedAt.getTime()) / 1000) : 0;
        res.writeHead(200);
        res.end(JSON.stringify({
          status: botState ? 'running' : 'stopped',
          uptime: uptime,
          symbols: bot?.watchlistState.length ?? 0,
          alertsSent: bot?.botStats.alertsSent ?? 0,
          signalsFired: bot?.botStats.signalsFired ?? 0,
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // API endpoints
      if (path === '/api/status') {
        const botData = bot ? {
          isRunning: bot.isRunningState,
          stats: bot.botStats,
          watchlist: bot.watchlistState,
        } : null;
        res.writeHead(200);
        res.end(JSON.stringify({ bot: botData }));
        return;
      }

      if (path === '/api/alerts') {
        // Recent alerts summary
        res.writeHead(200);
        res.end(JSON.stringify({
          totalAlertsSent: bot?.botStats.alertsSent ?? 0,
          totalSignals: bot?.botStats.signalsFired ?? 0,
          mode: 'ALERT_ONLY',
        }));
        return;
      }

      // Not found
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found. Try /health or /api/status' }));
    } catch (error: any) {
      console.error('Server error:', error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 API server listening on http://0.0.0.0:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  });

  return server;
}
