<script lang="ts">
  import TradingChart from '$lib/components/TradingChart.svelte';
  import OrderBook from '$lib/components/OrderBook.svelte';
  import TradingPairs from '$lib/components/TradingPairs.svelte';
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
    if (isDark) {
      root.style.setProperty('--bg-primary', '#0A0E17');
      root.style.setProperty('--bg-secondary', '#1A1F2E');
      root.style.setProperty('--border-color', '#2A2F3E');
      root.style.setProperty('--text-primary', '#E5E5E5');
      root.style.setProperty('--text-secondary', '#9E9E9E');
      root.style.setProperty('--accent-color', '#2962FF');
      root.style.setProperty('--hover-color', '#3A3F4E');
      root.style.setProperty('--success-color', '#1B5E20');
      root.style.setProperty('--panel-bg', '#1A1F2E');
    } else {
      root.style.setProperty('--bg-primary', '#FFFFFF');
      root.style.setProperty('--bg-secondary', '#F5F5F5');
      root.style.setProperty('--border-color', '#E0E0E0');
      root.style.setProperty('--text-primary', '#1A1A1A');
      root.style.setProperty('--text-secondary', '#666666');
      root.style.setProperty('--accent-color', '#1976D2');
      root.style.setProperty('--hover-color', '#E8E8E8');
      root.style.setProperty('--success-color', '#2E7D32');
      root.style.setProperty('--panel-bg', '#FFFFFF');
    }
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
  }

  header {
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .status-indicator {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .status-indicator.connected {
    background: var(--success-color);
    border-color: var(--success-color);
    color: white;
  }

  .last-update {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  main {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    overflow: hidden;
    position: relative;
    background: var(--bg-primary);
  }

  .left-panel, .right-panel {
    position: relative;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    transition: width 0.2s ease;
  }

  .center-panel {
    flex: 1;
    min-width: 0;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .collapse-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 40px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0 4px 4px 0;
    transition: all 0.2s ease;
  }

  .collapse-btn:hover {
    background: var(--hover-color);
  }

  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    background: transparent;
    transition: background-color 0.2s;
  }

  .left-panel .resize-handle {
    right: 0;
  }

  .right-panel .resize-handle {
    left: 0;
  }

  .resize-handle:hover {
    background: var(--hover-color);
  }

  @media (max-width: 1200px) {
    .left-panel, .right-panel {
      width: 250px !important;
    }
  }

  @media (max-width: 768px) {
    main {
      flex-direction: column;
    }
    
    .left-panel, .right-panel, .center-panel {
      width: 100% !important;
      height: 300px;
    }
  }
</style>
