<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { format } from 'date-fns';
  import { cacheDB } from '$lib/stores/cache';

  // 添加技术指标相关类型
  interface TechnicalIndicators {
    rsi: number;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
    };
    volumeProfile: {
      buyVolume: number;
      sellVolume: number;
      netVolume: number;
    };
    supportResistance: {
      support: number[];
      resistance: number[];
    };
  }

  interface TradingSignal {
    type: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    reason: string;
    confidence: number;
    priceTarget?: {
      entry: number;
      stopLoss: number;
      takeProfit: number;
    };
  }

  // 添加历史成交记录接口
  interface HistoricalTrade {
    id: number;
    price: string;
    qty: string;
    quoteQty: string;
    time: number;
    isBuyerMaker: boolean;
  }

  // 添加聚合成交记录接口
  interface AggregateTrade {
    a: number;      // 聚合成交ID
    p: string;      // 成交价格
    q: string;      // 成交数量
    f: number;      // 第一笔成交ID
    l: number;      // 最后一笔成交ID
    T: number;      // 成交时间
    m: boolean;     // 是否是买方发起的成交
  }

  // 添加未平仓合约数据接口
  interface OpenInterest {
    openInterest: string;  // 未平仓合约数量
    symbol: string;        // 交易对
    time: number;         // 时间戳
  }

  // 添加市场深度分析接口
  interface MarketDepthAnalysis {
    bidAskRatio: number;          // 买卖盘比例
    bidAskVolumeRatio: number;    // 买卖盘量比
    pressureIndex: number;        // 压力指数
    liquidityScore: number;       // 流动性评分
    spreadPercentage: number;     // 价差百分比
  }

  export let selectedSymbol: string;
  export let key: number = 0;
  export let isCollapsed: boolean = false;

  const dispatch = createEventDispatcher();

  let ws: WebSocket;
  let orderBook: { bids: [number, number][]; asks: [number, number][] } = { bids: [], asks: [] };
  let viewMode = 'list'; // 'list' or 'visual'
  let maxVolume = 0;
  let isLoading = false;
  let error: string | null = null;

  // 监听主题变化
  let isDarkMode = true;
  
  // 更新主题配置
  function updateThemeConfig() {
    const isDark = document.documentElement.classList.contains('light-mode') ? false : true;
    isDarkMode = isDark;
  }

  // 添加大户数据相关变量
  let longShortPositionRatio: any = null;
  let longShortAccountRatio: any = null;
  let ratioUpdateTime: number = 0;
  let ratioPeriod = '1h'; // 默认1小时周期

  // 获取大户持仓量多空比
  async function fetchLongShortPositionRatio() {
    try {
      const response = await fetch(
        `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${selectedSymbol}&period=${ratioPeriod}&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        longShortPositionRatio = data[0];
        ratioUpdateTime = Date.now();
      }
    } catch (err) {
      console.error('获取大户持仓量多空比失败:', err);
    }
  }

  // 获取大户账户数多空比
  async function fetchLongShortAccountRatio() {
    try {
      const response = await fetch(
        `https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${selectedSymbol}&period=${ratioPeriod}&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        longShortAccountRatio = data[0];
        ratioUpdateTime = Date.now();
      }
    } catch (err) {
      console.error('获取大户账户数多空比失败:', err);
    }
  }

  // 更新大户数据
  async function updateRatioData() {
    await Promise.all([
      fetchLongShortPositionRatio(),
      fetchLongShortAccountRatio()
    ]);
  }

  // 监听交易对变化时更新大户数据
  $: if (selectedSymbol) {
    updateRatioData();
  }

  // Taker Buy/Sell Volume 相关状态
  let takerData: {
    buySellRatio: number;
    buyVol: number;
    sellVol: number;
    timestamp: number;
  }[] = [];
  let selectedPeriod = '1h';
  let takerIndicators = {
    ratioMA: 0,
    volumeMA: 0,
    buyPressure: 0,
    sellPressure: 0
  };

  const periods = [
    { value: '5m', label: '5分钟' },
    { value: '15m', label: '15分钟' },
    { value: '30m', label: '30分钟' },
    { value: '1h', label: '1小时' },
    { value: '2h', label: '2小时' },
    { value: '4h', label: '4小时' },
    { value: '6h', label: '6小时' },
    { value: '12h', label: '12小时' },
    { value: '1d', label: '1天' }
  ];

  // 获取 Taker Buy/Sell Volume 数据
  async function fetchTakerData() {
    try {
      const response = await fetch(
        `https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${selectedSymbol}&period=${selectedPeriod}&limit=30`
      );
      const data = await response.json();
      takerData = data.map((item: any) => ({
        buySellRatio: parseFloat(item.buySellRatio),
        buyVol: parseFloat(item.buyVol),
        sellVol: parseFloat(item.sellVol),
        timestamp: item.timestamp
      }));
      calculateTakerIndicators();
    } catch (err) {
      console.error('获取 Taker 数据失败:', err);
    }
  }

  // 计算 Taker 指标
  function calculateTakerIndicators() {
    if (takerData.length < 2) return;

    // 计算比率移动平均
    const ratios = takerData.map(d => d.buySellRatio);
    takerIndicators.ratioMA = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    // 计算成交量移动平均
    const volumes = takerData.map(d => d.buyVol + d.sellVol);
    takerIndicators.volumeMA = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    // 计算买卖压力
    const recentData = takerData.slice(-5);
    const buyPressure = recentData.reduce((sum, d) => sum + d.buyVol, 0);
    const sellPressure = recentData.reduce((sum, d) => sum + d.sellVol, 0);
    takerIndicators.buyPressure = buyPressure / (buyPressure + sellPressure);
    takerIndicators.sellPressure = sellPressure / (buyPressure + sellPressure);
  }

  // 获取买卖压力状态
  function getPressureStatus() {
    if (takerIndicators.buyPressure > 0.6) return 'strong_buy';
    if (takerIndicators.buyPressure > 0.55) return 'buy';
    if (takerIndicators.sellPressure > 0.6) return 'strong_sell';
    if (takerIndicators.sellPressure > 0.55) return 'sell';
    return 'neutral';
  }

  // 获取压力状态的中文描述
  function getPressureStatusText(status: string) {
    switch (status) {
      case 'strong_buy': return '强烈买入';
      case 'buy': return '买入';
      case 'strong_sell': return '强烈卖出';
      case 'sell': return '卖出';
      default: return '中性';
    }
  }

  // 格式化时间
  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 监听主题变化
  onMount(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => updateThemeConfig();
    darkModeMediaQuery.addEventListener('change', updateTheme);
    updateThemeConfig();

    connectWebSocket();
    loadOrderBook();
    updateRatioData();
    fetchTakerData();

    // 添加大户数据定时更新
    const ratioUpdateInterval = setInterval(updateRatioData, 60000); // 每分钟更新一次
    
    // 定期更新 Taker 数据
    const takerUpdateInterval = setInterval(fetchTakerData, 60000); // 每分钟更新一次
    
    return () => {
      if (ws) ws.close();
      darkModeMediaQuery.removeEventListener('change', updateTheme);
      clearInterval(ratioUpdateInterval);
      clearInterval(takerUpdateInterval);
    };
  });

  function connectWebSocket() {
    if (ws) {
      ws.close();
    }
    
    ws = new WebSocket(`wss://fstream.binance.com/ws/${selectedSymbol.toLowerCase()}@depth@100ms`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      orderBook = {
        bids: data.b.map(([price, quantity]: [string, string]) => [parseFloat(price), parseFloat(quantity)]),
        asks: data.a.map(([price, quantity]: [string, string]) => [parseFloat(price), parseFloat(quantity)])
      };

      // 计算最大交易量用于可视化
      maxVolume = Math.max(
        ...orderBook.bids.map(([_, q]) => q),
        ...orderBook.asks.map(([_, q]) => q)
      );

      // 异步更新缓存
      cacheDB.storeOrderBook(selectedSymbol, orderBook).catch(console.error);
    };
  }

  // 格式化价格
  function formatPrice(price: number): string {
    return price.toFixed(2);
  }

  // 格式化数量
  function formatQuantity(quantity: number): string {
    return quantity.toFixed(4);
  }

  // 计算价格变化百分比
  function calculatePriceChange(price: number, referencePrice: number): number {
    return ((price - referencePrice) / referencePrice) * 100;
  }

  // 切换视图模式
  function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'visual' : 'list';
  }

  // 监听 selectedSymbol 变化
  $: if (selectedSymbol) {
    // 当交易对改变时重新加载数据
    loadOrderBook();
  }

  async function loadOrderBook() {
    try {
      // 尝试从缓存加载数据
      const cachedOrderBook = await cacheDB.getLatestOrderBook(selectedSymbol);
      if (cachedOrderBook) {
        orderBook = cachedOrderBook;
        maxVolume = Math.max(
          ...orderBook.bids.map(([_, q]) => q),
          ...orderBook.asks.map(([_, q]) => q)
        );
      }

      // 连接WebSocket获取实时数据
      connectWebSocket();
      
      // 通知父组件数据已更新
      dispatch('update');
    } catch (error) {
      console.error('加载订单簿数据失败:', error);
    }
  }

  // 监听周期变化
  $: if (selectedPeriod) {
    fetchTakerData();
  }

  // 添加技术指标状态
  let indicators: TechnicalIndicators = {
    rsi: 0,
    macd: { macd: 0, signal: 0, histogram: 0 },
    bollinger: { upper: 0, middle: 0, lower: 0 },
    volumeProfile: { buyVolume: 0, sellVolume: 0, netVolume: 0 },
    supportResistance: { support: [], resistance: [] }
  };

  let tradingSignals: TradingSignal[] = [];
  let selectedTimeframe = '1h';

  // 计算技术指标
  async function calculateIndicators() {
    try {
      // 获取K线数据
      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${selectedSymbol}&interval=${selectedTimeframe}&limit=100`
      );
      const klines = await response.json();
      
      // 计算RSI
      const rsi = calculateRSI(klines.map((k: any) => parseFloat(k[4])));
      
      // 计算MACD
      const macd = calculateMACD(klines.map((k: any) => parseFloat(k[4])));
      
      // 计算布林带
      const bollinger = calculateBollingerBands(klines.map((k: any) => parseFloat(k[4])));
      
      // 计算成交量分布
      const volumeProfile = calculateVolumeProfile(klines);
      
      // 计算支撑阻力位
      const supportResistance = calculateSupportResistance(klines);
      
      indicators = {
        rsi,
        macd,
        bollinger,
        volumeProfile,
        supportResistance
      };

      // 生成交易信号
      generateTradingSignals();
    } catch (err) {
      console.error('计算技术指标失败:', err);
      error = '计算技术指标失败';
    }
  }

  // RSI计算
  function calculateRSI(prices: number[], period = 14): number {
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < period + 1; i++) {
      const difference = prices[prices.length - i] - prices[prices.length - i - 1];
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // MACD计算
  function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = calculateEMA([macd], 9);
    return { macd, signal, histogram: macd - signal };
  }

  // EMA计算
  function calculateEMA(prices: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  // 布林带计算
  function calculateBollingerBands(prices: number[], period = 20, stdDev = 2): { upper: number; middle: number; lower: number } {
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = prices.slice(-period).map(price => Math.pow(price - sma, 2));
    const standardDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  // 成交量分布计算
  function calculateVolumeProfile(klines: any[]): { buyVolume: number; sellVolume: number; netVolume: number } {
    const recentKlines = klines.slice(-20);
    let buyVolume = 0;
    let sellVolume = 0;
    
    recentKlines.forEach((k: any) => {
      const volume = parseFloat(k[5]);
      if (parseFloat(k[4]) > parseFloat(k[1])) {
        buyVolume += volume;
      } else {
        sellVolume += volume;
      }
    });
    
    return {
      buyVolume,
      sellVolume,
      netVolume: buyVolume - sellVolume
    };
  }

  // 支撑阻力位计算
  function calculateSupportResistance(klines: any[]): { support: number[]; resistance: number[] } {
    const prices = klines.map((k: any) => parseFloat(k[4]));
    const support: number[] = [];
    const resistance: number[] = [];
    
    // 简单的支撑阻力位识别算法
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i-1] && prices[i] < prices[i-2] && 
          prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
        support.push(prices[i]);
      }
      if (prices[i] > prices[i-1] && prices[i] > prices[i-2] && 
          prices[i] > prices[i+1] && prices[i] > prices[i+2]) {
        resistance.push(prices[i]);
      }
    }
    
    return {
      support: support.slice(-3),
      resistance: resistance.slice(-3)
    };
  }

  // 生成交易信号
  function generateTradingSignals() {
    const signals: TradingSignal[] = [];
    const currentPrice = orderBook.bids[0]?.[0] || 0;
    
    // RSI信号
    if (indicators.rsi < 30) {
      signals.push({
        type: 'strong_buy',
        reason: 'RSI超卖',
        confidence: 0.8,
        priceTarget: {
          entry: currentPrice,
          stopLoss: currentPrice * 0.98,
          takeProfit: currentPrice * 1.05
        }
      });
    } else if (indicators.rsi > 70) {
      signals.push({
        type: 'strong_sell',
        reason: 'RSI超买',
        confidence: 0.8,
        priceTarget: {
          entry: currentPrice,
          stopLoss: currentPrice * 1.02,
          takeProfit: currentPrice * 0.95
        }
      });
    }
    
    // MACD信号
    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
      signals.push({
        type: 'buy',
        reason: 'MACD金叉',
        confidence: 0.7
      });
    } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
      signals.push({
        type: 'sell',
        reason: 'MACD死叉',
        confidence: 0.7
      });
    }
    
    // 布林带信号
    if (currentPrice < indicators.bollinger.lower) {
      signals.push({
        type: 'buy',
        reason: '价格触及布林带下轨',
        confidence: 0.6
      });
    } else if (currentPrice > indicators.bollinger.upper) {
      signals.push({
        type: 'sell',
        reason: '价格触及布林带上轨',
        confidence: 0.6
      });
    }
    
    // 成交量信号
    if (indicators.volumeProfile.netVolume > 0 && indicators.volumeProfile.buyVolume > indicators.volumeProfile.sellVolume * 1.5) {
      signals.push({
        type: 'buy',
        reason: '成交量显著放大且以买入为主',
        confidence: 0.75
      });
    } else if (indicators.volumeProfile.netVolume < 0 && indicators.volumeProfile.sellVolume > indicators.volumeProfile.buyVolume * 1.5) {
      signals.push({
        type: 'sell',
        reason: '成交量显著放大且以卖出为主',
        confidence: 0.75
      });
    }
    
    tradingSignals = signals;
  }

  // 获取信号类型的中文描述
  function getSignalTypeText(type: string): string {
    switch (type) {
      case 'strong_buy': return '强烈买入';
      case 'buy': return '买入';
      case 'neutral': return '中性';
      case 'sell': return '卖出';
      case 'strong_sell': return '强烈卖出';
      default: return type;
    }
  }

  // 获取信号类型的样式类
  function getSignalTypeClass(type: string): string {
    switch (type) {
      case 'strong_buy': return 'signal-strong-buy';
      case 'buy': return 'signal-buy';
      case 'neutral': return 'signal-neutral';
      case 'sell': return 'signal-sell';
      case 'strong_sell': return 'signal-strong-sell';
      default: return '';
    }
  }

  // 监听交易对和时间周期变化
  $: if (selectedSymbol && selectedTimeframe) {
    calculateIndicators();
  }

  // 定期更新指标
  onMount(() => {
    const updateInterval = setInterval(calculateIndicators, 60000); // 每分钟更新一次
    return () => clearInterval(updateInterval);
  });

  // 添加历史成交记录状态
  let historicalTrades: HistoricalTrade[] = [];
  let isLoadingTrades = false;
  let tradeError: string | null = null;
  let lastTradeId: number | null = null;
  let showHistoricalTrades = false;

  // 添加 API Key 相关状态
  let apiKey: string | null = null;

  // 从环境变量或配置中获取 API Key
  onMount(async () => {
    try {
      // 这里应该从您的配置或环境变量中获取 API Key
      // 为了安全起见，建议使用环境变量或配置文件
      apiKey = import.meta.env.VITE_BINANCE_API_KEY || '';
    } catch (err) {
      console.error('获取 API Key 失败:', err);
    }
  });

  // 修改获取历史成交记录函数
  async function fetchHistoricalTrades(limit: number = 100) {
    try {
      if (!apiKey) {
        throw new Error('未配置 API Key，无法获取历史成交记录');
      }

      isLoadingTrades = true;
      tradeError = null;
      
      const url = new URL('https://fapi.binance.com/fapi/v1/historicalTrades');
      url.searchParams.append('symbol', selectedSymbol);
      url.searchParams.append('limit', limit.toString());
      if (lastTradeId) {
        url.searchParams.append('fromId', lastTradeId.toString());
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-MBX-APIKEY': apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 401) {
          throw new Error('API Key 无效或未授权');
        }
        throw new Error(
          errorData?.msg || 
          `获取历史成交记录失败: ${response.status} ${response.statusText}`
        );
      }

      const trades = await response.json();
      if (!Array.isArray(trades)) {
        throw new Error('返回数据格式错误');
      }

      if (trades.length > 0) {
        // 按时间倒序排序
        trades.sort((a, b) => b.time - a.time);
        historicalTrades = trades;
        lastTradeId = trades[0].id;
      } else {
        console.log('没有新的历史成交记录');
      }
    } catch (err) {
      console.error('获取历史成交记录失败:', err);
      if (err instanceof Error) {
        if (err.message.includes('API Key')) {
          tradeError = 'API Key 配置错误，请检查配置';
        } else if (err.message.includes('Invalid symbol')) {
          tradeError = '无效的交易对';
        } else if (err.message.includes('Too many requests')) {
          tradeError = '请求过于频繁，请稍后再试';
        } else if (err.message.includes('Service unavailable')) {
          tradeError = '服务暂时不可用，请稍后再试';
        } else {
          tradeError = err.message;
        }
      } else {
        tradeError = '获取历史成交记录失败，请稍后重试';
      }
    } finally {
      isLoadingTrades = false;
    }
  }

  // 修改历史成交记录面板的显示逻辑
  $: if (selectedSymbol && showHistoricalTrades) {
    if (apiKey) {
      fetchHistoricalTrades();
    } else {
      tradeError = '未配置 API Key，无法获取历史成交记录';
    }
  }

  // 格式化成交时间
  function formatTradeTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // 计算成交金额
  function calculateTradeAmount(price: string, qty: string): string {
    return (parseFloat(price) * parseFloat(qty)).toFixed(2);
  }

  // 添加聚合成交记录状态
  let aggregateTrades: AggregateTrade[] = [];
  let isLoadingAggTrades = false;
  let aggTradeError: string | null = null;
  let lastAggTradeId: number | null = null;
  let showAggregateTrades = false;
  let tradeViewMode: 'historical' | 'aggregate' = 'aggregate'; // 添加视图模式切换

  // 获取聚合成交记录
  async function fetchAggregateTrades(limit: number = 500) {
    try {
      isLoadingAggTrades = true;
      aggTradeError = null;
      
      const url = new URL('https://fapi.binance.com/fapi/v1/aggTrades');
      url.searchParams.append('symbol', selectedSymbol);
      url.searchParams.append('limit', limit.toString());
      if (lastAggTradeId) {
        url.searchParams.append('fromId', lastAggTradeId.toString());
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.msg || 
          `获取聚合成交记录失败: ${response.status} ${response.statusText}`
        );
      }

      const trades = await response.json();
      if (!Array.isArray(trades)) {
        throw new Error('返回数据格式错误');
      }

      if (trades.length > 0) {
        // 按时间倒序排序
        trades.sort((a, b) => b.T - a.T);
        aggregateTrades = trades;
        lastAggTradeId = trades[0].a;
      } else {
        console.log('没有新的聚合成交记录');
      }
    } catch (err) {
      console.error('获取聚合成交记录失败:', err);
      if (err instanceof Error) {
        if (err.message.includes('Invalid symbol')) {
          aggTradeError = '无效的交易对';
        } else if (err.message.includes('Too many requests')) {
          aggTradeError = '请求过于频繁，请稍后再试';
        } else if (err.message.includes('Service unavailable')) {
          aggTradeError = '服务暂时不可用，请稍后再试';
        } else {
          aggTradeError = err.message;
        }
      } else {
        aggTradeError = '获取聚合成交记录失败，请稍后重试';
      }
      
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setTimeout(() => {
          if (showAggregateTrades) {
            fetchAggregateTrades();
          }
        }, 5000);
      }
    } finally {
      isLoadingAggTrades = false;
    }
  }

  // 计算聚合成交金额
  function calculateAggTradeAmount(price: string, qty: string): string {
    return (parseFloat(price) * parseFloat(qty)).toFixed(2);
  }

  // 监听交易对变化时更新聚合成交记录
  $: if (selectedSymbol && showAggregateTrades) {
    fetchAggregateTrades();
  }

  // 定期更新聚合成交记录
  onMount(() => {
    const updateInterval = setInterval(() => {
      if (showAggregateTrades) {
        fetchAggregateTrades();
      }
    }, 15000); // 15秒更新一次
    
    return () => clearInterval(updateInterval);
  });

  // 未平仓合约数据
  let openInterest: OpenInterest | null = null;
  let isLoadingOpenInterest = false;
  let openInterestError: string | null = null;
  let openInterestHistory: { time: number; value: number }[] = [];
  let openInterestChange: number = 0;

  // 市场深度分析
  let marketDepth: MarketDepthAnalysis = {
    bidAskRatio: 0,
    bidAskVolumeRatio: 0,
    pressureIndex: 0,
    liquidityScore: 0,
    spreadPercentage: 0
  };

  // 获取未平仓合约数据
  async function fetchOpenInterest() {
    try {
      isLoadingOpenInterest = true;
      openInterestError = null;

      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/openInterest?symbol=${selectedSymbol}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`获取未平仓合约数据失败: ${response.statusText}`);
      }

      const data = await response.json();
      if (openInterest) {
        // 计算变化率
        const oldValue = parseFloat(openInterest.openInterest);
        const newValue = parseFloat(data.openInterest);
        openInterestChange = ((newValue - oldValue) / oldValue) * 100;
      }
      
      openInterest = data;
      
      // 更新历史数据
      openInterestHistory.push({
        time: data.time,
        value: parseFloat(data.openInterest)
      });
      
      // 只保留最近100个数据点
      if (openInterestHistory.length > 100) {
        openInterestHistory.shift();
      }

      // 更新市场深度分析
      updateMarketDepthAnalysis();
    } catch (err) {
      console.error('获取未平仓合约数据失败:', err);
      openInterestError = err instanceof Error ? err.message : '获取未平仓合约数据失败';
    } finally {
      isLoadingOpenInterest = false;
    }
  }

  // 更新市场深度分析
  function updateMarketDepthAnalysis() {
    if (!orderBook.bids.length || !orderBook.asks.length) return;

    // 计算买卖盘比例
    const bidVolume = orderBook.bids.reduce((sum, [_, qty]) => sum + qty, 0);
    const askVolume = orderBook.asks.reduce((sum, [_, qty]) => sum + qty, 0);
    marketDepth.bidAskVolumeRatio = bidVolume / askVolume;

    // 计算压力指数 (基于价格和数量)
    const bidPressure = orderBook.bids.reduce((sum, [price, qty]) => sum + (price * qty), 0);
    const askPressure = orderBook.asks.reduce((sum, [price, qty]) => sum + (price * qty), 0);
    marketDepth.pressureIndex = bidPressure / askPressure;

    // 计算流动性评分 (基于深度和价差)
    const bestBid = orderBook.bids[0][0];
    const bestAsk = orderBook.asks[0][0];
    const midPrice = (bestBid + bestAsk) / 2;
    marketDepth.spreadPercentage = ((bestAsk - bestBid) / midPrice) * 100;

    // 计算流动性评分 (0-100)
    const depthScore = Math.min(100, (bidVolume + askVolume) / 1000);
    const spreadScore = Math.max(0, 100 - marketDepth.spreadPercentage * 10);
    marketDepth.liquidityScore = (depthScore + spreadScore) / 2;

    // 计算买卖盘比例
    marketDepth.bidAskRatio = bidVolume / (bidVolume + askVolume);
  }

  // 监听交易对变化时更新数据
  $: if (selectedSymbol) {
    fetchOpenInterest();
  }

  // 定期更新数据
  onMount(() => {
    const updateInterval = setInterval(() => {
      if (showAggregateTrades) {
        fetchAggregateTrades();
      }
      fetchOpenInterest();
    }, 15000); // 15秒更新一次
    
    return () => clearInterval(updateInterval);
  });

  // 获取市场状态描述
  function getMarketStatus(): { status: string; description: string; color: string } {
    if (!openInterest || !marketDepth) {
      return { status: '未知', description: '数据不足', color: 'neutral' };
    }

    const oiChange = openInterestChange;
    const pressure = marketDepth.pressureIndex;
    const liquidity = marketDepth.liquidityScore;
    const spread = marketDepth.spreadPercentage;

    // 市场状态判断
    if (oiChange > 5 && pressure > 1.2 && liquidity > 70) {
      return {
        status: '强势上涨',
        description: '未平仓量显著增加，买方压力大，流动性充足',
        color: 'strong_buy'
      };
    } else if (oiChange < -5 && pressure < 0.8 && liquidity > 70) {
      return {
        status: '强势下跌',
        description: '未平仓量显著减少，卖方压力大，流动性充足',
        color: 'strong_sell'
      };
    } else if (oiChange > 2 && pressure > 1.1) {
      return {
        status: '看涨',
        description: '未平仓量增加，买方略占优势',
        color: 'buy'
      };
    } else if (oiChange < -2 && pressure < 0.9) {
      return {
        status: '看跌',
        description: '未平仓量减少，卖方略占优势',
        color: 'sell'
      };
    } else if (spread > 0.5) {
      return {
        status: '低流动性',
        description: '价差较大，市场流动性不足',
        color: 'neutral'
      };
    } else {
      return {
        status: '盘整',
        description: '市场处于盘整状态，无明显方向',
        color: 'neutral'
      };
    }
  }
</script>

<div class="order-book" class:collapsed={isCollapsed}>
  <div class="header">
    <div class="header-main">
      <h3>订单簿</h3>
      <div class="controls">
        <select bind:value={selectedPeriod} class="period-select">
          {#each periods as period}
            <option value={period.value}>{period.label}</option>
          {/each}
        </select>
        <button 
          class="view-toggle" 
          on:click={() => viewMode = viewMode === 'list' ? 'chart' : 'list'}
        >
          {viewMode === 'list' ? '图表' : '列表'}
        </button>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">加载中...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="taker-analysis">
      <div class="taker-header">
        <h4>Taker 分析</h4>
        <div class="pressure-status {getPressureStatus()}">
          {getPressureStatusText(getPressureStatus())}
        </div>
      </div>
      <div class="taker-indicators">
        <div class="indicator">
          <span class="label">买卖比率 MA:</span>
          <span class="value {takerIndicators.ratioMA > 1.1 ? 'buy' : takerIndicators.ratioMA < 0.9 ? 'sell' : ''}">
            {takerIndicators.ratioMA.toFixed(2)}
          </span>
        </div>
        <div class="indicator">
          <span class="label">成交量 MA:</span>
          <span class="value">
            {takerIndicators.volumeMA.toFixed(2)}
          </span>
        </div>
        <div class="indicator">
          <span class="label">买入压力:</span>
          <span class="value {takerIndicators.buyPressure > 0.6 ? 'strong_buy' : takerIndicators.buyPressure > 0.55 ? 'buy' : ''}">
            {(takerIndicators.buyPressure * 100).toFixed(1)}%
          </span>
        </div>
        <div class="indicator">
          <span class="label">卖出压力:</span>
          <span class="value {takerIndicators.sellPressure > 0.6 ? 'strong_sell' : takerIndicators.sellPressure > 0.55 ? 'sell' : ''}">
            {(takerIndicators.sellPressure * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div class="taker-history">
        <div class="history-header">
          <span>时间</span>
          <span>买卖比率</span>
          <span>买入量</span>
          <span>卖出量</span>
        </div>
        {#each takerData.slice(0, 5) as data}
          <div class="history-item">
            <span class="time">{formatTime(data.timestamp)}</span>
            <span class="ratio {data.buySellRatio > 1.1 ? 'buy' : data.buySellRatio < 0.9 ? 'sell' : ''}">
              {data.buySellRatio.toFixed(2)}
            </span>
            <span class="volume buy">{data.buyVol.toFixed(2)}</span>
            <span class="volume sell">{data.sellVol.toFixed(2)}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="book-container" class:list={viewMode === 'list'} class:visual={viewMode === 'visual'}>
      <!-- 添加大户数据展示区域 -->
      <div class="ratio-data">
        <div class="ratio-group">
          <div class="ratio-title">大户持仓量多空比</div>
          {#if longShortPositionRatio}
            <div class="ratio-content">
              <div class="ratio-item">
                <span class="label">多空比:</span>
                <span class="value {parseFloat(longShortPositionRatio.longShortRatio) > 1 ? 'long' : 'short'}">
                  {parseFloat(longShortPositionRatio.longShortRatio).toFixed(4)}
                </span>
              </div>
              <div class="ratio-item">
                <span class="label">多仓占比:</span>
                <span class="value long">
                  {(parseFloat(longShortPositionRatio.longAccount) * 100).toFixed(2)}%
                </span>
              </div>
              <div class="ratio-item">
                <span class="label">空仓占比:</span>
                <span class="value short">
                  {(parseFloat(longShortPositionRatio.shortAccount) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          {:else}
            <div class="loading">加载中...</div>
          {/if}
        </div>

        <div class="ratio-group">
          <div class="ratio-title">大户账户数多空比</div>
          {#if longShortAccountRatio}
            <div class="ratio-content">
              <div class="ratio-item">
                <span class="label">多空比:</span>
                <span class="value {parseFloat(longShortAccountRatio.longShortRatio) > 1 ? 'long' : 'short'}">
                  {parseFloat(longShortAccountRatio.longShortRatio).toFixed(4)}
                </span>
              </div>
              <div class="ratio-item">
                <span class="label">多仓账户:</span>
                <span class="value long">
                  {(parseFloat(longShortAccountRatio.longAccount) * 100).toFixed(2)}%
                </span>
              </div>
              <div class="ratio-item">
                <span class="label">空仓账户:</span>
                <span class="value short">
                  {(parseFloat(longShortAccountRatio.shortAccount) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          {:else}
            <div class="loading">加载中...</div>
          {/if}
        </div>
      </div>

      {#if viewMode === 'list'}
        <div class="book-container list">
          <div class="asks">
            <div class="header">
              <span>价格</span>
              <span>数量</span>
            </div>
            {#each orderBook.asks.slice(0, 10) as [price, quantity]}
              <div class="row ask">
                <span class="price">{formatPrice(price)}</span>
                <span class="quantity">{formatQuantity(quantity)}</span>
              </div>
            {/each}
          </div>
          <div class="bids">
            <div class="header">
              <span>价格</span>
              <span>数量</span>
            </div>
            {#each orderBook.bids.slice(0, 10) as [price, quantity]}
              <div class="row bid">
                <span class="price">{formatPrice(price)}</span>
                <span class="quantity">{formatQuantity(quantity)}</span>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="book-container visual">
          <div class="asks">
            {#each orderBook.asks.slice(0, 10) as [price, quantity]}
              <div class="bar ask" style="width: {(quantity / maxVolume) * 100}%">
                <span class="price">{formatPrice(price)}</span>
                <span class="quantity">{formatQuantity(quantity)}</span>
              </div>
            {/each}
          </div>
          <div class="bids">
            {#each orderBook.bids.slice(0, 10) as [price, quantity]}
              <div class="bar bid" style="width: {(quantity / maxVolume) * 100}%">
                <span class="price">{formatPrice(price)}</span>
                <span class="quantity">{formatQuantity(quantity)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- 修改成交记录面板，只保留聚合成交记录 -->
    <div class="market-analysis">
      <div class="panel-header">
        <h3>市场分析</h3>
        <div class="controls">
          <button 
            class="toggle-button" 
            on:click={() => showAggregateTrades = !showAggregateTrades}
          >
            {showAggregateTrades ? '隐藏' : '显示'}
          </button>
          {#if showAggregateTrades}
            <button 
              class="refresh-button" 
              on:click={() => {
                fetchAggregateTrades();
                fetchOpenInterest();
              }}
              disabled={isLoadingAggTrades || isLoadingOpenInterest}
            >
              刷新
            </button>
          {/if}
        </div>
      </div>

      {#if showAggregateTrades}
        <!-- 市场状态卡片 -->
        <div class="market-status-card {getMarketStatus().color}">
          <div class="status-header">
            <h4>市场状态</h4>
            <span class="status-badge">{getMarketStatus().status}</span>
          </div>
          <div class="status-description">
            {getMarketStatus().description}
          </div>
        </div>

        <!-- 未平仓合约数据 -->
        <div class="open-interest-card">
          <div class="card-header">
            <h4>未平仓合约</h4>
            {#if isLoadingOpenInterest}
              <div class="loading-spinner small"></div>
            {/if}
          </div>
          {#if openInterestError}
            <div class="error-message">{openInterestError}</div>
          {:else if openInterest}
            <div class="oi-content">
              <div class="oi-value">
                {parseFloat(openInterest.openInterest).toLocaleString()}
                <span class="oi-change {openInterestChange >= 0 ? 'positive' : 'negative'}">
                  {openInterestChange >= 0 ? '+' : ''}{openInterestChange.toFixed(2)}%
                </span>
              </div>
              <div class="oi-time">
                更新时间: {formatTime(openInterest.time)}
              </div>
            </div>
          {/if}
        </div>

        <!-- 市场深度分析 -->
        <div class="market-depth-card">
          <div class="card-header">
            <h4>市场深度分析</h4>
          </div>
          <div class="depth-metrics">
            <div class="metric">
              <span class="label">买卖压力比</span>
              <span class="value {marketDepth.pressureIndex > 1.1 ? 'buy' : marketDepth.pressureIndex < 0.9 ? 'sell' : ''}">
                {marketDepth.pressureIndex.toFixed(2)}
              </span>
            </div>
            <div class="metric">
              <span class="label">流动性评分</span>
              <span class="value {marketDepth.liquidityScore > 70 ? 'good' : marketDepth.liquidityScore < 30 ? 'poor' : ''}">
                {marketDepth.liquidityScore.toFixed(0)}
              </span>
            </div>
            <div class="metric">
              <span class="label">价差百分比</span>
              <span class="value {marketDepth.spreadPercentage < 0.1 ? 'good' : marketDepth.spreadPercentage > 0.5 ? 'poor' : ''}">
                {marketDepth.spreadPercentage.toFixed(3)}%
              </span>
            </div>
          </div>
        </div>

        <!-- 聚合成交记录表格 -->
        <div class="trades-table">
          <div class="trades-header">
            <span>时间</span>
            <span>价格</span>
            <span>数量</span>
            <span>成交额</span>
            <span>方向</span>
            <span>成交ID</span>
          </div>
          {#each aggregateTrades as trade}
            <div class="trade-row {trade.m ? 'sell' : 'buy'}">
              <span class="time">{formatTradeTime(trade.T)}</span>
              <span class="price">{parseFloat(trade.p).toFixed(2)}</span>
              <span class="quantity">{parseFloat(trade.q).toFixed(4)}</span>
              <span class="amount">{calculateAggTradeAmount(trade.p, trade.q)}</span>
              <span class="direction">
                {trade.m ? '卖出' : '买入'}
              </span>
              <span class="trade-id">{trade.a}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 技术分析面板 -->
    <div class="technical-analysis">
      <div class="panel-header">
        <h3>技术分析</h3>
        <select bind:value={selectedTimeframe} class="timeframe-select">
          <option value="5m">5分钟</option>
          <option value="15m">15分钟</option>
          <option value="1h">1小时</option>
          <option value="4h">4小时</option>
          <option value="1d">日线</option>
        </select>
      </div>

      <div class="indicators-grid">
        <div class="indicator-card">
          <h4>RSI (14)</h4>
          <div class="indicator-value {indicators.rsi < 30 ? 'oversold' : indicators.rsi > 70 ? 'overbought' : ''}">
            {indicators.rsi.toFixed(2)}
          </div>
          <div class="indicator-description">
            {indicators.rsi < 30 ? '超卖' : indicators.rsi > 70 ? '超买' : '中性'}
          </div>
        </div>

        <div class="indicator-card">
          <h4>MACD</h4>
          <div class="macd-values">
            <div>MACD: {indicators.macd.macd.toFixed(2)}</div>
            <div>Signal: {indicators.macd.signal.toFixed(2)}</div>
            <div class="histogram {indicators.macd.histogram > 0 ? 'positive' : 'negative'}">
              Hist: {indicators.macd.histogram.toFixed(2)}
            </div>
          </div>
        </div>

        <div class="indicator-card">
          <h4>布林带</h4>
          <div class="bollinger-values">
            <div>上轨: {indicators.bollinger.upper.toFixed(2)}</div>
            <div>中轨: {indicators.bollinger.middle.toFixed(2)}</div>
            <div>下轨: {indicators.bollinger.lower.toFixed(2)}</div>
          </div>
        </div>

        <div class="indicator-card">
          <h4>成交量分析</h4>
          <div class="volume-analysis">
            <div>买入量: {indicators.volumeProfile.buyVolume.toFixed(2)}</div>
            <div>卖出量: {indicators.volumeProfile.sellVolume.toFixed(2)}</div>
            <div class="net-volume {indicators.volumeProfile.netVolume > 0 ? 'positive' : 'negative'}">
              净量: {indicators.volumeProfile.netVolume.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div class="support-resistance">
        <h4>支撑阻力位</h4>
        <div class="levels">
          <div class="resistance-levels">
            <h5>阻力位</h5>
            {#each indicators.supportResistance.resistance as level}
              <div class="level">{level.toFixed(2)}</div>
            {/each}
          </div>
          <div class="support-levels">
            <h5>支撑位</h5>
            {#each indicators.supportResistance.support as level}
              <div class="level">{level.toFixed(2)}</div>
            {/each}
          </div>
        </div>
      </div>

      <div class="trading-signals">
        <h4>交易信号</h4>
        {#each tradingSignals as signal}
          <div class="signal-card {getSignalTypeClass(signal.type)}">
            <div class="signal-header">
              <span class="signal-type">{getSignalTypeText(signal.type)}</span>
              <span class="signal-confidence">置信度: {(signal.confidence * 100).toFixed(0)}%</span>
            </div>
            <div class="signal-reason">{signal.reason}</div>
            {#if signal.priceTarget}
              <div class="price-targets">
                <div>入场: {signal.priceTarget.entry.toFixed(2)}</div>
                <div>止损: {signal.priceTarget.stopLoss.toFixed(2)}</div>
                <div>止盈: {signal.priceTarget.takeProfit.toFixed(2)}</div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .order-book {
    background: var(--panel-bg);
    color: var(--text-primary);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
  }

  h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  .view-toggle {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-toggle:hover {
    background: var(--hover-color);
  }

  .book-container {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
  }

  .book-container.list {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }

  .asks, .bids {
    flex: 1;
  }

  .book-container .header {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--bg-secondary);
    font-weight: bold;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
    border-radius: 2px;
    transition: background-color 0.2s ease;
  }

  .row:hover {
    background: var(--hover-color);
  }

  .ask {
    color: #ef5350;
  }

  .bid {
    color: #26a69a;
  }

  .price, .quantity {
    font-family: monospace;
  }

  /* 可视化视图样式 */
  .book-container.visual {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .book-container.visual .asks,
  .book-container.visual .bids {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bar {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
    border-radius: 2px;
    transition: all 0.3s ease;
  }

  .bar.ask {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
    margin-left: auto;
  }

  .bar.bid {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
    margin-right: auto;
  }

  .bar:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 768px) {
    .book-container.list {
      flex-direction: column;
    }

    .asks, .bids {
      width: 100%;
    }
  }

  .ratio-data {
    display: flex;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .ratio-group {
    flex: 1;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.75rem;
  }

  .ratio-title {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .ratio-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ratio-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
  }

  .ratio-item .label {
    color: var(--text-secondary);
  }

  .ratio-item .value {
    font-family: monospace;
    font-weight: 500;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
  }

  .ratio-item .value.long {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .ratio-item .value.short {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(239, 83, 80, 0.1);
    border: 1px solid #ef5350;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .error-icon {
    font-size: 1.5rem;
  }

  .error-message {
    color: #ef5350;
    text-align: center;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    background: #ef5350;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .retry-button:hover {
    background: #d32f2f;
  }

  @media (max-width: 768px) {
    .ratio-data {
      flex-direction: column;
    }

    .ratio-group {
      width: 100%;
    }
  }

  .taker-analysis {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin: 0.5rem;
    padding: 0.75rem;
  }

  .taker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .taker-header h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .pressure-status {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .pressure-status.strong_buy {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
  }

  .pressure-status.buy {
    background: rgba(38, 166, 154, 0.05);
    color: #26a69a;
  }

  .pressure-status.strong_sell {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
  }

  .pressure-status.sell {
    background: rgba(239, 83, 80, 0.05);
    color: #ef5350;
  }

  .pressure-status.neutral {
    background: rgba(158, 158, 158, 0.1);
    color: var(--text-secondary);
  }

  .taker-indicators {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .indicator {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .indicator .label {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .indicator .value {
    font-family: monospace;
    font-size: 0.9rem;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
  }

  .value.buy, .value.strong_buy {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .value.sell, .value.strong_sell {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .taker-history {
    background: var(--bg-primary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .history-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .history-item {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.9rem;
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-item .time {
    color: var(--text-secondary);
  }

  .history-item .ratio {
    font-family: monospace;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
  }

  .history-item .ratio.buy {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .history-item .ratio.sell {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .history-item .volume {
    font-family: monospace;
  }

  .history-item .volume.buy {
    color: #26a69a;
  }

  .history-item .volume.sell {
    color: #ef5350;
  }

  .period-select {
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    .taker-indicators {
      grid-template-columns: 1fr;
    }

    .history-header,
    .history-item {
      grid-template-columns: 1.5fr 1fr 1fr 1fr;
      font-size: 0.8rem;
    }
  }

  .technical-analysis {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin: 0.5rem;
    padding: 1rem;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .timeframe-select {
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
  }

  .indicators-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .indicator-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1rem;
  }

  .indicator-card h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .indicator-value {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .indicator-value.oversold {
    color: #26a69a;
  }

  .indicator-value.overbought {
    color: #ef5350;
  }

  .macd-values, .bollinger-values, .volume-analysis {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }

  .histogram.positive {
    color: #26a69a;
  }

  .histogram.negative {
    color: #ef5350;
  }

  .net-volume.positive {
    color: #26a69a;
  }

  .net-volume.negative {
    color: #ef5350;
  }

  .support-resistance {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .levels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .resistance-levels, .support-levels {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .resistance-levels h5 {
    color: #ef5350;
    margin: 0;
  }

  .support-levels h5 {
    color: #26a69a;
    margin: 0;
  }

  .level {
    font-family: monospace;
    padding: 0.25rem;
    background: var(--bg-secondary);
    border-radius: 2px;
  }

  .trading-signals {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .signal-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.75rem;
  }

  .signal-card.signal-strong-buy {
    border-left: 4px solid #26a69a;
  }

  .signal-card.signal-buy {
    border-left: 4px solid #66bb6a;
  }

  .signal-card.signal-neutral {
    border-left: 4px solid #ffd54f;
  }

  .signal-card.signal-sell {
    border-left: 4px solid #ef5350;
  }

  .signal-card.signal-strong-sell {
    border-left: 4px solid #d32f2f;
  }

  .signal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .signal-type {
    font-weight: bold;
  }

  .signal-confidence {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .signal-reason {
    margin-bottom: 0.5rem;
  }

  .price-targets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .indicators-grid {
      grid-template-columns: 1fr;
    }

    .levels {
      grid-template-columns: 1fr;
    }

    .price-targets {
      grid-template-columns: 1fr;
    }
  }

  .market-analysis {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin: 0.5rem;
    padding: 1rem;
  }

  .market-status-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .market-status-card.strong_buy {
    border-left: 4px solid #26a69a;
  }

  .market-status-card.buy {
    border-left: 4px solid #66bb6a;
  }

  .market-status-card.neutral {
    border-left: 4px solid #ffd54f;
  }

  .market-status-card.sell {
    border-left: 4px solid #ef5350;
  }

  .market-status-card.strong_sell {
    border-left: 4px solid #d32f2f;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .market-status-card.strong_buy .status-badge {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
  }

  .market-status-card.buy .status-badge {
    background: rgba(102, 187, 106, 0.1);
    color: #66bb6a;
  }

  .market-status-card.neutral .status-badge {
    background: rgba(255, 213, 79, 0.1);
    color: #ffd54f;
  }

  .market-status-card.sell .status-badge {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
  }

  .market-status-card.strong_sell .status-badge {
    background: rgba(211, 47, 47, 0.1);
    color: #d32f2f;
  }

  .status-description {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .open-interest-card,
  .market-depth-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .card-header h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .loading-spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  .oi-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .oi-value {
    font-size: 1.2rem;
    font-weight: bold;
    font-family: monospace;
  }

  .oi-change {
    font-size: 0.9rem;
    margin-left: 0.5rem;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
  }

  .oi-change.positive {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .oi-change.negative {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .oi-time {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .depth-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric .label {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .metric .value {
    font-family: monospace;
    font-size: 1.1rem;
    padding: 0.25rem;
    border-radius: 2px;
  }

  .value.buy {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .value.sell {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .value.good {
    color: #66bb6a;
    background: rgba(102, 187, 106, 0.1);
  }

  .value.poor {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  @media (max-width: 768px) {
    .depth-metrics {
      grid-template-columns: 1fr;
    }

    .oi-value {
      font-size: 1rem;
    }

    .metric .value {
      font-size: 1rem;
    }
  }
</style> 