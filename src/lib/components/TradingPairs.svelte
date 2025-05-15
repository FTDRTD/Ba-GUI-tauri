<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  
  export let selectedPair: string = 'BTCUSDT';
  const dispatch = createEventDispatcher();
  
  let searchTerm = '';
  let sortBy: 'volume' | 'price' | 'change' = 'volume';
  let sortDirection: 'asc' | 'desc' = 'desc';
  let showFavorites = false;
  let showOnlySpot = true;
  let showOnlyFutures = false;
  let isCollapsed = false; // 控制列表折叠状态
  
  let tradingPairs: any[] = [];
  let favorites = new Set<string>();
  let priceData: { [key: string]: any } = {};
  let isLoading = true;
  let error: string | null = null;

  // 获取现货交易对
  async function fetchSpotPairs() {
    try {
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      const data = await response.json();
      return data.symbols
        .filter((symbol: any) => symbol.status === 'TRADING' && symbol.quoteAsset === 'USDT')
        .map((symbol: any) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          isSpot: true,
          isFutures: false
        }));
    } catch (err) {
      console.error('获取现货交易对失败:', err);
      return [];
    }
  }

  // 获取期货交易对
  async function fetchFuturesPairs() {
    try {
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      const data = await response.json();
      return data.symbols
        .filter((symbol: any) => symbol.status === 'TRADING' && symbol.quoteAsset === 'USDT' && symbol.contractType === 'PERPETUAL')
        .map((symbol: any) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          isSpot: false,
          isFutures: true
        }));
    } catch (err) {
      console.error('获取期货交易对失败:', err);
      return [];
    }
  }

  // 获取24小时行情数据
  async function fetch24hTicker() {
    try {
      const [spotResponse, futuresResponse] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/24hr'),
        fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
      ]);
      
      const spotData = await spotResponse.json();
      const futuresData = await futuresResponse.json();
      
      const combinedData = [...spotData, ...futuresData].reduce((acc: any, item: any) => {
        acc[item.symbol] = {
          ...item,
          isSpot: item.symbol in spotData,
          isFutures: item.symbol in futuresData
        };
        return acc;
      }, {});
      
      return combinedData;
    } catch (err) {
      console.error('获取24小时行情失败:', err);
      return {};
    }
  }

  // 加载数据
  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [spotPairs, futuresPairs, tickerData] = await Promise.all([
        fetchSpotPairs(),
        fetchFuturesPairs(),
        fetch24hTicker()
      ]);

      tradingPairs = [...spotPairs, ...futuresPairs];
      priceData = tickerData;
    } catch (err) {
      error = '加载数据失败，请稍后重试';
      console.error('加载数据失败:', err);
    } finally {
      isLoading = false;
    }
  }

  // 切换收藏状态
  function toggleFavorite(symbol: string) {
    if (favorites.has(symbol)) {
      favorites.delete(symbol);
    } else {
      favorites.add(symbol);
    }
    // 保存到本地存储
    localStorage.setItem('favorites', JSON.stringify(Array.from(favorites)));
  }

  // 排序函数
  function sortPairs(pairs: any[]) {
    return [...pairs].sort((a, b) => {
      const aData = priceData[a.symbol] || {};
      const bData = priceData[b.symbol] || {};
      
      let comparison = 0;
      switch (sortBy) {
        case 'volume':
          comparison = (parseFloat(bData.volume) || 0) - (parseFloat(aData.volume) || 0);
          break;
        case 'price':
          comparison = (parseFloat(bData.lastPrice) || 0) - (parseFloat(aData.lastPrice) || 0);
          break;
        case 'change':
          comparison = (parseFloat(bData.priceChangePercent) || 0) - (parseFloat(aData.priceChangePercent) || 0);
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }

  // 过滤交易对
  $: filteredPairs = tradingPairs
    .filter(pair => {
      const matchesSearch = pair.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorites = !showFavorites || favorites.has(pair.symbol);
      const matchesType = (showOnlySpot && pair.isSpot) || (showOnlyFutures && pair.isFutures) || (!showOnlySpot && !showOnlyFutures);
      return matchesSearch && matchesFavorites && matchesType;
    });

  // 排序后的交易对
  $: sortedPairs = sortPairs(filteredPairs);

  // 加载收藏列表
  onMount(() => {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      favorites = new Set(JSON.parse(savedFavorites));
    }
    loadData();
    
    // 定期更新数据
    const updateInterval = setInterval(loadData, 10000);
    return () => clearInterval(updateInterval);
  });

  // 处理交易对选择
  function handlePairSelect(symbol: string) {
    selectedPair = symbol;
    dispatch('pairSelected', { symbol });
  }

  // 处理折叠/展开
  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<div class="trading-pairs" class:collapsed={isCollapsed}>
  <div class="header">
    <div class="header-main">
      <button class="collapse-btn" on:click={toggleCollapse}>
        {isCollapsed ? '▶' : '▼'} 交易对列表
      </button>
      <div class="search-bar">
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
    </div>
    
    {#if !isCollapsed}
      <div class="controls">
        <div class="type-filter">
          <button 
            class:active={showOnlySpot} 
            on:click={() => {
              showOnlySpot = !showOnlySpot;
              showOnlyFutures = false;
            }}
          >
            现货
          </button>
          <button 
            class:active={showOnlyFutures} 
            on:click={() => {
              showOnlyFutures = !showOnlyFutures;
              showOnlySpot = false;
            }}
          >
            期货
          </button>
        </div>
        <button 
          class="favorites-toggle" 
          class:active={showFavorites}
          on:click={() => showFavorites = !showFavorites}
        >
          {showFavorites ? '全部' : '收藏'}
        </button>
      </div>

      <div class="sort-bar">
        <button 
          class:active={sortBy === 'volume'} 
          on:click={() => {
            if (sortBy === 'volume') {
              sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              sortBy = 'volume';
              sortDirection = 'desc';
            }
          }}
        >
          成交量 {sortBy === 'volume' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button 
          class:active={sortBy === 'price'} 
          on:click={() => {
            if (sortBy === 'price') {
              sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              sortBy = 'price';
              sortDirection = 'desc';
            }
          }}
        >
          价格 {sortBy === 'price' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button 
          class:active={sortBy === 'change'} 
          on:click={() => {
            if (sortBy === 'change') {
              sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              sortBy = 'change';
              sortDirection = 'desc';
            }
          }}
        >
          24h涨跌 {sortBy === 'change' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>
    {/if}
  </div>

  {#if !isCollapsed}
    {#if isLoading}
      <div class="loading">加载中...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      <div class="pairs-container" transition:slide>
        {#each sortedPairs as pair (pair.symbol)}
          {@const data = priceData[pair.symbol] || {}}
          {@const priceChange = parseFloat(data.priceChangePercent) || 0}
          {@const isSelected = pair.symbol === selectedPair}
          {@const isFavorite = favorites.has(pair.symbol)}
          
          <div 
            class="pair-item"
            class:selected={isSelected}
            class:spot={pair.isSpot}
            class:futures={pair.isFutures}
            class:favorite={isFavorite}
            on:click={() => handlePairSelect(pair.symbol)}
            transition:fly={{ y: 20, duration: 200 }}
          >
            <div class="pair-header">
              <div class="pair-name">
                <span class="base">{pair.baseAsset}</span>
                <span class="quote">/{pair.quoteAsset}</span>
                {#if pair.isSpot}
                  <span class="type spot">现货</span>
                {:else}
                  <span class="type futures">期货</span>
                {/if}
              </div>
              <button 
                class="favorite-btn"
                class:active={isFavorite}
                on:click|stopPropagation={() => toggleFavorite(pair.symbol)}
              >
                ★
              </button>
            </div>
            
            <div class="pair-price">
              <span class="price">{parseFloat(data.lastPrice || 0).toFixed(2)}</span>
              <span class="change" class:up={priceChange > 0} class:down={priceChange < 0}>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
            
            <div class="pair-volume">
              24h量: {(parseFloat(data.volume) || 0).toFixed(2)}
            </div>
            
            {#if isSelected}
              <div class="selected-indicator">当前选中</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .trading-pairs {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--panel-bg);
    color: var(--text-primary);
    transition: all 0.3s ease;
  }

  .trading-pairs.collapsed {
    height: auto;
  }

  .header {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .collapse-btn {
    padding: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.9rem;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .collapse-btn:hover {
    background: var(--hover-color);
  }

  .search-bar {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 2rem 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .clear-search {
    position: absolute;
    right: 0.5rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.2rem;
  }

  .controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .type-filter {
    display: flex;
    gap: 0.25rem;
  }

  button {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  button:hover {
    background: var(--hover-color);
  }

  button.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .sort-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .sort-bar button {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }

  .pairs-container {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pair-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .pair-item:hover {
    background: var(--hover-color);
    transform: translateY(-1px);
  }

  .pair-item.selected {
    border-color: var(--accent-color);
    background: var(--accent-color);
    color: white;
  }

  .pair-item.spot {
    border-left: 3px solid #26a69a;
  }

  .pair-item.futures {
    border-left: 3px solid #ef5350;
  }

  .pair-item.favorite {
    background: var(--bg-primary);
  }

  .pair-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .pair-name {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .base {
    font-size: 1.1rem;
  }

  .quote {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .type {
    font-size: 0.7rem;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    margin-left: 0.5rem;
  }

  .type.spot {
    background: rgba(38, 166, 154, 0.2);
    color: #26a69a;
  }

  .type.futures {
    background: rgba(239, 83, 80, 0.2);
    color: #ef5350;
  }

  .favorite-btn {
    padding: 0.25rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s ease;
  }

  .favorite-btn.active {
    color: #FFD700;
  }

  .pair-price {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .price {
    font-family: monospace;
    font-size: 1.1rem;
  }

  .change {
    font-family: monospace;
    font-size: 0.9rem;
  }

  .change.up {
    color: #26a69a;
  }

  .change.down {
    color: #ef5350;
  }

  .pair-volume {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .selected-indicator {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--accent-color);
    color: white;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    font-size: 0.7rem;
  }

  .loading, .error {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .error {
    color: #ef5350;
  }

  @media (max-width: 768px) {
    .header-main {
      flex-direction: column;
      align-items: stretch;
    }

    .collapse-btn {
      width: 100%;
      justify-content: center;
    }

    .controls {
      flex-wrap: wrap;
    }
  }
</style> 