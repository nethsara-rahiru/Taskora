/**
 * SyncManager - Handles stale-while-revalidate data fetching, background polling,
 * online/offline sync, and offline mutation queue replay.
 */
const SyncManager = {
  // Map of cacheKey -> Set of subscriber callbacks
  _subscribers: {},

  // Background poll interval handle
  _pollInterval: null,

  // Default TTL: 2 minutes
  DEFAULT_TTL_MS: 2 * 60 * 1000,

  // Background poll period: 30 seconds
  POLL_INTERVAL_MS: 30 * 1000,

  // Tracks in-flight fetches to avoid duplicate requests
  _inFlight: {},

  /**
   * Subscribe to data updates for a specific cache key.
   * Callback is called with the latest data whenever it updates.
   */
  subscribe(cacheKey, callback) {
    if (!this._subscribers[cacheKey]) {
      this._subscribers[cacheKey] = new Set();
    }
    this._subscribers[cacheKey].add(callback);
    // Return unsubscribe function
    return () => this._subscribers[cacheKey].delete(callback);
  },

  /**
   * Notify all subscribers for a cache key with fresh data
   */
  _notify(cacheKey, data) {
    const subs = this._subscribers[cacheKey];
    if (subs) {
      subs.forEach(cb => {
        try { cb(data); } catch (e) {}
      });
    }
  },

  /**
   * Fetch fresh data from the API endpoint, cache it, and notify subscribers.
   */
  async _fetchAndCache(cacheKey, endpoint) {
    if (this._inFlight[cacheKey]) return;
    this._inFlight[cacheKey] = true;

    try {
      const data = await API.get(endpoint);
      StorageManager.save(cacheKey, data);
      this._notify(cacheKey, data);
      return data;
    } catch (err) {
      console.warn('[SyncManager] Background fetch failed for', cacheKey, err.message);
    } finally {
      this._inFlight[cacheKey] = false;
    }
  },

  /**
   * Stale-While-Revalidate: Instantly return cached data, then fetch fresh in background.
   * @param {string} cacheKey - Unique key for cache storage
   * @param {string} endpoint - API endpoint to fetch fresh data from
   * @param {function} callback - Called with data immediately (from cache) and again when fresh data arrives
   * @param {number} ttlMs - How old the cache must be before forcing background refresh
   */
  async load(cacheKey, endpoint, callback, ttlMs = this.DEFAULT_TTL_MS) {
    // 1. Serve from cache immediately if available
    const cached = StorageManager.get(cacheKey);
    if (cached !== null) {
      try { callback(cached, { fromCache: true }); } catch (e) {}
    }

    // 2. Always fetch fresh if cache is stale (or no cache)
    if (cached === null || StorageManager.isStale(cacheKey, ttlMs)) {
      const fresh = await this._fetchAndCache(cacheKey, endpoint);
      if (fresh !== undefined && fresh !== null) {
        try { callback(fresh, { fromCache: false }); } catch (e) {}
      }
    }

    // 3. Subscribe so future background polls also update this callback
    this.subscribe(cacheKey, data => {
      try { callback(data, { fromCache: false }); } catch (e) {}
    });
  },

  /**
   * Force refresh a single cache key from server now (e.g. after a mutation)
   */
  async invalidate(cacheKey, endpoint) {
    StorageManager.remove(cacheKey);
    await this._fetchAndCache(cacheKey, endpoint);
  },

  /**
   * Start the background polling interval
   */
  startPolling(keys) {
    // keys: array of { cacheKey, endpoint }
    this._polledKeys = keys || [];

    if (this._pollInterval) clearInterval(this._pollInterval);

    this._pollInterval = setInterval(async () => {
      if (!navigator.onLine) return;
      for (const { cacheKey, endpoint } of this._polledKeys) {
        await this._fetchAndCache(cacheKey, endpoint);
      }
    }, this.POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  },

  /**
   * Register network event listeners to sync on reconnect and tab focus
   */
  initNetworkListeners() {
    // Sync when coming back online
    window.addEventListener('online', async () => {
      console.info('[SyncManager] Back online — replaying offline queue and refreshing data.');
      await this.replayOfflineQueue();
      for (const { cacheKey, endpoint } of (this._polledKeys || [])) {
        await this._fetchAndCache(cacheKey, endpoint);
      }
    });

    // Sync when tab becomes visible again
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        for (const { cacheKey, endpoint } of (this._polledKeys || [])) {
          if (StorageManager.isStale(cacheKey, 60 * 1000)) {
            await this._fetchAndCache(cacheKey, endpoint);
          }
        }
      }
    });
  },

  /**
   * Replay all queued offline mutations in order
   */
  async replayOfflineQueue() {
    const queue = StorageManager.getOfflineQueue();
    if (queue.length === 0) return;

    console.info(`[SyncManager] Replaying ${queue.length} offline action(s)...`);
    const remaining = [];

    for (const action of queue) {
      try {
        if (action.method === 'POST') {
          await API.post(action.endpoint, action.body);
        } else if (action.method === 'PUT') {
          await API.put(action.endpoint, action.body);
        } else if (action.method === 'DELETE') {
          await API.delete(action.endpoint);
        }
        console.info('[SyncManager] Replayed offline action:', action.endpoint);
      } catch (err) {
        console.warn('[SyncManager] Failed to replay action:', action.endpoint, err.message);
        remaining.push(action);
      }
    }

    StorageManager.saveOfflineQueue(remaining);

    if (remaining.length === 0) {
      if (window.Notifications) {
        Notifications.show('Your offline changes have been synced!', 'success');
      }
    }
  },

  /**
   * Wrap a mutation (POST/PUT/DELETE) with offline queue support.
   * If offline, queues action for later. If online, executes immediately.
   * @param {string} method - 'POST', 'PUT', or 'DELETE'
   * @param {string} endpoint - API endpoint
   * @param {object|null} body - Request body (for POST/PUT)
   * @param {object} opts - { optimisticUpdate: fn, invalidates: [{cacheKey, endpoint}] }
   */
  async mutate(method, endpoint, body = null, opts = {}) {
    if (!navigator.onLine) {
      StorageManager.enqueueOfflineAction({ method, endpoint, body });
      if (window.Notifications) {
        Notifications.show('You are offline. Changes will sync when you reconnect.', 'info');
      }
      return null;
    }

    let result;
    if (method === 'POST') result = await API.post(endpoint, body);
    else if (method === 'PUT') result = await API.put(endpoint, body);
    else if (method === 'DELETE') result = await API.delete(endpoint);

    // Invalidate related caches
    if (opts.invalidates) {
      for (const { cacheKey, endpoint: ep } of opts.invalidates) {
        await this.invalidate(cacheKey, ep);
      }
    }

    return result;
  }
};

window.SyncManager = SyncManager;
