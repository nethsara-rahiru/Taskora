/* Persistent shell: cache public view assets and mount each page in its own scope. */
const SiteNavigation = {
  paths: ['/dashboard.html', '/tasks.html', '/projects.html', '/calendar.html', '/timetables.html', '/settings.html', '/assistant.html', '/weather.html'],
  shared: new Set(['/js/storage.js', '/js/sync.js', '/js/loading-ui.js', '/js/api.js', '/js/auth.js', '/js/components/notification.js', '/js/components/modal.js', '/js/components/sidebar.js', '/js/components/task-card.js', '/js/event-timing.js', '/js/schedule-rules.js', '/js/app.js', '/js/navigation.js']),
  assets: new Map(), pending: new Map(), views: new Map(), styles: new Set(), active: null, sequence: 0,
  async read(url) {
    const token = SyncIndicator.start('GET', url);
    try {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) throw new Error(`Could not load ${url}`);
      return await response.text();
    } finally { SyncIndicator.finish(token); }
  },
  async asset(url) {
    if (this.assets.has(url)) return this.assets.get(url);
    if (this.pending.has(url)) return this.pending.get(url);
    const cached = StorageManager.get('asset:' + url);
    const request = this.read(url).then(text => { this.assets.set(url, text); StorageManager.save('asset:' + url, text); return text; }).finally(() => this.pending.delete(url));
    this.pending.set(url, request);
    if (cached !== null) { this.assets.set(url, cached); request.catch(() => {}); return cached; }
    return request;
  },
  parse(doc) {
    const main = doc.querySelector('.main-content');
    if (!main) throw new Error('This page does not have an application view.');
    return { html: main.innerHTML, title: doc.title,
      inlineStyles: [...doc.head.querySelectorAll('style:not([data-view-styles])')].map(style => style.textContent),
      styles: [...doc.querySelectorAll('link[rel="stylesheet"]')].map(link => new URL(link.getAttribute('href'), location.origin).pathname),
      scripts: [...doc.body.querySelectorAll('script')].map(script => ({ src: script.getAttribute('src'), text: script.textContent }))
        .filter(script => !script.src || !this.shared.has(script.src)) };
  },
  async prepare(path, initialDoc) {
    let view = this.views.get(path) || StorageManager.get('view:' + path);
    if (!view || initialDoc) {
      const doc = initialDoc || new DOMParser().parseFromString(await this.read(path), 'text/html');
      view = this.parse(doc); this.views.set(path, view); StorageManager.save('view:' + path, view);
    }
    const sources = await Promise.all(view.scripts.map(script => script.src ? this.asset(script.src) : script.text));
    await Promise.all(view.styles.map(async href => {
      if (this.styles.has(href) || document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) { this.styles.add(href); return; }
      const css = await this.asset(href);
      if (this.styles.has(href)) return;
      const style = document.createElement('style'); style.dataset.viewStyles = href; style.textContent = css;
      document.head.append(style); this.styles.add(href);
    }));
    return { ...view, source: sources.join('\n;\n') };
  },
  async init() {
    document.head.querySelectorAll('style').forEach(style => style.dataset.pageStyles = 'true');
    history.replaceState({ taskora: true }, '', location.href);
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !this.paths.includes(url.pathname)) return;
      event.preventDefault(); this.navigate(url.href).catch(error => { console.error(error); location.assign(url.href); });
    });
    window.addEventListener('popstate', () => this.navigate(location.href, { pop: true }).catch(() => location.reload()));
    await this.navigate(location.href, { initial: true, doc: document });
    // Warm every view without executing its controller or generating paid AI plans.
    this.preload();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  },
  async preload() {
    await Promise.allSettled(this.paths.map(async path => {
      const view = this.parse(new DOMParser().parseFromString(await this.read(path), 'text/html'));
      this.views.set(path, view); StorageManager.save('view:' + path, view);
      await Promise.all(view.scripts.filter(script => script.src).map(script => this.asset(script.src)));
      await this.prepare(path);
    }));
  },
  scope(root) {
    const scope = { active: true, root, controller: new AbortController(), timers: new Set(), intervals: new Set(), frames: new Set(), globals: new Map(), bodyNodes: new Set(), ready: [] };
    const listen = (target, type, callback, options) => {
      if (!scope.active) return;
      if (target === document && type === 'DOMContentLoaded') { scope.ready.push(callback); return; }
      target.addEventListener(type, callback, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: scope.controller.signal });
    };
    const query = (selector, all = false) => {
      const local = all ? root.querySelectorAll(selector) : root.querySelector(selector);
      return (all ? local.length : local) || !scope.active ? local : all ? document.querySelectorAll(selector) : document.querySelector(selector);
    };
    const body = new Proxy(document.body, { get: (target, key) => {
      if (['append', 'appendChild', 'prepend'].includes(key)) return (...nodes) => { if (scope.active) { nodes.forEach(node => { if (node instanceof Node) scope.bodyNodes.add(node); }); return target[key](...nodes); } };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    } });
    scope.document = new Proxy(document, { get: (target, key) => {
      if (key === 'body') return body;
      if (key === 'addEventListener') return (type, callback, options) => listen(document, type, callback, options);
      if (key === 'getElementById') return id => query('#' + CSS.escape(id));
      if (key === 'querySelector') return selector => query(selector);
      if (key === 'querySelectorAll') return selector => query(selector, true);
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    } });
    scope.setTimeout = (callback, delay, ...args) => {
      const id = setTimeout(() => { scope.timers.delete(id); if (scope.active) callback(...args); }, delay); scope.timers.add(id); return id;
    };
    scope.setInterval = (callback, delay, ...args) => { const id = setInterval(() => { if (scope.active) callback(...args); }, delay); scope.intervals.add(id); return id; };
    scope.window = new Proxy(window, {
      get: (target, key) => {
        if (key === 'document') return scope.document;
        if (key === 'addEventListener') return (type, callback, options) => listen(window, type, callback, options);
        if (key === 'setTimeout') return scope.setTimeout;
        if (key === 'setInterval') return scope.setInterval;
        const value = Reflect.get(target, key, target);
        return ['matchMedia', 'getComputedStyle', 'scrollTo', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? value.bind(target) : value;
      },
      set: (target, key, value) => { if (scope.active) { scope.globals.set(key, value); Reflect.set(target, key, value); } return true; }
    });
    scope.modal = new Proxy(Modal, { get: (target, key) => typeof target[key] === 'function' ? (...args) => scope.active ? target[key](...args) : undefined : target[key] });
    scope.dispose = () => {
      scope.active = false; scope.controller.abort(); scope.timers.forEach(clearTimeout); scope.intervals.forEach(clearInterval); scope.frames.forEach(cancelAnimationFrame); scope.bodyNodes.forEach(node => node.remove());
      for (const [key, value] of scope.globals) if (window[key] === value) Reflect.deleteProperty(window, key);
    };
    return scope;
  },
  async navigate(href, options = {}) {
    const url = new URL(href, location.href), sequence = ++this.sequence;
    if (!options.initial && url.pathname === location.pathname && url.search === location.search && !options.pop) {
      history.pushState({ taskora: true }, '', url); this.scrollHash(url.hash); Sidebar.closeMobileDrawer(); return;
    }
    const prepared = await this.prepare(url.pathname, options.doc);
    if (sequence !== this.sequence || !Auth.currentUser) return;
    if (this.active?.flush) await this.active.flush();
    if (sequence !== this.sequence || !Auth.currentUser) return;
    this.active?.dispose(); SyncManager._subscribers = {}; SyncManager._loads.clear(); Modal.close(); Sidebar.closeMobileDrawer();
    document.querySelector('.mobile-fab-btn')?.remove();
    const old = document.querySelector('.main-content'), root = document.createElement('div'); root.className = 'main-content'; root.innerHTML = prepared.html;
    old.replaceWith(root);
    if (!options.initial && !options.pop) history.pushState({ taskora: true }, '', url);
    document.head.querySelectorAll('style[data-page-styles]').forEach(style => style.remove());
    if (prepared.inlineStyles?.length) { const style = document.createElement('style'); style.dataset.pageStyles = 'true'; style.textContent = prepared.inlineStyles.join('\n'); document.head.append(style); }
    document.title = prepared.title;
    const scope = this.scope(root); this.active = scope;
    const run = new Function('window', 'document', 'setTimeout', 'setInterval', 'Modal', prepared.source + '\nreturn typeof flushPendingSaves === "function" ? flushPendingSaves : null;');
    scope.flush = run(scope.window, scope.document, scope.setTimeout, scope.setInterval, scope.modal);
    App.initPage(Auth.currentUser);
    for (const ready of scope.ready) {
      try { Promise.resolve(ready.call(scope.document, new Event('DOMContentLoaded'))).catch(error => console.error(error)); } catch (error) { console.error(error); }
    }
    if (!scope.ready.length && typeof window.loadCurrentPageData === 'function') window.loadCurrentPageData();
    this.scrollHash(url.hash);
  },
  scrollHash(hash) {
    if (!hash) return;
    requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' }));
  }
};
window.SiteNavigation = SiteNavigation;
