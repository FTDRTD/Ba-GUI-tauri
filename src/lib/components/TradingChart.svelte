<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { createChart, ColorType } from 'lightweight-charts';
  import { RSI, MACD, SMA } from 'technicalindicators';
  import { format } from 'date-fns';
  import { cacheDB } from '$lib/stores/cache';

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

  // 将theme变量移到组件顶部
  let theme = {
    upColor: '#26a69a',
    downColor: '#ef5350',
    background: '#1E222D',
    textColor: '#DDD',
    gridColor: '#2B2B43',
    borderColor: '#2B2B43'
  };

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
      // 尝试从缓存获取数据
      const endTime = Date.now();
      const startTime = endTime - (1000 * 60 * 60 * 24 * 7); // 7天前
      const cachedData = await cacheDB.getKlines(selectedSymbol, interval, startTime, endTime);

      if (cachedData && cachedData.length > 0) {
        // 使用缓存数据
        historicalData = cachedData;
        updateChartWithData(historicalData);
      } else {
        // 从API获取新数据
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

        // 更新图表
        updateChartWithData(historicalData);

        // 存储到缓存
        await cacheDB.storeKlines(selectedSymbol, interval, historicalData);
      }

      // 通知父组件数据已更新
      dispatch('update');
    } catch (error) {
      console.error('获取历史数据失败:', error);
    }
  }

  // 修改updateChartWithData函数，添加空值检查
  function updateChartWithData(data: any[]) {
    if (!data || !chart || !candlestickSeries || !volumeSeries) return;

    candlestickSeries.setData(data);
    
    // 设置价格范围
    const prices = data.map(d => [d.high, d.low]).flat();
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.1;
    
    const priceScale = chart.priceScale('right');
    if (priceScale) {
      priceScale.applyOptions({
        autoScale: true,
        mode: 0,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      });
    }
    
    volumeSeries.setData(data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? theme.upColor : theme.downColor
    })));

    // 计算并显示技术指标
    const indicators = calculateIndicators(data);
    if (indicators) {
      displayIndicators(indicators);
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
        volume: Number(candle.v)
      };

      // 更新历史数据
      if (historicalData && historicalData.length > 0) {
        const lastCandle = historicalData[historicalData.length - 1];
        if (lastCandle && lastCandle.time === candleData.time) {
          // 更新最后一根K线
          historicalData[historicalData.length - 1] = candleData;
        } else {
          // 添加新的K线
          historicalData.push(candleData);
          // 保持数据量在1000根以内
          if (historicalData.length > 1000) {
            historicalData.shift();
          }
        }

        // 更新图表
        if (showChart) {
          updateChartWithData(historicalData);
        }

        // 异步更新缓存
        cacheDB.storeKlines(selectedSymbol, interval, historicalData).catch(console.error);
      }
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
    const prices = data.map(d => d.close);
    
    // RSI
    const rsi = RSI.calculate({
      values: prices,
      period: 14
    });

    // MACD
    const macd = MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });

    // SMA
    const sma = SMA.calculate({
      values: prices,
      period: 20
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
          <div class="value {historicalData.length > 0 && calculateIndicators(historicalData)?.rsi?.[calculateIndicators(historicalData)?.rsi?.length - 1] > 70 ? 'overbought' : 
            historicalData.length > 0 && calculateIndicators(historicalData)?.rsi?.[calculateIndicators(historicalData)?.rsi?.length - 1] < 30 ? 'oversold' : ''}">
            {#if historicalData.length > 0 && calculateIndicators(historicalData)?.rsi}
              {calculateIndicators(historicalData)?.rsi[calculateIndicators(historicalData)?.rsi.length - 1]?.toFixed(2) ?? '-'}
            {:else}
              -
            {/if}
          </div>
        </div>
        <div class="indicator">
          <h4>SMA (20)</h4>
          <div class="value">
            {#if historicalData.length > 0 && calculateIndicators(historicalData)?.sma}
              {calculateIndicators(historicalData)?.sma[calculateIndicators(historicalData)?.sma.length - 1]?.toFixed(2) ?? '-'}
            {:else}
              -
            {/if}
          </div>
        </div>
      </div>
      <div class="indicator-group">
        <div class="indicator">
          <h4>MACD</h4>
          <div class="macd-values">
            <div class="value">
              MACD: {#if historicalData.length > 0 && calculateIndicators(historicalData)?.macd}
                {calculateIndicators(historicalData)?.macd[calculateIndicators(historicalData)?.macd.length - 1]?.MACD?.toFixed(2) ?? '-'}
              {:else}
                -
              {/if}
            </div>
            <div class="value">
              Signal: {#if historicalData.length > 0 && calculateIndicators(historicalData)?.macd}
                {calculateIndicators(historicalData)?.macd[calculateIndicators(historicalData)?.macd.length - 1]?.signal?.toFixed(2) ?? '-'}
              {:else}
                -
              {/if}
            </div>
            <div class="value">
              Hist: {#if historicalData.length > 0 && calculateIndicators(historicalData)?.macd}
                {calculateIndicators(historicalData)?.macd[calculateIndicators(historicalData)?.macd.length - 1]?.histogram?.toFixed(2) ?? '-'}
              {:else}
                -
              {/if}
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
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .chart-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .toggle-chart {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toggle-chart:hover {
    background: var(--hover-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .toggle-chart:active {
    transform: translateY(0);
  }

  .chart-controls select {
    padding: 0.5rem 2rem 0.5rem 1rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 1rem;
    transition: all 0.2s ease;
  }

  .chart-controls select:hover {
    border-color: var(--accent-color);
  }

  .chart-controls select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
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
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--bg-primary);
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
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 6px;
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
    font-weight: 500;
  }

  .value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.1rem;
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
  }

  .value.overbought {
    color: #ef5350;
    border-color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .value.oversold {
    color: #26a69a;
    border-color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
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
      justify-content: center;
    }

    .chart-controls select {
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