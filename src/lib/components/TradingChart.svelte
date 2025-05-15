<script lang="ts">
  import { onMount } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import { RSI, MACD, SMA } from 'technicalindicators';
  import { format } from 'date-fns';

  export let selectedSymbol = 'BTCUSDT';

  let chartContainer: HTMLDivElement;
  let chart: any;
  let candlestickSeries: any;
  let volumeSeries: any;
  let rsiSeries: any;
  let macdSeries: any;
  let smaSeries: any;

  // WebSocket connection for real-time data
  let ws: WebSocket;
  let interval = '1m';
  let historicalData: any[] = [];

  // Chart configuration
  const chartConfig = {
    layout: {
      background: { type: ColorType.Solid, color: '#1E222D' },
      textColor: '#DDD',
    },
    grid: {
      vertLines: { color: '#2B2B43' },
      horzLines: { color: '#2B2B43' },
    },
    width: 800,
    height: 500,
  };

  // 获取历史数据
  async function fetchHistoricalData() {
    try {
      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${selectedSymbol}&interval=${interval}&limit=1000`
      );
      const data = await response.json();
      
      historicalData = data.map((candle: any[]) => ({
        time: candle[0] / 1000,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      // 更新图表数据
      candlestickSeries.setData(historicalData);
      
      // 计算并显示技术指标
      const indicators = calculateIndicators(historicalData);
      displayIndicators(indicators);
    } catch (error) {
      console.error('获取历史数据失败:', error);
    }
  }

  // 显示技术指标
  function displayIndicators(indicators: any) {
    // RSI
    if (!rsiSeries) {
      rsiSeries = chart.addLineSeries({
        color: '#FF9800',
        lineWidth: 2,
        priceScaleId: 'right',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      });
    }
    rsiSeries.setData(indicators.rsi.map((value: number, index: number) => ({
      time: historicalData[index].time,
      value: value
    })));

    // MACD
    if (!macdSeries) {
      macdSeries = chart.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
        priceScaleId: 'right',
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      });
    }
    macdSeries.setData(indicators.macd.map((value: any, index: number) => ({
      time: historicalData[index].time,
      value: value.MACD
    })));

    // SMA
    if (!smaSeries) {
      smaSeries = chart.addLineSeries({
        color: '#4CAF50',
        lineWidth: 2,
      });
    }
    smaSeries.setData(indicators.sma.map((value: number, index: number) => ({
      time: historicalData[index].time,
      value: value
    })));
  }

  // Initialize chart
  onMount(async () => {
    chart = createChart(chartContainer, chartConfig);
    
    // Create series
    candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 获取历史数据
    await fetchHistoricalData();

    // Connect to Binance WebSocket
    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (chart) chart.remove();
    };
  });

  function connectWebSocket() {
    if (ws) {
      ws.close();
    }
    
    ws = new WebSocket(`wss://fstream.binance.com/ws/${selectedSymbol.toLowerCase()}@kline_${interval}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const candle = data.k;
      
      const candleData = {
        time: candle.t / 1000,
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
      };

      const volumeData = {
        time: candle.t / 1000,
        value: parseFloat(candle.v),
        color: parseFloat(candle.c) >= parseFloat(candle.o) ? '#26a69a' : '#ef5350',
      };

      candlestickSeries.update(candleData);
      volumeSeries.update(volumeData);
    };
  }

  // Calculate technical indicators
  function calculateIndicators(data: any[]) {
    const closes = data.map(d => d.close);
    
    // RSI
    const rsi = RSI.calculate({
      values: closes,
      period: 14,
    });

    // MACD
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });

    // SMA
    const sma = SMA.calculate({
      values: closes,
      period: 20,
    });

    return { rsi, macd, sma };
  }

  // 监听交易对和时间周期变化
  $: {
    if (selectedSymbol || interval) {
      fetchHistoricalData();
      if (ws) {
        ws.close();
        connectWebSocket();
      }
    }
  }
</script>

<div class="trading-chart">
  <div class="chart-controls">
    <select bind:value={interval}>
      <option value="1m">1分钟</option>
      <option value="5m">5分钟</option>
      <option value="15m">15分钟</option>
      <option value="1h">1小时</option>
      <option value="4h">4小时</option>
      <option value="1d">1天</option>
    </select>
  </div>
  <div bind:this={chartContainer} class="chart-container"></div>
  <div class="indicators">
    <div class="indicator">
      <h4>RSI (14)</h4>
      <div class="value {historicalData.length > 0 ? (calculateIndicators(historicalData).rsi[calculateIndicators(historicalData).rsi.length - 1] > 70 ? 'overbought' : calculateIndicators(historicalData).rsi[calculateIndicators(historicalData).rsi.length - 1] < 30 ? 'oversold' : '') : ''}">
        {historicalData.length > 0 ? calculateIndicators(historicalData).rsi[calculateIndicators(historicalData).rsi.length - 1].toFixed(2) : '-'}
      </div>
    </div>
    <div class="indicator">
      <h4>MACD</h4>
      <div class="macd-values">
        <div class="value">
          MACD: {historicalData.length > 0 ? calculateIndicators(historicalData).macd[calculateIndicators(historicalData).macd.length - 1].MACD.toFixed(2) : '-'}
        </div>
        <div class="value">
          Signal: {historicalData.length > 0 ? calculateIndicators(historicalData).macd[calculateIndicators(historicalData).macd.length - 1].signal.toFixed(2) : '-'}
        </div>
        <div class="value">
          Hist: {historicalData.length > 0 ? calculateIndicators(historicalData).macd[calculateIndicators(historicalData).macd.length - 1].histogram.toFixed(2) : '-'}
        </div>
      </div>
    </div>
    <div class="indicator">
      <h4>SMA (20)</h4>
      <div class="value">
        {historicalData.length > 0 ? calculateIndicators(historicalData).sma[calculateIndicators(historicalData).sma.length - 1].toFixed(2) : '-'}
      </div>
    </div>
  </div>
</div>

<style>
  .trading-chart {
    width: 100%;
    height: 100%;
    background: #1E222D;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }

  .chart-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .chart-controls select {
    padding: 0.5rem;
    background: #2B2B43;
    color: #DDD;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
  }

  .chart-container {
    width: 100%;
    height: calc(100% - 8rem);
  }

  .indicators {
    display: flex;
    gap: 2rem;
    padding: 1rem;
    background: #2B2B43;
    border-radius: 4px;
    margin-top: 1rem;
  }

  .indicator {
    flex: 1;
  }

  h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: #888;
  }

  .value {
    font-family: monospace;
    font-size: 1.1rem;
  }

  .value.overbought {
    color: #ef5350;
  }

  .value.oversold {
    color: #26a69a;
  }

  .macd-values {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .macd-values .value {
    font-size: 0.9rem;
  }
</style> 