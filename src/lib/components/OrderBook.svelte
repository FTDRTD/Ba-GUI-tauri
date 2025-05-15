<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';

  export let selectedSymbol = 'BTCUSDT';
  let ws: WebSocket;
  let orderBook: { bids: [number, number][]; asks: [number, number][] } = { bids: [], asks: [] };
  let viewMode = 'list'; // 'list' or 'visual'
  let maxVolume = 0;

  onMount(() => {
    connectWebSocket();
    return () => {
      if (ws) ws.close();
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

  // 监听交易对变化
  $: {
    if (selectedSymbol) {
      connectWebSocket();
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
    background: #1E222D;
    color: #DDD;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid #3F3F5F;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: 1.2rem;
  }

  .view-toggle {
    padding: 0.5rem 1rem;
    background: #2B2B43;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
    color: #DDD;
    cursor: pointer;
  }

  .view-toggle:hover {
    background: #3F3F5F;
  }

  .book-container {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .book-container.list {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }

  .asks, .bids {
    flex: 1;
  }

  .header {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: #2B2B43;
    font-weight: bold;
  }

  .row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
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
    transition: width 0.3s ease;
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
</style> 