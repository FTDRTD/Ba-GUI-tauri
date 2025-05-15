<script lang="ts">
  import { onMount } from 'svelte';
  
  let tradingPairs: any[] = [];
  let searchTerm = '';
  let selectedPair = 'BTCUSDT';
  let viewMode = 'list'; // 'list' or 'grid'
  let loading = true;

  // 获取所有USDT交易对
  async function fetchTradingPairs() {
    try {
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      const data = await response.json();
      
      tradingPairs = data.symbols
        .filter((symbol: any) => symbol.symbol.endsWith('USDT'))
        .map((symbol: any) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status,
          pricePrecision: symbol.pricePrecision,
          quantityPrecision: symbol.quantityPrecision
        }))
        .sort((a: any, b: any) => a.baseAsset.localeCompare(b.baseAsset));
      
      loading = false;
    } catch (error) {
      console.error('获取交易对失败:', error);
      loading = false;
    }
  }

  // 过滤交易对
  $: filteredPairs = tradingPairs.filter(pair => 
    pair.baseAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pair.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  onMount(() => {
    fetchTradingPairs();
  });

  // 切换视图模式
  function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
  }
</script>

<div class="trading-pairs">
  <div class="header">
    <h3>交易对列表</h3>
    <div class="controls">
      <input 
        type="text" 
        bind:value={searchTerm} 
        placeholder="搜索交易对..."
        class="search-input"
      />
      <button on:click={toggleViewMode} class="view-toggle">
        {viewMode === 'list' ? '网格视图' : '列表视图'}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    <div class="pairs-container {viewMode}">
      {#each filteredPairs as pair}
        <div 
          class="pair-item {selectedPair === pair.symbol ? 'selected' : ''}"
          on:click={() => selectedPair = pair.symbol}
        >
          <div class="pair-info">
            <span class="base-asset">{pair.baseAsset}</span>
            <span class="quote-asset">/{pair.quoteAsset}</span>
          </div>
          <div class="pair-details">
            <span class="precision">精度: {pair.pricePrecision}/{pair.quantityPrecision}</span>
            <span class="status {pair.status.toLowerCase()}">{pair.status}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trading-pairs {
    background: #1E222D;
    color: #DDD;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid #3F3F5F;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.2rem;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem;
    background: #2B2B43;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
    color: #DDD;
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

  .pairs-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .pairs-container.list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pairs-container.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .pair-item {
    background: #2B2B43;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pair-item:hover {
    background: #3F3F5F;
  }

  .pair-item.selected {
    border-color: #26a69a;
    background: #3F3F5F;
  }

  .pair-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .base-asset {
    font-size: 1.1rem;
    font-weight: bold;
  }

  .quote-asset {
    color: #888;
  }

  .pair-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #888;
  }

  .status {
    padding: 0.2rem 0.5rem;
    border-radius: 2px;
    font-size: 0.8rem;
  }

  .status.trading {
    background: #26a69a;
    color: #fff;
  }

  .status.break {
    background: #ef5350;
    color: #fff;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #888;
  }
</style> 