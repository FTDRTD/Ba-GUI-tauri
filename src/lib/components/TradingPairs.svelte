<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  
  export let selectedPair = 'BTCUSDT';
  const dispatch = createEventDispatcher();
  
  let tradingPairs: any[] = [];
  let searchTerm = '';
  let viewMode = 'list'; // 'list' or 'grid'
  let loading = true;
  let sortBy = 'volume'; // 'volume', 'price', 'change'
  let sortDirection = 'desc';
  let favorites: string[] = [];
  let showFavoritesOnly = false;
  let priceData: { [key: string]: { price: number; change24h: number; volume24h: number } } = {};

  // 获取所有USDT交易对
  async function fetchTradingPairs() {
    try {
      const [exchangeInfo, ticker24h] = await Promise.all([
        fetch('https://fapi.binance.com/fapi/v1/exchangeInfo'),
        fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
      ]);
      
      const exchangeData = await exchangeInfo.json();
      const tickerData = await ticker24h.json();
      
      // 处理24小时行情数据
      tickerData.forEach((ticker: any) => {
        if (ticker.symbol.endsWith('USDT')) {
          priceData[ticker.symbol] = {
            price: parseFloat(ticker.lastPrice),
            change24h: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.volume)
          };
        }
      });
      
      tradingPairs = exchangeData.symbols
        .filter((symbol: any) => symbol.symbol.endsWith('USDT'))
        .map((symbol: any) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status,
          pricePrecision: symbol.pricePrecision,
          quantityPrecision: symbol.quantityPrecision,
          ...priceData[symbol.symbol]
        }))
        .sort((a: any, b: any) => b.volume24h - a.volume24h);
      
      loading = false;
    } catch (error) {
      console.error('获取交易对失败:', error);
      loading = false;
    }
  }

  // 从本地存储加载收藏夹
  function loadFavorites() {
    const saved = localStorage.getItem('favoritePairs');
    if (saved) {
      favorites = JSON.parse(saved);
    }
  }

  // 保存收藏夹到本地存储
  function saveFavorites() {
    localStorage.setItem('favoritePairs', JSON.stringify(favorites));
  }

  // 切换收藏状态
  function toggleFavorite(symbol: string) {
    const index = favorites.indexOf(symbol);
    if (index === -1) {
      favorites = [...favorites, symbol];
    } else {
      favorites = favorites.filter(s => s !== symbol);
    }
    saveFavorites();
  }

  // 排序函数
  function sortPairs(pairs: any[]) {
    return [...pairs].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'volume':
          comparison = (b.volume24h || 0) - (a.volume24h || 0);
          break;
        case 'price':
          comparison = (b.price || 0) - (a.price || 0);
          break;
        case 'change':
          comparison = (b.change24h || 0) - (a.change24h || 0);
          break;
        default:
          comparison = (b.volume24h || 0) - (a.volume24h || 0);
      }
      return sortDirection === 'desc' ? comparison : -comparison;
    });
  }

  // 过滤和排序交易对
  $: filteredPairs = tradingPairs
    .filter(pair => {
      const matchesSearch = pair.baseAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          pair.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorite = !showFavoritesOnly || favorites.includes(pair.symbol);
      return matchesSearch && matchesFavorite;
    });

  $: sortedPairs = sortPairs(filteredPairs);

  // 切换视图模式
  function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
  }

  // 切换排序方式
  function toggleSort(by: string) {
    if (sortBy === by) {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      sortBy = by;
      sortDirection = 'desc';
    }
    // 强制更新排序
    sortedPairs = sortPairs(filteredPairs);
  }

  onMount(() => {
    loadFavorites();
    fetchTradingPairs();
    
    // 定期更新价格数据
    const updateInterval = setInterval(async () => {
      try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
        const data = await response.json();
        
        data.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            priceData[ticker.symbol] = {
              price: parseFloat(ticker.lastPrice),
              change24h: parseFloat(ticker.priceChangePercent),
              volume24h: parseFloat(ticker.volume)
            };
          }
        });
        
        // 更新交易对数据
        tradingPairs = tradingPairs.map(pair => ({
          ...pair,
          ...priceData[pair.symbol]
        }));
      } catch (error) {
        console.error('更新价格数据失败:', error);
      }
    }, 5000);

    return () => clearInterval(updateInterval);
  });

  function handlePairSelect(symbol: string) {
    selectedPair = symbol;
    dispatch('pairSelected', { symbol });
  }
</script>

