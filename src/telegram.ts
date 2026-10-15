/**
 * Telegram notification module for trading alerts
 * Includes rate limiting to avoid Telegram API limits
 */

import { Bot } from 'node-telegram-bot-api/node';
import { getConfig } from './config.js';
import type { StrategySignal, PaperPosition } from './types.js';
import type { ExecutedOrder } from './liveOrderExecutor.js';

export class TelegramNotifier {
  private bot: Bot | null = null;
  private config = getConfig();
  private chatId: string | null = null;
  private lastSendTime = 0;
  private readonly MIN_DELAY_MS = 2000; // Minimum 2 seconds between messages

  constructor() {
    const token = this.config.TELEGRAM_BOT_TOKEN;
    const chatId = this.config.TELEGRAM_CHAT_ID;

    if (!token) {
      console.log('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled');
      return;
    }

    if (!chatId) {
      console.log('⚠️  TELEGRAM_CHAT_ID not set — Telegram notifications disabled');
      return;
    }

    try {
      this.bot = new Bot(token, {});
      this.chatId = chatId;
      console.log('✅ Telegram notifier initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error);
    }
  }

  /**
   * Send a message to Telegram with rate limiting
   */
  async send(text: string, parseMode: 'HTML' | 'Markdown' | undefined = 'HTML'): Promise<void> {
    if (!this.bot || !this.chatId) return;

    // Check rate limit
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;

    if (timeSinceLastSend < this.MIN_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_DELAY_MS - timeSinceLastSend));
    }

    try {
      await this.bot.api.sendMessage({
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
      });
      this.lastSendTime = Date.now();
    } catch (error: any) {
      // Handle Telegram rate limits gracefully
      if (error.code === 429 && error.parameters) {
        const retryAfter = error.parameters.retry_after || 5;
        console.warn(`⚠️  Telegram rate limit hit. Waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        // Try again once after waiting
        try {
          await this.bot.api.sendMessage({
            chat_id: this.chatId,
            text,
            parse_mode: parseMode,
          });
        } catch (retryError) {
          console.error('❌ Failed to send Telegram message after retry:', retryError);
        }
      } else {
        console.error('❌ Failed to send Telegram message:', error.message || error);
      }
    }
  }

  /**
   * Send a trade signal alert
   */
  async sendSignalAlert(
    symbol: string,
    strategy: string,
    signal: StrategySignal,
    currentPrice: number,
    candlesCount: number
  ): Promise<void> {
    const emoji = signal.action === 'buy' ? '🟢' : signal.action === 'sell' ? '🔴' : '⚪';
    const strength = Math.round(signal.strength * 100);
    const actionText = signal.action === 'buy' ? 'BUY' : signal.action === 'sell' ? 'SELL' : 'HOLD';

    const indicators = Object.entries(signal.indicators)
      .map(([k, v]) => typeof v === 'number' ? `${k}: <b>${v.toFixed(2)}</b>` : `${k}: ${v}`)
      .join('\n');

    const message = `
${emoji} <b>Signal: ${symbol}</b>
Strategy: <code>${strategy}</code>
Action: <b>${actionText}</b> (${strength}% strength)
Price: <b>₹${currentPrice.toFixed(2)}</b>
Reason: ${signal.reason}

${indicators ? '<i>' + indicators + '</i>' : ''}

📊 Candles analyzed: ${candlesCount}
⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
`.trim();

    await this.send(message);
  }

  /**
   * Send a position open notification
   */
  async sendPositionOpen(position: PaperPosition): Promise<void> {
    const emoji = position.side === 'long' ? '📈' : '📉';
    const message = `
${emoji} <b>Position Opened: ${position.symbol}</b>
Side: <b>${position.side.toUpperCase()}</b>
Qty: <code>${position.quantity}</code>
Entry: <b>₹${position.entryPrice.toFixed(2)}</b>
Stop Loss: <b>₹${position.stopLoss.toFixed(2)}</b>
Target: <b>₹${position.target.toFixed(2)}</b>

💰 P&L so far: ₹${position.pnl.toFixed(2)} (${position.pnlPct.toFixed(2)}%)
⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
`.trim();
    await this.send(message);
  }

  /**
   * Send a position close notification
   */
  async sendPositionClose(position: PaperPosition, reason: string): Promise<void> {
    const emoji = position.pnl >= 0 ? '✅' : '❌';
    const message = `
${emoji} <b>Position Closed: ${position.symbol}</b>
Side: <b>${position.side.toUpperCase()}</b>
Exit: <b>₹${position.currentPrice.toFixed(2)}</b>
P&L: <b>₹${position.pnl.toFixed(2)}</b> (<code>${position.pnlPct.toFixed(2)}%</code>)
Reason: ${reason}

⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
`.trim();
    await this.send(message);
  }

  /**
   * Send daily summary report
   */
  async sendDailySummary(dailyPnl: number, winRate: number, totalTrades: number): Promise<void> {
    const emoji = dailyPnl >= 0 ? '🟢' : '🔴';
    const message = `
${emoji} <b>Daily Summary</b>
P&L: <b>₹${dailyPnl.toFixed(2)}</b>
Win Rate: <b>${winRate.toFixed(1)}%</b>
Total Trades: <code>${totalTrades}</code>

⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
`.trim();
    await this.send(message);
  }

  /**
   * Send order execution confirmation
   */
  async sendOrderConfirm(order: ExecutedOrder, action: 'OPEN' | 'CLOSE', pnl?: number): Promise<void> {
    const emoji = order.side === 'BUY' ? '🟢' : '🔴';
    const pnlText = pnl !== undefined ? `\nP&L: ${pnl >= 0 ? '✅' : '❌'} ₹${pnl.toFixed(2)}` : '';
    const message = `
${emoji} <b>Order ${action}: ${order.symbol}</b>
Side: <b>${order.side}</b> | Qty: <code>${order.quantity}</code>
Price: <b>₹${order.entryPrice.toFixed(2)}</b>
Stop Loss: <b>₹${order.stopLoss.toFixed(2)}</b> | Target: <b>₹${order.target.toFixed(2)}</b>
${pnlText}

⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
`.trim();
    await this.send(message);
  }

  /**
   * Send order alert (alias for sendOrderConfirm)
   */
  async sendOrderAlert(order: ExecutedOrder, action: 'OPEN' | 'CLOSE', pnl?: number): Promise<void> {
    return this.sendOrderConfirm(order, action, pnl);
  }

  /**
   * Get the bot token for verification
   */
  get isConnected(): boolean {
    return this.bot !== null;
  }

  /**
   * Test connection by sending a ping
   */
  async testConnection(): Promise<boolean> {
    if (!this.bot || !this.chatId) return false;
    try {
      await this.send('🔔 <b>Trading System Online</b>\nYou will receive trade alerts here.');
      return true;
    } catch {
      return false;
    }
  }
}
