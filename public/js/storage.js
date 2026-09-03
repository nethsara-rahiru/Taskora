/**
 * StorageManager - Handles local caching, key serialization, TTL checks, and offline queue storage.
 */
const StorageManager = {
  PREFIX: 'taskora_cache_',
  OFFLINE_QUEUE_KEY: 'taskora_offline_queue',

  /**
   * Save data into local storage with a timestamp wrapper
   */
  save(key, data) {
    try {
      const payload = {
        timestamp: Date.now(),
        data: data
      };
      localStorage.setItem(this.PREFIX + key, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('[StorageManager] Failed to save key:', key, e);
      return false;
    }
  },

  /**
   * Retrieve cached data by key
   */
  get(key) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch (e) {
      console.warn('[StorageManager] Failed to parse cached key:', key, e);
      return null;
    }
  },

  /**
   * Get timestamp of when the cached data was stored
   */
  getTimestamp(key) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return parsed.timestamp || 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Check if cache entry is older than specified ttl in milliseconds
   */
  isStale(key, ttlMs = 60000) {
    const ts = this.getTimestamp(key);
    if (!ts) return true;
    return Date.now() - ts > ttlMs;
  },

  /**
   * Remove a single cache key
   */
  remove(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (e) {}
  },

  /**
   * Clear all taskora cache items
   */
  clearAllCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  },

  /**
   * Manage offline actions queue
   */
  getOfflineQueue() {
    try {
      const raw = localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  enqueueOfflineAction(action) {
    const queue = this.getOfflineQueue();
    queue.push({ ...action, timestamp: Date.now(), id: 'action_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) });
    try {
      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {}
  },

  clearOfflineQueue() {
    try {
      localStorage.removeItem(this.OFFLINE_QUEUE_KEY);
    } catch (e) {}
  },

  saveOfflineQueue(queue) {
    try {
      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {}
  }
};

window.StorageManager = StorageManager;