<div class="trading-pairs">
  <div class="header">
    <h3>交易对列表</h3>
    <div class="controls">
      <div class="search-box">
        <input 
          type="text" 
          bind:value={searchTerm} 
          placeholder="搜索交易对..."
          class="search-input"
        />
        {#if searchTerm}
          <button class="clear-search" on:click={() => searchTerm = ''}>×</button>
        {/if}
      </div>
      <div class="view-controls">
        <button 
          class="favorite-toggle" 
          class:active={showFavoritesOnly}
          on:click={() => showFavoritesOnly = !showFavoritesOnly}
          title="显示收藏"
        >
          ★
        </button>
        <button on:click={toggleViewMode} class="view-toggle">
          {viewMode === 'list' ? '网格视图' : '列表视图'}
        </button>
      </div>
    </div>
    <div class="sort-controls">
      <button 
        class="sort-btn" 
        class:active={sortBy === 'volume'} 
        class:desc={sortBy === 'volume' && sortDirection === 'desc'}
        on:click={() => toggleSort('volume')}
      >
        成交量
      </button>
      <button 
        class="sort-btn" 
        class:active={sortBy === 'price'} 
        class:desc={sortBy === 'price' && sortDirection === 'desc'}
        on:click={() => toggleSort('price')}
      >
        价格
      </button>
      <button 
        class="sort-btn" 
        class:active={sortBy === 'change'} 
        class:desc={sortBy === 'change' && sortDirection === 'desc'}
        on:click={() => toggleSort('change')}
      >
        24h涨跌
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading" transition:fade>
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
  {:else}
    <div class="pairs-container {viewMode}" transition:fly={{ y: 20, duration: 300 }}>
      {#each sortedPairs as pair (pair.symbol)}
        <div 
          class="pair-item {selectedPair === pair.symbol ? 'selected' : ''}"
          on:click={() => handlePairSelect(pair.symbol)}
          transition:fade
          class:highlight={selectedPair === pair.symbol}
        >
          <div class="pair-header">
            <button 
              class="favorite-btn" 
              class:active={favorites.includes(pair.symbol)}
              on:click|stopPropagation={() => toggleFavorite(pair.symbol)}
              title={favorites.includes(pair.symbol) ? '取消收藏' : '收藏'}
            >
              ★
            </button>
            <div class="pair-info">
              <span class="base-asset">{pair.baseAsset}</span>
              <span class="quote-asset">/{pair.quoteAsset}</span>
              {#if selectedPair === pair.symbol}
                <span class="selected-indicator">当前选中</span>
              {/if}
            </div>
          </div>
          
          <div class="pair-price">
            <span class="price">${pair.price?.toFixed(2) || '0.00'}</span>
            <span class="change {pair.change24h >= 0 ? 'positive' : 'negative'}">
              {pair.change24h?.toFixed(2) || '0.00'}%
            </span>
          </div>
          
          <div class="pair-details">
            <div class="detail-item">
              <span class="label">成交量:</span>
              <span class="value">${(pair.volume24h || 0).toLocaleString()}</span>
            </div>
            <div class="detail-item">
              <span class="label">精度:</span>
              <span class="value">{pair.pricePrecision}/{pair.quantityPrecision}</span>
            </div>
            <span class="status {pair.status.toLowerCase()}">{pair.status}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trading-pairs {
    background: var(--panel-bg);
    color: var(--text-primary);
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--panel-bg);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

  .search-box {
    position: relative;
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .clear-search {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.2rem;
    line-height: 1;
  }

  .view-controls {
    display: flex;
    gap: 0.5rem;
  }

  .favorite-toggle {
    padding: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
  }

  .favorite-toggle.active {
    color: #FFD700;
    border-color: #FFD700;
  }

  .view-toggle {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .view-toggle:hover,
  .favorite-toggle:hover {
    background: var(--hover-color);
  }

  .sort-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .sort-btn {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sort-btn:hover {
    background: var(--hover-color);
  }

  .sort-btn.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
    font-weight: 500;
  }

  .sort-btn.active::after {
    content: '';
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 4px solid currentColor;
    transition: transform 0.2s ease;
  }

  .sort-btn.active.desc::after {
    transform: rotate(180deg);
  }

  .pairs-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .pairs-container::-webkit-scrollbar {
    width: 6px;
  }

  .pairs-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .pairs-container::-webkit-scrollbar-thumb {
    background-color: var(--border-color);
    border-radius: 3px;
  }

  .pairs-container::-webkit-scrollbar-thumb:hover {
    background-color: var(--accent-color);
  }

  .pairs-container.list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .pairs-container.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    align-content: start;
  }

  .pair-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .pair-item:hover {
    background: var(--hover-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1;
  }

  .pair-item.selected {
    border-color: var(--accent-color);
    background: var(--hover-color);
    box-shadow: 0 0 0 2px var(--accent-color), 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2;
  }

  .pair-item.highlight {
    animation: highlight-pulse 2s ease-in-out;
  }

  @keyframes highlight-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(41, 98, 255, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(41, 98, 255, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(41, 98, 255, 0);
    }
  }

  .selected-indicator {
    background: var(--accent-color);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-left: auto;
    white-space: nowrap;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .pair-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
    flex-wrap: wrap;
  }

  .favorite-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.2rem;
    line-height: 1;
    transition: color 0.2s ease;
  }

  .favorite-btn.active {
    color: #FFD700;
  }

  .pair-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    flex: 1;
  }

  .base-asset {
    font-size: 1.1rem;
    font-weight: bold;
  }

  .quote-asset {
    color: var(--text-secondary);
  }

  .pair-price {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0.25rem 0;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .price {
    font-size: 1.1rem;
    font-weight: 500;
  }

  .change {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .change.positive {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
  }

  .change.negative {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
  }

  .pair-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: auto;
  }

  .detail-item {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-width: 120px;
  }

  .label {
    color: var(--text-secondary);
  }

  .value {
    color: var(--text-primary);
  }

  .status {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-left: auto;
  }

  .status.trading {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
  }

  .status.break {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
  }

  .loading {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .pairs-container.grid {
      grid-template-columns: 1fr;
    }

    .controls {
      flex-direction: column;
    }

    .view-controls {
      justify-content: flex-end;
    }

    .pair-item {
      min-height: auto;
      padding: 1rem;
    }

    .pair-header {
      gap: 0.5rem;
    }

    .pair-info {
      gap: 0.25rem;
    }

    .selected-indicator {
      margin-left: 0;
      width: 100%;
      text-align: center;
    }

    .pair-price {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .pair-details {
      flex-direction: column;
      gap: 0.5rem;
    }

    .detail-item {
      min-width: auto;
      width: 100%;
      justify-content: space-between;
    }
  }
</style> 