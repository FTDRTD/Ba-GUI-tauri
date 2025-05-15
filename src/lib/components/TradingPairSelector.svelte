<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';

  export let selectedPair: string = 'BTCUSDT';
  export let pairs: string[] = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'];

  const dispatch = createEventDispatcher();

  function handleSelect(pair: string) {
    selectedPair = pair;
    dispatch('select', { pair });
  }
</script>

<div class="trading-pair-selector">
  <div class="search-box">
    <input
      type="text"
      placeholder="搜索交易对..."
      class="search-input"
    />
  </div>
  
  <div class="pairs-list">
    {#each pairs as pair}
      <div
        class="pair-item"
        class:selected={selectedPair === pair}
        on:click={() => handleSelect(pair)}
        transition:fade
      >
        <span class="pair-symbol">{pair}</span>
        <span class="pair-price">$0.00</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .trading-pair-selector {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 1rem;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .search-box {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .pairs-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .pair-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--input-bg);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .pair-item:hover {
    background: var(--hover-bg);
  }

  .pair-item.selected {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(246, 185, 59, 0.2);
  }

  .pair-symbol {
    font-weight: 500;
  }

  .pair-price {
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .selected .pair-price {
    opacity: 1;
  }
</style> 