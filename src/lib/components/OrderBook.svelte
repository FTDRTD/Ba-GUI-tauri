<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { format } from 'date-fns';

  export let selectedSymbol: string;
  export let key: number = 0;

  const dispatch = createEventDispatcher();

  let ws: WebSocket;
  let orderBook: { bids: [number, number][]; asks: [number, number][] } = { bids: [], asks: [] };
  let viewMode = 'list'; // 'list' or 'visual'
  let maxVolume = 0;

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

  // 监听主题变化
  onMount(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => updateThemeConfig();
    darkModeMediaQuery.addEventListener('change', updateTheme);
    updateThemeConfig();

    connectWebSocket();
    loadOrderBook();
    updateRatioData();

    // 添加大户数据定时更新
    const ratioUpdateInterval = setInterval(updateRatioData, 60000); // 每分钟更新一次
    
    return () => {
      if (ws) ws.close();
      darkModeMediaQuery.removeEventListener('change', updateTheme);
      clearInterval(ratioUpdateInterval);
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
      // 加载订单簿数据
      connectWebSocket();
      
      // 通知父组件数据已更新
      dispatch('update');
    } catch (error) {
      console.error('加载订单簿数据失败:', error);
    }
  }
</script>

<div class="order-book">
  <div class="header">
    <h3>订单簿</h3>
    <button on:click={toggleViewMode} class="view-toggle">
      {viewMode === 'list' ? '可视化视图' : '列表视图'}
    </button>
  </div>

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
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
    padding: 0.5rem;
  }

  @media (max-width: 768px) {
    .ratio-data {
      flex-direction: column;
    }

    .ratio-group {
      width: 100%;
    }
  }
</style> 