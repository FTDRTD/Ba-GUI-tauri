<script lang="ts">
  import { onMount } from 'svelte';
  import { tradingMonitor } from '$lib/services/monitor';
  import { format } from 'date-fns';
  import { zhCN } from 'date-fns/locale';

  let signals: any[] = [];
  let showSignals = true;
  let selectedPair: string | null = null;
  let monitoredPairs: string[] = [];

  // 格式化时间
  function formatTime(timestamp: number) {
    return format(new Date(timestamp), 'MM-dd HH:mm:ss', { locale: zhCN });
  }

  // 获取信号类型的中文描述
  function getSignalTypeText(type: string) {
    switch (type) {
      case 'strong_buy': return '强烈买入';
      case 'buy': return '买入';
      case 'strong_sell': return '强烈卖出';
      case 'sell': return '卖出';
      default: return type;
    }
  }

  // 获取信号类型的样式类
  function getSignalTypeClass(type: string) {
    switch (type) {
      case 'strong_buy':
      case 'buy':
        return 'buy';
      case 'strong_sell':
      case 'sell':
        return 'sell';
      default:
        return '';
    }
  }

  onMount(() => {
    // 监听交易信号
    tradingMonitor.onSignal((signal) => {
      signals = [signal, ...signals].slice(0, 50); // 保留最近50个信号
    });

    // 获取监控的交易对列表
    monitoredPairs = tradingMonitor.getMonitoredPairs();
  });

  // 过滤信号
  $: filteredSignals = selectedPair
    ? signals.filter(s => s.symbol === selectedPair)
    : signals;
</script>

<div class="trading-signals" class:collapsed={!showSignals}>
  <div class="header">
    <div class="header-main">
      <button class="toggle-btn" on:click={() => showSignals = !showSignals}>
        {showSignals ? '▼' : '▶'} 交易信号
      </button>
      {#if showSignals}
        <select 
          bind:value={selectedPair}
          class="pair-select"
        >
          <option value={null}>所有交易对</option>
          {#each monitoredPairs as pair}
            <option value={pair}>{pair}</option>
          {/each}
        </select>
      {/if}
    </div>
  </div>

  {#if showSignals}
    <div class="signals-container">
      {#if filteredSignals.length === 0}
        <div class="no-signals">暂无交易信号</div>
      {:else}
        {#each filteredSignals as signal (signal.timestamp)}
          <div class="signal-item" class:buy={signal.type === 'buy' || signal.type === 'strong_buy'} class:sell={signal.type === 'sell' || signal.type === 'strong_sell'}>
            <div class="signal-header">
              <span class="symbol">{signal.symbol}</span>
              <span class="type">{getSignalTypeText(signal.type)}</span>
              <span class="time">{formatTime(signal.timestamp)}</span>
            </div>
            <div class="signal-content">
              <div class="price">价格: {signal.price.toFixed(2)}</div>
              <div class="indicators">
                <div class="indicator">
                  <span class="label">RSI:</span>
                  <span class="value {signal.indicators.rsi > 70 ? 'overbought' : signal.indicators.rsi < 30 ? 'oversold' : ''}">
                    {signal.indicators.rsi.toFixed(2)}
                  </span>
                </div>
                <div class="indicator">
                  <span class="label">MACD:</span>
                  <span class="value {signal.indicators.macd.histogram > 0 ? 'positive' : 'negative'}">
                    {signal.indicators.macd.histogram.toFixed(2)}
                  </span>
                </div>
              </div>
              <div class="reasons">
                {#each signal.reasons as reason}
                  <div class="reason">{reason}</div>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .trading-signals {
    background: var(--panel-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin: 1rem;
    transition: all 0.3s ease;
  }

  .trading-signals.collapsed {
    margin: 0.5rem 1rem;
  }

  .header {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .toggle-btn {
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .pair-select {
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .signals-container {
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .signal-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin-bottom: 0.5rem;
    padding: 0.75rem;
    transition: all 0.2s ease;
  }

  .signal-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .signal-item.buy {
    border-left: 3px solid #26a69a;
  }

  .signal-item.sell {
    border-left: 3px solid #ef5350;
  }

  .signal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .symbol {
    font-weight: 500;
    font-size: 1.1rem;
  }

  .type {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .buy .type {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
  }

  .sell .type {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
  }

  .time {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .signal-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .price {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 500;
  }

  .indicators {
    display: flex;
    gap: 1rem;
  }

  .indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .value {
    font-family: monospace;
    font-size: 0.9rem;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
  }

  .value.overbought {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
  }

  .value.oversold {
    color: #26a69a;
    background: rgba(38, 166, 154, 0.1);
  }

  .value.positive {
    color: #26a69a;
  }

  .value.negative {
    color: #ef5350;
  }

  .reasons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .reason {
    background: var(--bg-primary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .no-signals {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .header-main {
      flex-direction: column;
      align-items: stretch;
    }

    .pair-select {
      width: 100%;
    }

    .indicators {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style> 