/**
 * Kite Connect API client wrapper
 */

import { KiteConnect } from 'kiteconnect';
import { getConfig } from './config.js';
import type { Candle } from './types.js';
import { getHistoricalData } from './historicalData.js';

export class KiteClient {
  private kite: any;
  private config = getConfig();

  constructor(accessToken?: string) {
    this.kite = new KiteConnect({
      api_key: this.config.KITE_API_KEY,
    });

    if (accessToken) {
      this.kite.setAccessToken(accessToken);
    }
  }

  getLoginURL(): string {
    return this.kite.getLoginURL();
  }

  async generateSession(requestToken: string): Promise<{ access_token: string; public_token: string }> {
    return await this.kite.generateSession(requestToken, this.config.KITE_API_SECRET);
  }

  setAccessToken(token: string): void {
    this.kite.setAccessToken(token);
  }

  // -------------------------------------------------------------------
  // Market Data
  // -------------------------------------------------------------------

  async getInstruments(exchange?: any): Promise<any[]> {
    return await this.kite.getInstruments(exchange);
  }

  async getQuote(instruments: string | string[]): Promise<any> {
    // Fallback to historical candles if getQuote permission is not active on free tier
    const token = Array.isArray(instruments) ? instruments[0] : instruments;
    const candles = await this.getHistoricalCandles(Number(token), 2, 'day');
    const latest = candles[candles.length - 1];
    return {
      [token]: {
        instrument_token: Number(token),
        last_price: latest.close,
        ohlc: { open: latest.open, high: latest.high, low: latest.low, close: latest.close },
        volume: latest.volume,
        timestamp: latest.timestamp,
      }
    };
  }

  async getOHLC(instruments: string | string[]): Promise<any> {
    return await this.kite.getOHLC(instruments);
  }

  async getHistoricalData(
    instrumentToken: number | string,
    interval: any,
    from: Date | string,
    to: Date | string,
    continuous: boolean = false,
    oi: boolean = false
  ): Promise<any[]> {
    return await this.kite.getHistoricalData(instrumentToken, interval, from, to, continuous, oi);
  }

  async getHistoricalCandles(
    instrumentToken: number,
    days: number,
    interval: any = 'day'
  ): Promise<Candle[]> {
    const config = getConfig();
    // For NSE instruments, we can map token to symbol for fallback
    const nseInstruments = await this.getInstruments('NSE');
    const instrument = nseInstruments.find((i: any) => i.instrument_token == instrumentToken);
    const fallbackSymbol = instrument?.tradingsymbol;

    return getHistoricalData(this.kite, instrumentToken, days, interval, fallbackSymbol);
  }

  // -------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------

  async placeOrder(variety: any, params: any): Promise<any> {
    return await this.kite.placeOrder(variety, params);
  }

  async modifyOrder(variety: any, orderId: string, params: any): Promise<any> {
    return await this.kite.modifyOrder(variety, orderId, params);
  }

  async cancelOrder(variety: any, orderId: string): Promise<any> {
    return await this.kite.cancelOrder(variety, orderId);
  }

  async getOrders(): Promise<any[]> {
    return await this.kite.getOrders();
  }

  async getOrderHistory(orderId: string): Promise<any[]> {
    return await this.kite.getOrderHistory(orderId);
  }

  // -------------------------------------------------------------------
  // Positions & Holdings
  // -------------------------------------------------------------------

  async getPositions(): Promise<{ net: any[]; day: any[] }> {
    return await this.kite.getPositions();
  }

  async getHoldings(): Promise<any[]> {
    return await this.kite.getHoldings();
  }

  // -------------------------------------------------------------------
  // Margins
  // -------------------------------------------------------------------

  async getMargins(): Promise<any> {
    return await this.kite.getMargins();
  }
}

let _kiteClient: KiteClient | null = null;

export function getKiteClient(accessToken?: string): KiteClient {
  if (!_kiteClient) {
    _kiteClient = new KiteClient(accessToken);
  } else if (accessToken) {
    _kiteClient.setAccessToken(accessToken);
  }
  return _kiteClient;
}