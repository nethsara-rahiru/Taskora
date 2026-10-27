// One indicator for all requests, including concurrent page loads and background sync.
const SyncIndicator = {
  pending: 0, requests: new Map(), element: null, status: null, hideTimer: null, statusTimer: null,
  start(method = 'GET', endpoint = '') {
    clearTimeout(this.hideTimer);
    const token = Symbol('request'); this.requests.set(token, { method, endpoint }); this.pending = this.requests.size;
    if (!this.element) {
      this.element = document.createElement('div'); this.element.className = 'sync-loading-bar';
      this.element.setAttribute('role', 'progressbar'); document.body.appendChild(this.element);
      this.status = document.createElement('div'); this.status.className = 'request-status'; this.status.hidden = true;
      this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
      const spinner = document.createElement('span'); spinner.className = 'loading-spinner'; spinner.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.className = 'request-status-label'; this.status.append(spinner, label); document.body.appendChild(this.status);
    }
    this.element.hidden = false; this.update(); return token;
  },
  update() {
    const writes = [...this.requests.values()].filter(request => request.method !== 'GET');
    const current = writes.at(-1);
    this.element.setAttribute('aria-label', current ? 'Saving changes' : 'Loading data');
    clearTimeout(this.statusTimer);
    if (!current) { this.status.hidden = true; return; }
    const label = current.endpoint === '/ai/plan' ? 'Generating suggestions…'
      : /\/test$/.test(current.endpoint) ? 'Testing connection…'
      : current.endpoint === '/auth/login' ? 'Signing in…' : current.endpoint === '/auth/register' ? 'Creating account…'
      : current.endpoint === '/auth/logout' ? 'Signing out…' : current.method === 'DELETE' ? 'Deleting…' : 'Saving changes…';
    this.status.querySelector('.request-status-label').textContent = label;
    this.statusTimer = setTimeout(() => { if ([...this.requests.values()].some(request => request.method !== 'GET')) this.status.hidden = false; }, 120);
  },
  finish(token) {
    this.requests.delete(token); this.pending = this.requests.size;
    if (this.pending) { this.update(); return; }
    clearTimeout(this.statusTimer);
    this.hideTimer = setTimeout(() => { if (!this.pending) { this.element.hidden = true; this.status.hidden = true; } }, 150);
  }
};

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const method = options.method || 'GET';
    const cacheable = method === 'GET' && endpoint !== '/auth/me' && !!StorageManager.owner;
    const owner = StorageManager.owner;
    const epoch = this.epoch || 0;
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
      if (!cacheable) throw new Error('Connect to the internet to verify your session.');
      const cacheKey = 'req_' + endpoint;
      const cached = StorageManager.get(cacheKey);
      if (cached !== null) {
        console.info('[API] Offline — serving from local cache:', endpoint);
        return cached;
      }
      throw new Error('You are offline and no cached data is available.');
    }

    const requestActivity = SyncIndicator.start(method, endpoint);
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
      if (cacheable && owner === StorageManager.owner && epoch === (this.epoch || 0)) {
        const cacheKey = 'req_' + endpoint;
        StorageManager.save(cacheKey, data.data);
      }

      if (method !== 'GET' && owner === StorageManager.owner) {
        this.epoch = (this.epoch || 0) + 1;
        if (endpoint.startsWith('/ai/memory')) StorageManager.save('req_/ai/memory', data.data);
        if (endpoint.startsWith('/ai/settings')) StorageManager.save('req_/ai/settings', data.data);
        if (window.Auth && Auth.currentUser) {
          if (endpoint === '/user/location') Auth.currentUser.weatherLocation = data.data.location;
          if (endpoint === '/user' && data.data.user) Auth.currentUser = data.data.user;
          StorageManager.save('user', Auth.currentUser);
        }
      }
      return data.data;
    } catch (error) {
      // Network failure on GET: try cache fallback
      if (cacheable && owner === StorageManager.owner && (error.name === 'TypeError' || !navigator.onLine)) {
        const cacheKey = 'req_' + endpoint;
        const cached = StorageManager.get(cacheKey);
        if (cached !== null) {
          console.info('[API] Network error — serving from local cache:', endpoint);
          return cached;
        }
      }
      if (error.status === 401 && !endpoint.startsWith('/auth/') && window.Auth) Auth.expire();
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    } finally {
      SyncIndicator.finish(requestActivity);
    }
  },

  reads: new Map(),
  refresh(endpoint) {
    const previous = this.reads.get(endpoint), epoch = this.epoch || 0;
    if (previous && previous.cacheEpoch === epoch && previous.cacheOwner === StorageManager.owner) return previous;
    const request = this.get(endpoint).finally(() => { if (this.reads.get(endpoint) === request) this.reads.delete(endpoint); });
    request.cacheEpoch = epoch; request.cacheOwner = StorageManager.owner;
    this.reads.set(endpoint, request); return request;
  },
  async getCached(endpoint, onFresh) {
    const cached = StorageManager.get('req_' + endpoint), epoch = this.epoch || 0;
    const request = this.refresh(endpoint);
    if (cached !== null) {
      request.then(data => { if (onFresh && epoch === (this.epoch || 0) && JSON.stringify(data) !== JSON.stringify(cached)) onFresh(data); }).catch(() => {});
      return cached;
    }
    return request;
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
