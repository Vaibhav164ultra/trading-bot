/**
 * Type definitions for Zerodha trading system
 */

// ---------------------------------------------------------------------------
// Kite Connect Types (from kiteconnect package)
// ---------------------------------------------------------------------------

export interface KiteInstrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: Date | null;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
}

export interface KiteQuote {
  instrument_token: number;
  timestamp: Date;
  last_price: number;
  last_quantity: number;
  last_trade_time: Date;
  oi: number;
  oi_day_high: number;
  oi_day_low: number;
  net_change: number;
  average_price: number;
  volume: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  change: number;
  depth: {
    buy: Array<{ quantity: number; price: number; orders: number }>;
    sell: Array<{ quantity: number; price: number; orders: number }>;
  };
}

export interface KiteHistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KiteOrderParams {
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX';
  tradingsymbol: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  product: 'CNC' | 'MIS' | 'NRML' | 'CO' | 'BO';
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  price?: number;
  trigger_price?: number;
  validity?: 'DAY' | 'IOC' | 'TTL';
  disclosed_quantity?: number;
  tag?: string;
}

export interface KiteOrderResponse {
  order_id: string;
}

export interface KiteOrder {
  order_id: string;
  exchange_order_id: string | null;
  parent_order_id: string | null;
  status: 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED' | 'AMO REQ RECEIVED' | 'TRIGGER PENDING' | 'OPEN PENDING';
  status_message: string | null;
  status_message_raw: string | null;
  order_timestamp: Date;
  exchange: string;
  tradingsymbol: string;
  transaction_type: 'BUY' | 'SELL';
  order_type: string;
  product: string;
  quantity: number;
  disclosed_quantity: number;
  price: number;
  trigger_price: number;
  average_price: number;
  filled_quantity: number;
  pending_quantity: number;
  cancelled_quantity: number;
  market_protection: number;
  tag: string | null;
  guid: string;
}

export interface KitePosition {
  instrument_token: number;
  exchange: string;
  tradingsymbol: string;
  product: string;
  quantity: number;
  overnight_quantity: number;
  multiplier: number;
  average_price: number;
  last_price: number;
  close_price: number;
  value: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buy_quantity: number;
  buy_price: number;
  buy_value: number;
  buy_m2m: number;
  sell_quantity: number;
  sell_price: number;
  sell_value: number;
  sell_m2m: number;
  day_buy_quantity: number;
  day_buy_price: number;
  day_buy_value: number;
  day_sell_quantity: number;
  day_sell_price: number;
  day_sell_value: number;
}

export interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  t1_quantity: number;
  realised_quantity: number;
  authorised_quantity: number;
  authorised_date: string | null;
  opening_quantity: number;
  collateral_quantity: number;
  collateral_type: string | null;
  haircut: number;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
}

// ---------------------------------------------------------------------------
// Strategy Types
// ---------------------------------------------------------------------------

export interface Candle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  name: string;
  values: number[];
  signals?: ('buy' | 'sell' | 'hold')[];
}

export interface StrategySignal {
  action: 'buy' | 'sell' | 'hold';
  strength: number; // 0-1
  reason: string;
  indicators: Record<string, number>;
}

export interface Strategy {
  name: string;
  description: string;
  analyze(candles: Candle[]): Promise<StrategySignal>;
  backtest(candles: Candle[]): BacktestResult;
}

export interface BacktestTrade {
  entryDate: Date;
  entryPrice: number;
  exitDate: Date | null;
  exitPrice: number | null;
  quantity: number;
  side: 'long' | 'short';
  pnl: number | null;
  pnlPct: number | null;
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equityCurve: { date: Date; equity: number }[];
}

// ---------------------------------------------------------------------------
// Trading Types
// ---------------------------------------------------------------------------

export type TradingMode = 'paper' | 'live';

export interface PaperPosition {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  target: number;
  pnl: number;
  pnlPct: number;
  entryTime: Date;
}

export interface RiskMetrics {
  dailyPnl: number;
  dailyPnlPct: number;
  maxDailyLoss: number;
  openPositions: number;
  totalExposure: number;
  marginUsed: number;
  marginAvailable: number;
}