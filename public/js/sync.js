/**
 * SyncManager - Handles stale-while-revalidate data fetching, background polling,
 * mobile lifecycle integration, and offline mutation queue replay.
 */
const SyncManager = {
  // Map of cacheKey -> Set of subscriber callbacks
  _subscribers: {},

  // Background poll interval handle
  _pollInterval: null,

  // Default TTL: 2 minutes
  DEFAULT_TTL_MS: 2 * 60 * 1000,

  // Snappy poll period for mobile & desktop: 15 seconds
  POLL_INTERVAL_MS: 15 * 1000,

  // Tracks in-flight fetches to avoid duplicate concurrent requests
  _inFlight: {},

  // Debounce timer for mobile resume events
  _resumeDebounceTimer: null,

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
    if (this._inFlight[cacheKey]) return this._inFlight[cacheKey];
    const request = (async () => {
      try {
        const data = await API.get(endpoint);
        StorageManager.save(cacheKey, data);
        this._notify(cacheKey, data);
        return data;
      } catch (err) {
        console.warn('[SyncManager] Background fetch failed for', cacheKey, err.message);
      }
    })();
    this._inFlight[cacheKey] = request;
    try {
      return await request;
    } finally {
      if (this._inFlight[cacheKey] === request) delete this._inFlight[cacheKey];
    }
  },

  /**
   * Stale-While-Revalidate: Instantly return cached data, then fetch fresh in background.
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
   * Force refresh a single cache key from server now
   */
  async invalidate(cacheKey, endpoint) {
    // A request started before the mutation may still contain the old status.
    // Let it settle, then fetch the state after the mutation instead of skipping refresh.
    if (this._inFlight[cacheKey]) await this._inFlight[cacheKey];
    StorageManager.remove(cacheKey);
    await this._fetchAndCache(cacheKey, endpoint);
  },

  /**
   * Instantly revalidate all registered polling keys (used on mobile app resume/focus/online)
   */
  async forceRefreshAll() {
    if (!navigator.onLine || !this._polledKeys) return;
    for (const { cacheKey, endpoint } of this._polledKeys) {
      await this._fetchAndCache(cacheKey, endpoint);
    }
  },

  /**
   * Debounced version of forceRefreshAll to prevent burst network calls on mobile resume
   */
  triggerMobileResumeSync() {
    clearTimeout(this._resumeDebounceTimer);
    this._resumeDebounceTimer = setTimeout(() => {
      this.forceRefreshAll();
    }, 200);
  },

  /**
   * Start the background polling interval
   */
  startPolling(keys) {
    this._polledKeys = keys || [];

    if (this._pollInterval) clearInterval(this._pollInterval);

    this._pollInterval = setInterval(async () => {
      if (!navigator.onLine) return;
      await this.forceRefreshAll();
    }, this.POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  },

  /**
   * Register mobile & desktop lifecycle event listeners for 0-delay sync
   */
  initNetworkListeners() {
    // 1. Reconnect listener
    window.addEventListener('online', async () => {
      console.info('[SyncManager] Network online — replaying offline queue and syncing instantly.');
      await this.replayOfflineQueue();
      this.triggerMobileResumeSync();
    });

    // 2. Page Visibility API (Mobile & Desktop tab switch)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.triggerMobileResumeSync();
      }
    });

    // 3. Mobile Safari/Chrome bfcache restoration event (when returning from another app or page)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted || document.visibilityState === 'visible') {
        this.triggerMobileResumeSync();
      }
    });

    // 4. Window Focus event (Mobile app unlock / screen wake up / window focus)
    window.addEventListener('focus', () => {
      this.triggerMobileResumeSync();
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
      } catch (err) {
        console.warn('[SyncManager] Failed to replay action:', action.endpoint, err.message);
        remaining.push(action);
      }
    }

    StorageManager.saveOfflineQueue(remaining);

    if (remaining.length === 0 && window.Notifications) {
      Notifications.show('Your offline changes have been synced!', 'success');
    }
  },

  /**
   * Wrap a mutation (POST/PUT/DELETE) with offline queue support and instant cache invalidation
   */
  async mutate(method, endpoint, body = null, opts = {}) {
    if (!navigator.onLine) {
      StorageManager.enqueueOfflineAction({ method, endpoint, body });
      if (window.Notifications) {
        Notifications.show('You are offline. Changes will sync when reconnected.', 'info');
      }
      return null;
    }

    let result;
    if (method === 'POST') result = await API.post(endpoint, body);
    else if (method === 'PUT') result = await API.put(endpoint, body);
    else if (method === 'DELETE') result = await API.delete(endpoint);

    // Invalidate related caches immediately
    if (opts.invalidates) {
      for (const { cacheKey, endpoint: ep } of opts.invalidates) {
        await this.invalidate(cacheKey, ep);
      }
    }

    return result;
  }
};

window.SyncManager = SyncManager;
