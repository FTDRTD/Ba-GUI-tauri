import { preferences } from '$lib/stores/cache';
import { RSI, MACD, SMA, BollingerBands, Stochastic, EMA } from 'technicalindicators';

// 技术指标配置
interface IndicatorConfig {
  rsi: { period: number; overbought: number; oversold: number };
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
  bb: { period: number; stdDev: number };
  stoch: { period: number; signalPeriod: number; overbought: number; oversold: number };
  ema: { shortPeriod: number; longPeriod: number };
}

// 交易信号类型
type SignalType = 'buy' | 'sell' | 'strong_buy' | 'strong_sell' | null;

// 交易信号接口
interface TradingSignal {
  type: SignalType;
  symbol: string;
  timestamp: number;
  price: number;
  indicators: {
    rsi: number;
    macd: { MACD: number; signal: number; histogram: number };
    bb: { upper: number; middle: number; lower: number };
    stoch: { k: number; d: number };
    ema: { short: number; long: number };
  };
  reasons: string[];
}

// 默认指标配置
const defaultConfig: IndicatorConfig = {
  rsi: { period: 14, overbought: 70, oversold: 30 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bb: { period: 20, stdDev: 2 },
  stoch: { period: 14, signalPeriod: 3, overbought: 80, oversold: 20 },
  ema: { shortPeriod: 9, longPeriod: 21 }
};

class TradingMonitor {
  private config: IndicatorConfig;
  private monitoredPairs: Set<string> = new Set();
  private signals: Map<string, TradingSignal[]> = new Map();
  private lastUpdate: Map<string, number> = new Map();
  private updateInterval: number = 60000; // 1分钟更新一次
  private signalCallback: ((signal: TradingSignal) => void) | null = null;

  constructor(config: Partial<IndicatorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.init();
  }

  private init() {
    // 从preferences加载收藏的交易对
    preferences.subscribe(prefs => {
      this.monitoredPairs = new Set(prefs.favorites);
      // 开始监控新的交易对
      this.monitoredPairs.forEach(symbol => {
        if (!this.lastUpdate.has(symbol)) {
          this.startMonitoring(symbol);
        }
      });
    });

    // 定期更新所有监控的交易对
    setInterval(() => {
      this.monitoredPairs.forEach(symbol => {
        this.updatePair(symbol);
      });
    }, this.updateInterval);
  }

  // 开始监控交易对
  private async startMonitoring(symbol: string) {
    await this.updatePair(symbol);
    this.lastUpdate.set(symbol, Date.now());
  }

  // 更新交易对数据
  private async updatePair(symbol: string) {
    try {
      // 获取K线数据
      const klines = await this.fetchKlines(symbol);
      if (!klines || klines.length < 100) return; // 确保有足够的数据

      // 计算技术指标
      const indicators = this.calculateIndicators(klines);
      
      // 生成交易信号
      const signal = this.generateSignal(symbol, klines[klines.length - 1], indicators);
      
      if (signal) {
        // 存储信号
        if (!this.signals.has(symbol)) {
          this.signals.set(symbol, []);
        }
        this.signals.get(symbol)!.push(signal);
        
        // 保留最近100个信号
        if (this.signals.get(symbol)!.length > 100) {
          this.signals.get(symbol)!.shift();
        }

        // 触发回调
        if (this.signalCallback) {
          this.signalCallback(signal);
        }
      }

      this.lastUpdate.set(symbol, Date.now());
    } catch (error) {
      console.error(`更新交易对 ${symbol} 失败:`, error);
    }
  }

  // 获取K线数据
  private async fetchKlines(symbol: string) {
    try {
      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`
      );
      const data = await response.json();
      return data.map((candle: any[]) => ({
        time: candle[0],
        open: Number(candle[1]),
        high: Number(candle[2]),
        low: Number(candle[3]),
        close: Number(candle[4]),
        volume: Number(candle[5])
      }));
    } catch (error) {
      console.error(`获取K线数据失败:`, error);
      return null;
    }
  }

  // 计算技术指标
  private calculateIndicators(klines: any[]) {
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);

    // RSI
    const rsi = RSI.calculate({
      values: closes,
      period: this.config.rsi.period
    });

    // MACD
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: this.config.macd.fastPeriod,
      slowPeriod: this.config.macd.slowPeriod,
      signalPeriod: this.config.macd.signalPeriod
    });

    // Bollinger Bands
    const bb = BollingerBands.calculate({
      values: closes,
      period: this.config.bb.period,
      stdDev: this.config.bb.stdDev
    });

    // Stochastic
    const stoch = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: this.config.stoch.period,
      signalPeriod: this.config.stoch.signalPeriod
    });

    // EMA
    const emaShort = EMA.calculate({
      values: closes,
      period: this.config.ema.shortPeriod
    });
    const emaLong = EMA.calculate({
      values: closes,
      period: this.config.ema.longPeriod
    });

    return {
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      bb: bb[bb.length - 1],
      stoch: stoch[stoch.length - 1],
      ema: {
        short: emaShort[emaShort.length - 1],
        long: emaLong[emaLong.length - 1]
      }
    };
  }

  // 生成交易信号
  private generateSignal(symbol: string, lastCandle: any, indicators: any): TradingSignal | null {
    const reasons: string[] = [];
    let signalType: SignalType = null;

    // RSI 超买超卖
    if (indicators.rsi <= this.config.rsi.oversold) {
      reasons.push(`RSI超卖 (${indicators.rsi.toFixed(2)})`);
      signalType = 'buy';
    } else if (indicators.rsi >= this.config.rsi.overbought) {
      reasons.push(`RSI超买 (${indicators.rsi.toFixed(2)})`);
      signalType = 'sell';
    }

    // MACD 金叉死叉
    if (indicators.macd.histogram > 0 && indicators.macd.MACD > indicators.macd.signal) {
      reasons.push('MACD金叉');
      if (signalType === 'buy') signalType = 'strong_buy';
    } else if (indicators.macd.histogram < 0 && indicators.macd.MACD < indicators.macd.signal) {
      reasons.push('MACD死叉');
      if (signalType === 'sell') signalType = 'strong_sell';
    }

    // 布林带突破
    if (lastCandle.close <= indicators.bb.lower) {
      reasons.push('价格触及布林带下轨');
      if (signalType === 'buy') signalType = 'strong_buy';
    } else if (lastCandle.close >= indicators.bb.upper) {
      reasons.push('价格触及布林带上轨');
      if (signalType === 'sell') signalType = 'strong_sell';
    }

    // 随机指标
    if (indicators.stoch.k <= this.config.stoch.oversold && indicators.stoch.d <= this.config.stoch.oversold) {
      reasons.push('随机指标超卖');
      if (signalType === 'buy') signalType = 'strong_buy';
    } else if (indicators.stoch.k >= this.config.stoch.overbought && indicators.stoch.d >= this.config.stoch.overbought) {
      reasons.push('随机指标超买');
      if (signalType === 'sell') signalType = 'strong_sell';
    }

    // EMA 交叉
    if (indicators.ema.short > indicators.ema.long) {
      reasons.push('EMA短期线上穿长期线');
      if (signalType === 'buy') signalType = 'strong_buy';
    } else if (indicators.ema.short < indicators.ema.long) {
      reasons.push('EMA短期线下穿长期线');
      if (signalType === 'sell') signalType = 'strong_sell';
    }

    // 只有当有足够的理由时才生成信号
    if (signalType && reasons.length >= 2) {
      return {
        type: signalType,
        symbol,
        timestamp: Date.now(),
        price: lastCandle.close,
        indicators,
        reasons
      };
    }

    return null;
  }

  // 设置信号回调
  public onSignal(callback: (signal: TradingSignal) => void) {
    this.signalCallback = callback;
  }

  // 获取交易对的最近信号
  public getRecentSignals(symbol: string, count: number = 10): TradingSignal[] {
    return this.signals.get(symbol)?.slice(-count) || [];
  }

  // 获取所有监控的交易对
  public getMonitoredPairs(): string[] {
    return Array.from(this.monitoredPairs);
  }

  // 获取交易对的最后更新时间
  public getLastUpdate(symbol: string): number | undefined {
    return this.lastUpdate.get(symbol);
  }
}

// 导出单例实例
export const tradingMonitor = new TradingMonitor(); 