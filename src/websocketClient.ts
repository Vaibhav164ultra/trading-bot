/**
 * Kite Connect WebSocket client for real-time market data
 * Subscribes to tokens and streams tick data
 */

import WebSocket from 'ws';
import { getConfig } from './config.js';
import type { Ticker } from './types.js';

const WSS_URL = 'wss://ws.kite.trade/';

export class KiteWebSocket {
  private config = getConfig();
  private ws: WebSocket | null = null;
  private reconnectDelay = 5000;
  private maxReconnectDelay = 60000;
  private currentDelay = 5000;
  private isConnecting = false;
  private subscribers: Set<(tick: Ticker) => void> = new Set();
  private subscribedTokens: number[] = [];
  private lastPriceCache: Map<number, Ticker> = new Map();

  onTick(callback: (tick: Ticker) => void): void {
    this.subscribers.add(callback);
  }

  offTick(callback: (tick: Ticker) => void): void {
    this.subscribers.delete(callback);
  }

  subscribe(tokens: number[]): void {
    this.subscribedTokens = [...new Set([...this.subscribedTokens, ...tokens])];
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(this.subscribedTokens);
    }
  }

  private sendSubscribe(tokens: number[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = JSON.stringify({
      type: 'subscribe',
      data: { tokens: tokens.join(','), mode: 'full' },
    });
    this.ws.send(message);
  }

  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;

    this.isConnecting = true;
    console.log('🔌 Connecting to Kite WebSocket...');

    this.ws = new WebSocket(WSS_URL);

    this.ws.on('open', () => {
      console.log('✅ WebSocket connected');
      this.isConnecting = false;
      this.currentDelay = 5000; // Reset on successful connect
      this.sendSubscribe(this.subscribedTokens);
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      this.isConnecting = false;
      this.scheduleReconnect();
    });

    this.ws.on('close', (code, reason) => {
      console.log(`⚠️  WebSocket closed (code: ${code}): ${reason.toString()}`);
      this.isConnecting = false;
      this.scheduleReconnect();
    });
  }

  private handleMessage(message: string): void {
    try {
      // Parse JSON messages
      const messages = message.trim().split('\n');
      for (const msg of messages) {
        const parsed = JSON.parse(msg);
        this.processMessage(parsed);
      }
    } catch (error) {
      // Ping/pong or invalid message - ignore
    }
  }

  private processMessage(parsed: any): void {
    const payload = parsed?.data ?? parsed;
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case 'tick':
        this.handleTick(payload.data);
        break;
      case 'order':
        this.handleOrder(payload.data);
        break;
      case 'pong':
        // Heartbeat - do nothing
        break;
    }
  }

  private handleTick(tickData: any): void {
    if (!tickData.tokens) return;

    const tokens = Array.isArray(tickData.tokens) ? tickData.tokens : [tickData.tokens];
    const prices = tickData.prices ?? {};

    for (const token of tokens) {
      const priceData = prices[token];
      if (!priceData) continue;

      const ticker: Ticker = {
        instrumentToken: token,
        lastPrice: priceData.lpp ?? priceData.price ?? priceData.last_price ?? 0,
        timestamp: new Date(),
        volume: priceData.volume ?? 0,
        open: priceData.open ?? 0,
        high: priceData.high ?? 0,
        low: priceData.low ?? 0,
        close: priceData.close ?? 0,
      };

      this.lastPriceCache.set(token, ticker);
      this.notifySubscribers(ticker);
    }
  }

  private handleOrder(orderData: any): void {
    // Order update notification - could emit event or log
    console.log('📊 Order update:', orderData);
  }

  private notifySubscribers(ticker: Ticker): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(ticker);
      } catch (error) {
        console.error('Error in tick subscriber:', error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isConnecting) return;

    console.log(`🔄 Reconnecting in ${this.currentDelay / 1000}s...`);

    setTimeout(() => {
      this.connect();
    }, this.currentDelay);

    // Exponential backoff
    this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.ws) return 'disconnected';
    if (this.ws.readyState === WebSocket.OPEN) return 'connected';
    return 'connecting';
  }

  getLastPrice(token: number): number | null {
    const ticker = this.lastPriceCache.get(token);
    return ticker?.lastPrice ?? null;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
    this.lastPriceCache.clear();
  }
}
