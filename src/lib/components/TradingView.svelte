<script lang="ts">
  import { onMount } from 'svelte';
  import TradingPairSelector from './TradingPairSelector.svelte';
  import OrderBook from './OrderBook.svelte';
  import TradingForm from './TradingForm.svelte';

  let selectedPair = 'BTCUSDT';
  let chartContainer: HTMLDivElement;
  let selectedTimeframe = '1h';

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const indicators = [
    { name: 'MA', value: '20' },
    { name: 'RSI', value: '14' },
    { name: 'MACD', value: '12,26,9' },
    { name: 'BB', value: '20,2' }
  ];

  function handlePairSelect(event: CustomEvent) {
    selectedPair = event.detail.pair;
    // TODO: Update chart with new pair data
  }

  function handleTimeframeSelect(timeframe: string) {
    selectedTimeframe = timeframe;
    // TODO: Update chart timeframe
  }

  onMount(() => {
    // TODO: Initialize TradingView chart
  });
</script>

<div class="trading-view">
  <div class="trading-header">
    <div class="selected-pair">
      <span class="pair-symbol">{selectedPair}</span>
      <span class="pair-price">$0.00</span>
    </div>
    <div class="trading-actions">
      {#each timeframes as timeframe}
        <button 
          class="action-btn"
          class:active={selectedTimeframe === timeframe}
          on:click={() => handleTimeframeSelect(timeframe)}
        >
          {timeframe}
        </button>
      {/each}
    </div>
  </div>

  <div class="trading-content">
    <div class="main-content">
      <div class="chart-container" bind:this={chartContainer}></div>
      
      <div class="indicators-panel">
        <div class="indicators-header">
          <h3>技术指标</h3>
          <button class="add-indicator-btn">+ 添加指标</button>
        </div>
        
        <div class="indicators-list">
          {#each indicators as indicator}
            <div class="indicator-item">
              <div class="indicator-info">
                <span class="indicator-name">{indicator.name}</span>
                <span class="indicator-value">{indicator.value}</span>
              </div>
              <div class="indicator-actions">
                <button class="indicator-btn">设置</button>
                <button class="indicator-btn delete">删除</button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
    
    <div class="trading-sidebar">
      <TradingPairSelector
        {selectedPair}
        on:select={handlePairSelect}
      />
      <OrderBook />
      <TradingForm />
    </div>
  </div>
</div>

<style>
  .trading-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .trading-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
  }

  .selected-pair {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: white;
    border-radius: 6px;
    box-shadow: 0 0 0 2px rgba(246, 185, 59, 0.2);
  }

  .pair-symbol {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .pair-price {
    font-size: 1.1rem;
    opacity: 0.9;
  }

  .trading-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--hover-bg);
  }

  .action-btn.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .trading-content {
    display: flex;
    flex: 1;
    gap: 1rem;
    padding: 1rem;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chart-container {
    flex: 1;
    background: var(--card-bg);
    border-radius: 8px;
    min-height: 400px;
  }

  .indicators-panel {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 1rem;
  }

  .indicators-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .indicators-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .add-indicator-btn {
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .add-indicator-btn:hover {
    opacity: 0.9;
  }

  .indicators-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .indicator-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--input-bg);
    border-radius: 6px;
  }

  .indicator-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .indicator-name {
    font-weight: 500;
  }

  .indicator-value {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .indicator-actions {
    display: flex;
    gap: 0.5rem;
  }

  .indicator-btn {
    padding: 0.25rem 0.75rem;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .indicator-btn:hover {
    background: var(--hover-bg);
  }

  .indicator-btn.delete {
    color: var(--error-color);
    border-color: var(--error-color);
  }

  .indicator-btn.delete:hover {
    background: var(--error-color);
    color: white;
  }

  .trading-sidebar {
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style> 