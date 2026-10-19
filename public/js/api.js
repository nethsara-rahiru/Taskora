// One indicator for all requests, including concurrent page loads and background sync.
const SyncIndicator = {
  pending: 0,
  element: null,
  hideTimer: null,

  start() {
    clearTimeout(this.hideTimer);
    this.pending++;
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.className = 'sync-loading-bar';
      this.element.setAttribute('role', 'progressbar');
      this.element.setAttribute('aria-label', 'Syncing data');
      document.body.appendChild(this.element);
    }
    this.element.hidden = false;
  },

  finish() {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) {
      // Bridge consecutive sync requests so the bar does not flicker between them.
      this.hideTimer = setTimeout(() => {
        if (this.pending === 0 && this.element) this.element.hidden = true;
      }, 150);
    }
  }
};

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const method = options.method || 'GET';
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'same-origin'
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    // If offline and it's a GET, return from StorageManager cache as fallback
    if (!navigator.onLine && method === 'GET') {
      const cacheKey = 'req_' + endpoint;
      const cached = StorageManager.get(cacheKey);
      if (cached !== null) {
        console.info('[API] Offline — serving from local cache:', endpoint);
        return cached;
      }
      throw new Error('You are offline and no cached data is available.');
    }

    SyncIndicator.start();
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error?.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMsg);
        error.code = data.error?.code || 'API_ERROR';
        error.status = response.status;
        throw error;
      }

      // Cache successful GET responses automatically
      if (method === 'GET') {
        const cacheKey = 'req_' + endpoint;
        StorageManager.save(cacheKey, data.data);
      }

      return data.data;
    } catch (error) {
      // Network failure on GET: try cache fallback
      if (method === 'GET' && (error.name === 'TypeError' || !navigator.onLine)) {
        const cacheKey = 'req_' + endpoint;
        const cached = StorageManager.get(cacheKey);
        if (cached !== null) {
          console.info('[API] Network error — serving from local cache:', endpoint);
          return cached;
        }
      }
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    } finally {
      SyncIndicator.finish();
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

window.API = API;
