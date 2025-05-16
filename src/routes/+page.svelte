<script lang="ts">
  import TradingChart from '$lib/components/TradingChart.svelte';
  import OrderBook from '$lib/components/OrderBook.svelte';
  import TradingPairs from '$lib/components/TradingPairs.svelte';
  import TradingSignals from '$lib/components/TradingSignals.svelte';
  import { onMount } from 'svelte';

  let selectedSymbol = 'BTCUSDT';
  let isLeftPanelCollapsed = false;
  let isRightPanelCollapsed = false;
  let isConnected = true;
  let lastUpdate = new Date();
  let isDarkMode = true;
  let chartKey = 0; // 用于强制图表重新渲染

  // 面板宽度状态
  let leftPanelWidth = 300;
  let rightPanelWidth = 300;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartWidth = 0;
  let activePanel: 'left' | 'right' | null = null;

  // 监听系统主题变化
  function updateTheme(e: MediaQueryListEvent | MediaQueryList) {
    isDarkMode = e.matches;
    document.documentElement.classList.toggle('light-mode', !isDarkMode);
    // 更新 CSS 变量
    updateThemeVariables(isDarkMode);
  }

  // 更新主题变量
  function updateThemeVariables(isDark: boolean) {
    const root = document.documentElement;
    const darkTheme = {
      '--bg-primary': '#0F172A',
      '--bg-secondary': '#1E293B',
      '--border-color': '#334155',
      '--text-primary': '#F8FAFC',
      '--text-secondary': '#94A3B8',
      '--accent-color': '#3B82F6',
      '--hover-color': '#475569',
      '--success-color': '#22C55E',
      '--panel-bg': '#1E293B',
      '--panel-header-bg': '#0F172A',
      '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)'
    };
    
    const lightTheme = {
      '--bg-primary': '#F8FAFC',
      '--bg-secondary': '#F1F5F9',
      '--border-color': '#E2E8F0',
      '--text-primary': '#0F172A',
      '--text-secondary': '#475569',
      '--accent-color': '#2563EB',
      '--hover-color': '#E2E8F0',
      '--success-color': '#16A34A',
      '--panel-bg': '#FFFFFF',
      '--panel-header-bg': '#F8FAFC',
      '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)'
    };

    const theme = isDark ? darkTheme : lightTheme;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  // 处理交易对选择
  function handlePairSelected(event: CustomEvent) {
    const newSymbol = event.detail.symbol;
    if (newSymbol !== selectedSymbol) {
      selectedSymbol = newSymbol;
      // 强制图表重新渲染
      chartKey++;
      // 更新最后更新时间
      lastUpdate = new Date();
      // 可以在这里添加其他交易对切换时的逻辑
      console.log(`切换到交易对: ${selectedSymbol}`);
    }
  }

  function startDrag(e: MouseEvent, panel: 'left' | 'right') {
    isDragging = true;
    activePanel = panel;
    dragStartX = e.clientX;
    dragStartWidth = panel === 'left' ? leftPanelWidth : rightPanelWidth;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  }

  function handleDrag(e: MouseEvent) {
    if (!isDragging || !activePanel) return;
    const delta = e.clientX - dragStartX;
    if (activePanel === 'left') {
      leftPanelWidth = Math.max(200, Math.min(500, dragStartWidth + delta));
    } else {
      rightPanelWidth = Math.max(200, Math.min(500, dragStartWidth - delta));
    }
  }

  function stopDrag() {
    isDragging = false;
    activePanel = null;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  onMount(() => {
    // 监听系统主题
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    updateTheme(darkModeMediaQuery);
    darkModeMediaQuery.addEventListener('change', updateTheme);

    // 模拟数据更新
    const updateInterval = setInterval(() => {
      lastUpdate = new Date();
    }, 1000);

    return () => {
      darkModeMediaQuery.removeEventListener('change', updateTheme);
      clearInterval(updateInterval);
    };
  });
</script>

<svelte:head>
  <style>
    :global(:root) {
      /* 深色模式变量 */
      --bg-primary: #0A0E17;
      --bg-secondary: #1A1F2E;
      --border-color: #2A2F3E;
      --text-primary: #E5E5E5;
      --text-secondary: #9E9E9E;
      --accent-color: #2962FF;
      --hover-color: #3A3F4E;
      --success-color: #1B5E20;
      --panel-bg: #1A1F2E;
    }

    :global(:root.light-mode) {
      /* 浅色模式变量 */
      --bg-primary: #FFFFFF;
      --bg-secondary: #F5F5F5;
      --border-color: #E0E0E0;
      --text-primary: #1A1A1A;
      --text-secondary: #666666;
      --accent-color: #1976D2;
      --hover-color: #E8E8E8;
      --success-color: #2E7D32;
      --panel-bg: #FFFFFF;
    }

    :global(body) {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    :global(*) {
      transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
    }
  </style>
</svelte:head>

<div class="trading-interface">
  <header>
    <div class="header-content">
      <h1>币安合约交易</h1>
      <div class="header-controls">
        <div class="status-indicator" class:connected={isConnected}>
          {isConnected ? '已连接' : '未连接'}
        </div>
        <div class="last-update">
          最后更新: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  </header>
  
  <main>
    <div class="left-panel" style:width={isLeftPanelCollapsed ? '40px' : leftPanelWidth + 'px'}>
      {#if !isLeftPanelCollapsed}
        <TradingPairs 
          bind:selectedPair={selectedSymbol}
          on:pairSelected={handlePairSelected}
        />
        <TradingSignals />
      {/if}
      <button 
        class="collapse-btn" 
        style:right={isLeftPanelCollapsed ? '0' : '-20px'}
        style:left="auto"
        on:click={() => isLeftPanelCollapsed = !isLeftPanelCollapsed}
      >
        {isLeftPanelCollapsed ? '→' : '←'}
      </button>
      {#if !isLeftPanelCollapsed}
        <div class="resize-handle" on:mousedown={(e) => startDrag(e, 'left')}></div>
      {/if}
    </div>
    
    <div class="center-panel">
      <TradingChart 
        key={chartKey}
        {selectedSymbol} 
        on:update={() => lastUpdate = new Date()}
      />
    </div>
    
    <div class="right-panel" style:width={isRightPanelCollapsed ? '40px' : rightPanelWidth + 'px'}>
      {#if !isRightPanelCollapsed}
        <OrderBook 
          key={chartKey}
          {selectedSymbol} 
          on:update={() => lastUpdate = new Date()}
        />
      {/if}
      <button 
        class="collapse-btn" 
        style:left={isRightPanelCollapsed ? '0' : 'auto'}
        style:right="auto"
        on:click={() => isRightPanelCollapsed = !isRightPanelCollapsed}
      >
        {isRightPanelCollapsed ? '←' : '→'}
      </button>
      {#if !isRightPanelCollapsed}
        <div class="resize-handle" on:mousedown={(e) => startDrag(e, 'right')}></div>
      {/if}
    </div>
  </main>
</div>

<style>
  .trading-interface {
    width: 100vw;
    height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  header {
    padding: 1rem 1.5rem;
    background: var(--panel-header-bg);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    position: relative;
    z-index: 10;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1920px;
    margin: 0 auto;
    width: 100%;
  }

  .header-content h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    background: linear-gradient(135deg, var(--accent-color), #60A5FA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.5px;
  }

  .header-controls {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
  }

  .status-indicator.connected {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.2);
    color: #22C55E;
  }

  .status-indicator.connected::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22C55E;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
    }
    70% {
      box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    }
  }

  .last-update {
    font-size: 0.875rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .last-update::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text-secondary);
    opacity: 0.5;
  }

  main {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
    background: var(--bg-primary);
  }

  .left-panel, .right-panel {
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    position: relative;
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-md);
    z-index: 5;
  }

  .center-panel {
    flex: 1;
    min-width: 0;
    background: var(--bg-primary);
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }

  .collapse-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 48px;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 0 4px 4px 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 1rem;
    z-index: 5;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
  }

  .collapse-btn:hover {
    background: var(--hover-color);
    color: var(--text-primary);
    box-shadow: var(--shadow-md);
  }

  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 4;
    transition: background-color 0.2s ease;
  }

  .left-panel .resize-handle {
    right: 0;
  }

  .right-panel .resize-handle {
    left: 0;
  }

  .resize-handle:hover {
    background: var(--accent-color);
    opacity: 0.5;
  }

  /* 添加滚动条样式 */
  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: var(--bg-secondary);
    border-radius: 4px;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: var(--border-color);
    border-radius: 4px;
    border: 2px solid var(--bg-secondary);
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: var(--hover-color);
  }

  /* 响应式设计 */
  @media (max-width: 1024px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .header-controls {
      width: 100%;
      justify-content: space-between;
    }
  }

  @media (max-width: 768px) {
    header {
      padding: 0.75rem 1rem;
    }

    .header-content h1 {
      font-size: 1.25rem;
    }

    .status-indicator {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
    }

    .last-update {
      font-size: 0.8125rem;
    }
  }
</style>
