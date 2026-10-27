const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function source(file) { return fs.readFileSync(path.join(__dirname, '../../public/js', file), 'utf8'); }
function storageContext(blocked = false) {
  const values = new Map();
  const localStorage = { getItem(key) { if (blocked) throw Error('Storage blocked'); return values.get(key) ?? null; }, setItem(key, value) { if (blocked) throw Error('Storage blocked'); values.set(key, value); }, removeItem: key => values.delete(key), key: i => [...values.keys()][i], get length() { return values.size; } };
  const context = { window: {}, localStorage, console: { warn() {} } };
  vm.runInNewContext(source('storage.js'), context); return { store: context.window.StorageManager, values };
}
test('cached reads are cleared and queued writes stay isolated by account', () => {
  const { store, values } = storageContext();
  store.bindUser('a'); store.save('tasks', { tasks: ['private-a'] }); store.enqueueOfflineAction({ method: 'POST', endpoint: '/tasks' });
  assert.equal(store.get('tasks').tasks[0], 'private-a'); assert.equal(store.getOfflineQueue().length, 1);
  store.bindUser('b'); assert.equal(store.get('tasks'), null); assert.equal(store.getOfflineQueue().length, 0);
  assert(![...values.values()].join('').includes('private-a'));
  store.save('tasks', { tasks: ['private-b'] }); store.signOut(); assert.equal(store.owner, null); assert.equal(store.get('tasks'), null); assert.equal(store.getOfflineQueue().length, 0);
  store.bindUser('a'); assert.equal(store.getOfflineQueue().length, 1, 'pending writes survive until the same account signs back in');
});
test('blocked browser storage keeps the app functional using session memory', () => {
  const { store } = storageContext(true); store.bindUser('a'); store.save('projects', { projects: ['Work'] });
  assert.equal(store.get('projects').projects[0], 'Work'); store.remove('projects'); assert.equal(store.get('projects'), null);
});
test('cached page data renders before the network settles and unchanged refreshes do not redraw', async () => {
  const cache = new Map([['tasks', { tasks: ['old'] }]]), requests = [];
  const context = { window: {}, document: { visibilityState: 'visible' }, console, API: { get: () => new Promise(resolve => requests.push(resolve)) }, StorageManager: { owner: 'a', get: key => cache.get(key) ?? null, save: (key, data) => cache.set(key, data) } };
  vm.runInNewContext(source('sync.js'), context); const sync = context.window.SyncManager; const seen = [];
  await sync.load('tasks', '/tasks', data => seen.push(data.tasks[0])); assert.deepEqual(seen, ['old']);
  const pending = sync._inFlight.tasks; requests.shift()({ tasks: ['new'] }); await pending; assert.deepEqual(seen, ['old', 'new']);
  const fresh = sync._fetchAndCache('tasks', '/tasks'); requests.shift()({ tasks: ['new'] }); await fresh; assert.equal(seen.length, 2);
});
test('late responses from a previous account cannot populate a new account cache', async () => {
  const writes = []; let resolve;
  const context = { window: {}, console, API: { get: () => new Promise(done => resolve = done) }, StorageManager: { owner: 'a', get: () => null, save: (...args) => writes.push(args) } };
  vm.runInNewContext(source('sync.js'), context); const request = context.window.SyncManager._fetchAndCache('tasks', '/tasks');
  context.StorageManager.owner = 'b'; resolve({ tasks: ['private-a'] }); await request; assert.equal(writes.length, 0);
});
test('cached API reads return immediately, deduplicate refreshes, and save changed data', async () => {
  const cache = new Map([['req_/projects', { projects: ['old'] }]]); let resolve, calls = 0;
  const context = { window: {}, navigator: { onLine: true }, console, StorageManager: { owner: 'a', get: key => cache.get(key) ?? null, save: (key, data) => cache.set(key, data) }, fetch: () => { calls++; return new Promise(done => resolve = done); } };
  vm.runInNewContext(source('api.js') + '\nSyncIndicator.start = () => 1; SyncIndicator.finish = () => {};', context);
  const api = context.window.API, changed = [];
  assert.equal((await api.getCached('/projects', data => changed.push(data.projects[0]))).projects[0], 'old');
  await api.getCached('/projects'); assert.equal(calls, 1);
  const pending = api.reads.get('/projects'); resolve({ ok: true, json: async () => ({ data: { projects: ['new'] } }) }); await pending; await Promise.resolve();
  assert.deepEqual(changed, ['new']); assert.equal(cache.get('req_/projects').projects[0], 'new');
});

test('a read after a mutation does not reuse or cache a pre-mutation request', async () => {
  const cache = new Map(), resolvers = [];
  const context = { window: {}, navigator: { onLine: true }, console, StorageManager: { owner: 'a', get: key => cache.get(key) ?? null, save: (key, data) => cache.set(key, data) }, fetch: () => new Promise(resolve => resolvers.push(resolve)) };
  vm.runInNewContext(source('api.js') + '\nSyncIndicator.start = () => 1; SyncIndicator.finish = () => {};', context);
  const api = context.window.API, old = api.refresh('/ai/memory'); api.epoch = 1; const fresh = api.refresh('/ai/memory');
  assert.notEqual(old, fresh); assert.equal(resolvers.length, 2);
  resolvers[0]({ ok: true, json: async () => ({ data: { revision: 0, memories: [] } }) }); await old;
  assert.equal(cache.has('req_/ai/memory'), false);
  resolvers[1]({ ok: true, json: async () => ({ data: { revision: 1, memories: ['new'] } }) }); await fresh;
  assert.equal(cache.get('req_/ai/memory').revision, 1);
});

test('legacy queued edits migrate only when the old cached profile matches the verified account', () => {
  const { store, values } = storageContext();
  values.set('taskora_cache_req_/auth/me', JSON.stringify({ data: { user: { _id: 'a' } } }));
  values.set('taskora_offline_queue', JSON.stringify([{ method: 'POST', endpoint: '/tasks', body: { title: 'Unsynced task' } }]));
  store.bindUser('a'); assert.equal(store.getOfflineQueue()[0].body.title, 'Unsynced task'); assert.equal(values.has('taskora_offline_queue'), false);
  const other = storageContext();
  other.values.set('taskora_cache_req_/auth/me', JSON.stringify({ data: { user: { _id: 'a' } } }));
  other.values.set('taskora_offline_queue', JSON.stringify([{ endpoint: '/tasks' }])); other.store.bindUser('b');
  assert.equal(other.store.getOfflineQueue().length, 0); assert.equal(other.values.has('taskora_offline_queue'), true);
});
