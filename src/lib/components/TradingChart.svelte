<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import { RSI, MACD, SMA } from 'technicalindicators';
  import { format } from 'date-fns';

  export let selectedSymbol: string;
  export let key: number = 0;

  const dispatch = createEventDispatcher();

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

  // 监听主题变化
  let isDarkMode = true;
  
  // 更新主题配置
  function updateThemeConfig() {
    const isDark = document.documentElement.classList.contains('light-mode') ? false : true;
    isDarkMode = isDark;
    
    const theme = {
      background: isDark ? '#1E222D' : '#FFFFFF',
      textColor: isDark ? '#DDD' : '#1A1A1A',
      gridColor: isDark ? '#2B2B43' : '#E0E0E0',
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderColor: isDark ? '#3F3F5F' : '#E0E0E0',
      indicatorBg: isDark ? '#2B2B43' : '#F5F5F5'
    };

    if (chart) {
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: theme.background },
          textColor: theme.textColor,
        },
        grid: {
          vertLines: { color: theme.gridColor },
          horzLines: { color: theme.gridColor },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: theme.textColor,
            style: 1,
            width: 1,
          },
          horzLine: {
            color: theme.textColor,
            style: 1,
            width: 1,
          },
        },
        timeScale: {
          borderColor: theme.borderColor,
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: theme.borderColor,
        },
        leftPriceScale: {
          borderColor: theme.borderColor,
        },
      });

      // 更新图表容器背景
      if (chartContainer) {
        chartContainer.style.background = theme.background;
      }

      // 更新K线图样式
      if (candlestickSeries) {
        candlestickSeries.applyOptions({
          upColor: theme.upColor,
          downColor: theme.downColor,
          borderVisible: false,
          wickUpColor: theme.upColor,
          wickDownColor: theme.downColor,
        });
      }

      // 更新成交量图样式
      if (volumeSeries) {
        volumeSeries.applyOptions({
          color: theme.upColor,
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
      }

      // 更新技术指标样式
      if (rsiSeries) {
        rsiSeries.applyOptions({
          color: '#FF9800',
          lineWidth: 2,
          priceScaleId: 'right',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        });
      }

      if (macdSeries) {
        macdSeries.applyOptions({
          color: '#2196F3',
          lineWidth: 2,
          priceScaleId: 'right',
          scaleMargins: {
            top: 0.2,
            bottom: 0.2,
          },
        });
      }

      if (smaSeries) {
        smaSeries.applyOptions({
          color: '#4CAF50',
          lineWidth: 2,
        });
      }
    }

    return theme;
  }

  // 初始化图表
  function initChart() {
    if (chartContainer) {
      const theme = updateThemeConfig();
      
      chart = createChart(chartContainer, {
        layout: {
          background: { type: ColorType.Solid, color: theme.background },
          textColor: theme.textColor,
        },
        grid: {
          vertLines: { color: theme.gridColor },
          horzLines: { color: theme.gridColor },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: theme.textColor,
            style: 1,
            width: 1,
          },
          horzLine: {
            color: theme.textColor,
            style: 1,
            width: 1,
          },
        },
        timeScale: {
          borderColor: theme.borderColor,
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: theme.borderColor,
        },
        leftPriceScale: {
          borderColor: theme.borderColor,
        },
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
      });

      // 创建K线图
      candlestickSeries = chart.addCandlestickSeries({
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderVisible: false,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
      });

      // 创建成交量图
      volumeSeries = chart.addHistogramSeries({
        color: theme.upColor,
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
      fetchHistoricalData();
    }
  }

  // 监听主题变化
  onMount(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      updateThemeConfig();
      // 重新初始化图表以应用新主题
      if (chart) {
        chart.remove();
        initChart();
      }
    };
    darkModeMediaQuery.addEventListener('change', updateTheme);
    updateThemeConfig();
    initChart();

    // 监听窗口大小变化
    const handleResize = () => {
      if (chart && chartContainer) {
        chart.applyOptions({
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      darkModeMediaQuery.removeEventListener('change', updateTheme);
      window.removeEventListener('resize', handleResize);
      if (chart) chart.remove();
    };
  });

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

      // 通知父组件数据已更新
      dispatch('update');
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

  // 监听 selectedSymbol 变化
  $: if (selectedSymbol) {
    // 当交易对改变时重新加载数据
    fetchHistoricalData();
  }
</script>

<div class="trading-chart">
  <div class="chart-header">
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
  </div>
  <div class="chart-main">
    <div bind:this={chartContainer} class="chart-container"></div>
    <div class="indicators">
      <div class="indicator-group">
        <div class="indicator">
          <h4>RSI (14)</h4>
          <div class="value {historicalData.length > 0 ? (calculateIndicators(historicalData).rsi[calculateIndicators(historicalData).rsi.length - 1] > 70 ? 'overbought' : calculateIndicators(historicalData).rsi[calculateIndicators(historicalData).rsi.length - 1] < 30 ? 'oversold' : '') : ''}">
            {historicalData.length > 0 ? calculateIndicators(historicalData).rsi[calculateIndicators(historicalData).rsi.length - 1].toFixed(2) : '-'}
          </div>
        </div>
        <div class="indicator">
          <h4>SMA (20)</h4>
          <div class="value">
            {historicalData.length > 0 ? calculateIndicators(historicalData).sma[calculateIndicators(historicalData).sma.length - 1].toFixed(2) : '-'}
          </div>
        </div>
      </div>
      <div class="indicator-group">
        <div class="indicator">
          <h4>MACD</h4>
          <div class="macd-values">
            <div class="value">
              MACD: {historicalData.length > 0 ? calculateIndicators(historicalData).macd[calculateIndicators(historicalData).macd.length - 1]?.MACD.toFixed(2) || '-' : '-'}
            </div>
            <div class="value">
              Signal: {historicalData.length > 0 ? calculateIndicators(historicalData).macd[calculateIndicators(historicalData).macd.length - 1]?.signal.toFixed(2) || '-' : '-'}
            </div>
            <div class="value">
              Hist: {historicalData.length > 0 ? calculateIndicators(historicalData).macd[calculateIndicators(historicalData).macd.length - 1]?.histogram.toFixed(2) || '-' : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .trading-chart {
    width: 100%;
    height: 100%;
    background: var(--panel-bg);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }

  .chart-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .chart-controls {
    display: flex;
    gap: 1rem;
  }

  .chart-controls select {
    padding: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .chart-main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chart-container {
    flex: 1;
    min-height: 0;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .indicators {
    display: flex;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .indicator-group {
    flex: 1;
    display: flex;
    gap: 2rem;
    padding: 0 1rem;
    border-right: 1px solid var(--border-color);
  }

  .indicator-group:last-child {
    border-right: none;
  }

  .indicator {
    min-width: 120px;
  }

  h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .value {
    font-family: monospace;
    font-size: 1.1rem;
    color: var(--text-primary);
    padding: 0.25rem 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .value.overbought {
    color: #ef5350;
    border-color: #ef5350;
  }

  .value.oversold {
    color: #26a69a;
    border-color: #26a69a;
  }

  .macd-values {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .macd-values .value {
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    .indicators {
      flex-direction: column;
    }

    .indicator-group {
      flex-direction: column;
      gap: 1rem;
      padding: 0;
      border-right: none;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }

    .indicator-group:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .indicator {
      min-width: auto;
    }
  }
</style> 