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

  // 监听主题变化
  onMount(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => updateThemeConfig();
    darkModeMediaQuery.addEventListener('change', updateTheme);
    updateThemeConfig();

    connectWebSocket();
    loadOrderBook();
    return () => {
      if (ws) ws.close();
      darkModeMediaQuery.removeEventListener('change', updateTheme);
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
</style> 