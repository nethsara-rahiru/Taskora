/**
 * StorageManager - Handles local caching, key serialization, TTL checks, and offline queue storage.
 */
const StorageManager = {
  PREFIX: 'taskora_cache_',
  OFFLINE_QUEUE_KEY: 'taskora_offline_queue',
  owner: (() => { try { return localStorage.getItem('taskora_cache_owner'); } catch (_) { return null; } })(),
  memory: new Map(),
  key(key) { return this.PREFIX + (this.owner ? `${this.owner}:` : '') + key; },
  bindUser(id) {
    id = String(id);
    let legacyQueue = null;
    if (!this.owner) {
      try {
        const previous = JSON.parse(localStorage.getItem(this.PREFIX + 'req_/auth/me') || 'null');
        if (String(previous?.data?.user?._id) === id) {
          const queue = JSON.parse(localStorage.getItem(this.OFFLINE_QUEUE_KEY) || '[]');
          if (Array.isArray(queue)) legacyQueue = queue;
        }
      } catch (_) {}
    }
    if (this.owner !== id) this.clearAllCache();
    this.owner = id;
    try { localStorage.setItem('taskora_cache_owner', id); } catch (_) {}
    if (legacyQueue) { this.saveOfflineQueue(legacyQueue); try { localStorage.removeItem(this.OFFLINE_QUEUE_KEY); } catch (_) {} }
  },
  signOut() {
    this.clearAllCache(); this.owner = null;
    try { localStorage.removeItem('taskora_cache_owner'); } catch (_) {}
  },
  queueKey() { return this.OFFLINE_QUEUE_KEY + (this.owner ? `:${this.owner}` : ''); },

  /**
   * Save data into local storage with a timestamp wrapper
   */
  save(key, data) {
    if (!this.owner) return false;
    try {
      const payload = {
        timestamp: Date.now(),
        data: data
      };
      this.memory.set(this.key(key), payload);
      localStorage.setItem(this.key(key), JSON.stringify(payload));
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
      const raw = localStorage.getItem(this.key(key));
      if (!raw) return this.memory.get(this.key(key))?.data ?? null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch (e) {
      console.warn('[StorageManager] Failed to parse cached key:', key, e);
      return this.memory.get(this.key(key))?.data ?? null;
    }
  },

  /**
   * Get timestamp of when the cached data was stored
   */
  getTimestamp(key) {
    try {
      const raw = localStorage.getItem(this.key(key));
      if (!raw) return this.memory.get(this.key(key))?.timestamp || 0;
      const parsed = JSON.parse(raw);
      return parsed.timestamp || 0;
    } catch (e) {
      return this.memory.get(this.key(key))?.timestamp || 0;
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
    this.memory.delete(this.key(key));
    try {
      localStorage.removeItem(this.key(key));
    } catch (e) {}
  },

  /**
   * Optimistically update a single task item in cached 'tasks' object/array
   */
  updateTaskInCache(taskId, patch) {
    const cached = this.get('tasks');
    if (!cached || !cached.tasks) return;
    const idx = cached.tasks.findIndex(t => t._id === taskId);
    if (idx !== -1) {
      cached.tasks[idx] = { ...cached.tasks[idx], ...patch };
      this.save('tasks', cached);
    }
  },

  /**
   * Optimistically remove a task item from cached 'tasks'
   */
  removeTaskFromCache(taskId) {
    const cached = this.get('tasks');
    if (!cached || !cached.tasks) return;
    cached.tasks = cached.tasks.filter(t => t._id !== taskId);
    this.save('tasks', cached);
  },

  /**
   * Clear all taskora cache items
   */
  clearAllCache() {
    this.memory.clear();
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
    if (!this.owner) return [];
    try {
      const raw = localStorage.getItem(this.queueKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  enqueueOfflineAction(action) {
    if (!this.owner) throw new Error('Sign in before saving offline changes.');
    const queue = this.getOfflineQueue();
    queue.push({ ...action, timestamp: Date.now(), id: 'action_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) });
    try {
      localStorage.setItem(this.queueKey(), JSON.stringify(queue));
    } catch (e) {}
  },

  clearOfflineQueue() {
    try {
      localStorage.removeItem(this.queueKey());
      localStorage.removeItem(this.OFFLINE_QUEUE_KEY);
    } catch (e) {}
  },

  saveOfflineQueue(queue) {
    if (!this.owner) return;
    try {
      localStorage.setItem(this.queueKey(), JSON.stringify(queue));
    } catch (e) {}
  }
};

window.StorageManager = StorageManager;
