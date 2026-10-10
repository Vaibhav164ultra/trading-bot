/**
 * Kite Connect API client wrapper
 */

import { KiteConnect } from 'kiteconnect';
import { getConfig } from './config.js';
import type { Candle } from './types.js';

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
    return await this.kite.getQuote(instruments);
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
    instrumentToken: number | string,
    days: number,
    interval: any = 'day'
  ): Promise<Candle[]> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const data = await this.getHistoricalData(instrumentToken, interval, from, to);
    return data.map((d: any) => ({
      timestamp: new Date(d.date),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));
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