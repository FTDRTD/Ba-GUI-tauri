import { writable } from 'svelte/store';

// 用户偏好设置接口
interface UserPreferences {
  theme: 'dark' | 'light';
  leftPanelWidth: number;
  rightPanelWidth: number;
  favorites: string[];
  selectedTimeframe: string;
  selectedIndicators: string[];
}

// 缓存键名常量
const STORAGE_KEYS = {
  PREFERENCES: 'user_preferences',
  FAVORITES: 'favorites',
  THEME: 'theme',
  PANEL_WIDTHS: 'panel_widths',
  TIMEFRAME: 'timeframe',
  INDICATORS: 'indicators'
};

// 创建可写的用户偏好设置store
const createPreferencesStore = () => {
  // 从localStorage加载初始值
  const loadPreferences = (): UserPreferences => {
    const defaultPreferences: UserPreferences = {
      theme: 'dark',
      leftPanelWidth: 300,
      rightPanelWidth: 300,
      favorites: [],
      selectedTimeframe: '1h',
      selectedIndicators: ['MA', 'RSI']
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
    } catch (error) {
      console.error('加载用户偏好设置失败:', error);
      return defaultPreferences;
    }
  };

  const { subscribe, set, update } = writable<UserPreferences>(loadPreferences());

  return {
    subscribe,
    // 更新单个设置项
    updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      update(prefs => {
        const newPrefs = { ...prefs, [key]: value };
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(newPrefs));
        return newPrefs;
      });
    },
    // 重置所有设置
    reset: () => {
      const defaultPreferences = loadPreferences();
      set(defaultPreferences);
      localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    }
  };
};

// 创建IndexedDB数据库管理类
class CacheDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'trading_cache';
  private readonly DB_VERSION = 1;

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建K线数据存储
        if (!db.objectStoreNames.contains('klines')) {
          const klinesStore = db.createObjectStore('klines', { keyPath: ['symbol', 'interval', 'timestamp'] });
          klinesStore.createIndex('symbol_interval', ['symbol', 'interval']);
        }

        // 创建订单簿数据存储
        if (!db.objectStoreNames.contains('orderbook')) {
          const orderbookStore = db.createObjectStore('orderbook', { keyPath: ['symbol', 'timestamp'] });
          orderbookStore.createIndex('symbol', 'symbol');
        }
      };
    });
  }

  // 存储K线数据
  async storeKlines(symbol: string, interval: string, data: any[]): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['klines'], 'readwrite');
      const store = transaction.objectStore('klines');

      // 删除旧数据
      const index = store.index('symbol_interval');
      const range = IDBKeyRange.bound([symbol, interval, 0], [symbol, interval, Infinity]);
      const deleteRequest = index.openCursor(range);

      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // 存储新数据
          const promises = data.map(candle => {
            return new Promise((resolve, reject) => {
              const request = store.put({
                symbol,
                interval,
                timestamp: candle.time,
                data: candle
              });
              request.onsuccess = () => resolve(undefined);
              request.onerror = () => reject(request.error);
            });
          });

          Promise.all(promises)
            .then(() => resolve())
            .catch(reject);
        }
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  // 获取K线数据
  async getKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<any[]> {
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['klines'], 'readonly');
      const store = transaction.objectStore('klines');
      const index = store.index('symbol_interval');
      const range = IDBKeyRange.bound(
        [symbol, interval, startTime],
        [symbol, interval, endTime]
      );

      const request = index.getAll(range);
      request.onsuccess = () => {
        const data = request.result.map(item => item.data);
        resolve(data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 存储订单簿数据
  async storeOrderBook(symbol: string, data: any): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orderbook'], 'readwrite');
      const store = transaction.objectStore('orderbook');

      const request = store.put({
        symbol,
        timestamp: Date.now(),
        data
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取最新的订单簿数据
  async getLatestOrderBook(symbol: string): Promise<any | null> {
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orderbook'], 'readonly');
      const store = transaction.objectStore('orderbook');
      const index = store.index('symbol');
      const range = IDBKeyRange.only(symbol);

      const request = index.openCursor(range, 'prev');
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          resolve(cursor.value.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 清理过期数据
  async cleanupOldData(maxAge: number): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    const cutoffTime = Date.now() - maxAge;

    // 清理K线数据
    await this.cleanupStore('klines', 'timestamp', cutoffTime);
    // 清理订单簿数据
    await this.cleanupStore('orderbook', 'timestamp', cutoffTime);
  }

  private async cleanupStore(storeName: string, timeField: string, cutoffTime: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value[timeField] < cutoffTime) {
            store.delete(cursor.primaryKey);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// 导出单例实例
export const cacheDB = new CacheDB();
export const preferences = createPreferencesStore();

// 初始化数据库
cacheDB.init().catch(console.error);

// 定期清理过期数据（默认保留7天）
setInterval(() => {
  cacheDB.cleanupOldData(7 * 24 * 60 * 60 * 1000).catch(console.error);
}, 24 * 60 * 60 * 1000); // 每24小时清理一次 