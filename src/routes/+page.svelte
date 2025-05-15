<script lang="ts">
  import TradingChart from '$lib/components/TradingChart.svelte';
  import OrderBook from '$lib/components/OrderBook.svelte';
  import TradingPairs from '$lib/components/TradingPairs.svelte';

  let selectedSymbol = 'BTCUSDT';
</script>

<div class="trading-interface">
  <header>
    <h1>币安合约交易</h1>
  </header>
  
  <main>
    <div class="left-panel">
      <TradingPairs bind:selectedPair={selectedSymbol} />
    </div>
    
    <div class="center-panel">
      <TradingChart {selectedSymbol} />
    </div>
    
    <div class="right-panel">
      <OrderBook {selectedSymbol} />
    </div>
  </main>
</div>

<style>
  .trading-interface {
    width: 100vw;
    height: 100vh;
    background: #1E222D;
    color: #DDD;
    display: flex;
    flex-direction: column;
  }

  header {
    padding: 1rem;
    background: #2B2B43;
    border-bottom: 1px solid #3F3F5F;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  main {
    flex: 1;
    display: flex;
    gap: 1rem;
    padding: 1rem;
    overflow: hidden;
  }

  .left-panel {
    width: 300px;
    min-width: 300px;
    background: #1E222D;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
    overflow: hidden;
  }

  .center-panel {
    flex: 1;
    min-width: 0;
    background: #1E222D;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
    overflow: hidden;
  }

  .right-panel {
    width: 300px;
    min-width: 300px;
    background: #1E222D;
    border: 1px solid #3F3F5F;
    border-radius: 4px;
    overflow: hidden;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
</style>
