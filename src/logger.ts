/**
 * Trading history logger — saves scans, signals, and trades to disk
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  type: 'scan' | 'signal' | 'trade' | 'summary';
  symbol?: string;
  data: any;
}

export class TradingLogger {
  /**
   * Append a log entry to the appropriate file
   */
  static log(entry: LogEntry): void {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${entry.type}_${date}.jsonl`;
    const filepath = path.join(LOG_DIR, filename);

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(filepath, line, 'utf8');

    // Also write to daily summary
    if (entry.type === 'signal' || entry.type === 'trade') {
      const summaryFile = path.join(LOG_DIR, 'daily_summary.json');
      let summaries: any[] = [];
      if (fs.existsSync(summaryFile)) {
        try {
          summaries = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
        } catch {}
      }
      summaries.push(entry);
      fs.writeFileSync(summaryFile, JSON.stringify(summaries, null, 2));
    }
  }

  /**
   * Save a scan result for all symbols
   */
  static async logScan(symbol: string, candles: any[], signals: any[], price: number): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'scan',
      symbol,
      data: {
        price,
        candles_count: candles.length,
        latest_candle: candles[candles.length - 1],
        signals: signals.map((s: any) => ({
          strategy: s.strategy,
          action: s.signal.action,
          strength: s.signal.strength,
          reason: s.signal.reason,
          indicators: s.signal.indicators,
        })),
      },
    };
    this.log(entry);
  }

  /**
   * Save a trade signal alert
   */
  static logSignal(symbol: string, strategy: string, signal: any, price: number): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'signal',
      symbol,
      data: {
        strategy,
        action: signal.action,
        strength: signal.strength,
        price,
        reason: signal.reason,
        indicators: signal.indicators,
      },
    };
    this.log(entry);
  }

  /**
   * Save trade execution (open/close)
   */
  static logTrade(action: 'open' | 'close', symbol: string, position: any, reason?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'trade',
      symbol,
      data: {
        action,
        position,
        reason,
      },
    };
    this.log(entry);
  }

  /**
   * Save order execution
   */
  static logOrder(action: 'open' | 'close', symbol: string, order: any, pnl?: number): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'trade',
      symbol,
      data: {
        action,
        order,
        pnl,
      },
    };
    this.log(entry);
  }

  /**
   * Save daily summary
   */
  static logDailySummary(summary: {
    date: string;
    totalScans: number;
    totalSignals: number;
    strongSignals: number;
    tradesOpen: number;
    tradesClose: number;
    pnl: number;
  }): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'summary',
      data: summary,
    };
    this.log(entry);
  }

  /**
   * Get all log entries for a date
   */
  static getLogsForDate(date: string, type?: 'scan' | 'signal' | 'trade' | 'summary'): any[] {
    const filepath = path.join(LOG_DIR, `${type ?? 'all'}_${date}.jsonl`);
    if (!fs.existsSync(filepath)) return [];

    const content = fs.readFileSync(filepath, 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  /**
   * Get all logs (last N entries)
   */
  static getRecentLogs(count: number = 50): LogEntry[] {
    const allFiles = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl'));
    const entries: LogEntry[] = [];

    for (const file of allFiles) {
      const filepath = path.join(LOG_DIR, file);
      const content = fs.readFileSync(filepath, 'utf8');
      for (const line of content.trim().split('\n')) {
        if (line.trim()) {
          try {
            entries.push(JSON.parse(line));
          } catch {}
        }
      }
    }

    // Sort by timestamp descending, return last N
    return entries.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, count);
  }

  /**
   * Get today's summary stats
   */
  static getTodayStats(): {
    date: string;
    scanCount: number;
    signalCount: number;
    tradeCount: number;
    strongSignals: Array<{ symbol: string; strategy: string; action: string; strength: number }>;
  } {
    const today = new Date().toISOString().split('T')[0];
    const scans = this.getLogsForDate(today, 'scan');
    const signals = this.getLogsForDate(today, 'signal');
    const trades = this.getLogsForDate(today, 'trade');

    return {
      date: today,
      scanCount: scans.length,
      signalCount: signals.length,
      tradeCount: trades.length,
      strongSignals: signals
        .filter(s => (s.data as any).strength >= 0.6)
        .map(s => ({
          symbol: s.symbol,
          strategy: (s.data as any).strategy,
          action: (s.data as any).action,
          strength: (s.data as any).strength,
        })),
    };
  }
}
