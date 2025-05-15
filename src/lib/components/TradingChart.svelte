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
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          mode: 0, // 线性价格模式
          autoScale: true,
          invertScale: false,
          alignLabels: true,
          borderVisible: true,
          entireTextOnly: false,
          visible: true,
          ticksVisible: true,
        },
        leftPriceScale: {
          visible: false,
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
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        priceScaleId: 'right',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
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
      if (chart) {
        chart.remove();
        initChart();
        // 重新显示数据
        if (candlestickSeries && volumeSeries) {
          candlestickSeries.setData(historicalData);
          volumeSeries.setData(historicalData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#26a69a' : '#ef5350'
          })));
        }
      }
    };
    darkModeMediaQuery.addEventListener('change', updateTheme);
    updateThemeConfig();
    initChart();
    connectWebSocket();

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
      if (ws) ws.close();
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
        open: Number(candle[1]),
        high: Number(candle[2]),
        low: Number(candle[3]),
        close: Number(candle[4]),
        volume: Number(candle[5])
      }));

      // 更新图表数据
      if (candlestickSeries) {
        candlestickSeries.setData(historicalData);
        
        // 设置价格范围
        const prices = historicalData.map(d => [d.high, d.low]).flat();
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const padding = (maxPrice - minPrice) * 0.1; // 添加10%的padding
        
        chart.priceScale('right').applyOptions({
          autoScale: true,
          mode: 0,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        });
      }
      
      if (volumeSeries) {
        volumeSeries.setData(historicalData.map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? theme.upColor : theme.downColor
        })));
      }

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

  // 修改 WebSocket 连接函数
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
        open: Number(candle.o),
        high: Number(candle.h),
        low: Number(candle.l),
        close: Number(candle.c),
      };

      const volumeData = {
        time: candle.t / 1000,
        value: Number(candle.v),
        color: Number(candle.c) >= Number(candle.o) ? '#26a69a' : '#ef5350',
      };

      // 更新历史数据
      if (historicalData.length > 0) {
        const lastCandle = historicalData[historicalData.length - 1];
        if (lastCandle.time === candleData.time) {
          // 更新最后一根K线
          historicalData[historicalData.length - 1] = {
            ...lastCandle,
            ...candleData,
            volume: volumeData.value
          };
        } else {
          // 添加新的K线
          historicalData.push({
            ...candleData,
            volume: volumeData.value
          });
          // 保持数据量在1000根以内
          if (historicalData.length > 1000) {
            historicalData.shift();
          }
        }
      }

      // 更新图表数据（如果图表存在）
      if (candlestickSeries && showChart) {
        candlestickSeries.update(candleData);
      }
      if (volumeSeries && showChart) {
        volumeSeries.update(volumeData);
      }

      // 更新技术指标
      const indicators = calculateIndicators(historicalData);
      displayIndicators(indicators);
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket连接关闭，尝试重新连接...');
      setTimeout(connectWebSocket, 5000);
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

  // 修改监听交易对和时间周期变化
  $: {
    if (selectedSymbol || interval) {
      fetchHistoricalData();
      connectWebSocket();
    }
  }

  // 监听 selectedSymbol 变化
  $: if (selectedSymbol) {
    // 当交易对改变时重新加载数据
    fetchHistoricalData();
  }

  // 添加图表显示控制
  let showChart = true;
  
  // 修改切换图表显示状态函数
  function toggleChart() {
    showChart = !showChart;
    // 如果重新显示图表，更新最新数据
    if (showChart && chart && candlestickSeries && volumeSeries) {
      candlestickSeries.setData(historicalData);
      volumeSeries.setData(historicalData.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? '#26a69a' : '#ef5350'
      })));
    }
  }
</script>

<div class="trading-chart">
  <div class="chart-header">
    <div class="chart-controls">
      <button class="toggle-chart" on:click={toggleChart}>
        {showChart ? '收起图表' : '展开图表'}
      </button>
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
    <div 
      bind:this={chartContainer} 
      class="chart-container"
      class:collapsed={!showChart}
    ></div>
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
    align-items: center;
  }

  .toggle-chart {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .toggle-chart:hover {
    background: var(--hover-color);
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
    transition: flex 0.3s ease;
  }

  .chart-container.collapsed {
    flex: 0;
    min-height: 0;
    height: 0;
    border: none;
    margin: 0;
    padding: 0;
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
    .chart-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .toggle-chart {
      width: 100%;
    }

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