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
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    font-size: 1.1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-icon {
    color: var(--accent-color);
    font-size: 1.2rem;
  }

  .controls {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .timeframe-select {
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .timeframe-select:hover {
    border-color: var(--accent-color);
  }

  .timeframe-select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .refresh-btn {
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
  }

  .refresh-btn:hover {
    background: var(--hover-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .refresh-btn:active {
    transform: translateY(0);
  }

  .refresh-btn.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .signals-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .signal-group {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .group-header {
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .group-header:hover {
    background: var(--hover-color);
  }

  .group-title {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .group-icon {
    color: var(--accent-color);
    font-size: 1.1rem;
  }

  .group-count {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-secondary);
  }

  .group-content {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .signal-item {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .signal-item:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .signal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .signal-title {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .signal-type {
    font-size: 0.7rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .signal-type.buy {
    background: rgba(38, 166, 154, 0.1);
    color: #26a69a;
  }

  .signal-type.sell {
    background: rgba(239, 83, 80, 0.1);
    color: #ef5350;
  }

  .signal-time {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .signal-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    font-size: 0.9rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .detail-value {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    letter-spacing: -0.5px;
  }

  .detail-value.positive {
    color: #26a69a;
  }

  .detail-value.negative {
    color: #ef5350;
  }

  .signal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .action-btn:hover {
    background: var(--hover-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .action-btn.primary {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .loading, .error {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .error {
    color: #ef5350;
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .controls {
      justify-content: space-between;
    }

    .signal-details {
      grid-template-columns: 1fr;
    }

    .signal-actions {
      flex-direction: column;
    }
  }
</style> 