const CACHE = 'taskora-shell-v1';
const ASSETS = ["/projects.html", "/timetables.html", "/calendar.html", "/weather.html", "/login.html", "/assistant.html", "/register.html", "/settings.html", "/index.html", "/dashboard.html", "/tasks.html", "/js/app.js", "/js/daily-advice.js", "/js/tasks.js", "/js/sync.js", "/js/auth.js", "/js/event-timing.js", "/js/settings.js", "/js/calendar.js", "/js/ai-memory.js", "/js/api.js", "/js/weather-chart.js", "/js/navigation.js", "/js/location-settings.js", "/js/schedule-rules.js", "/js/storage.js", "/js/timetables.js", "/js/weather.js", "/js/projects.js", "/js/ai-settings.js", "/js/ai.js", "/js/loading-ui.js", "/css/responsive.css", "/css/components.css", "/css/main.css", "/css/dashboard.css", "/js/components/notification.js", "/js/components/sidebar.js", "/js/components/modal.js", "/js/components/task-card.js"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('taskora-shell-') && key !== CACHE).map(key => caches.delete(key))))]));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!ASSETS.includes(url.pathname) && url.pathname !== '/') return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (await caches.match(url.pathname === '/' ? '/index.html' : url.pathname)) || Response.error()));
});
