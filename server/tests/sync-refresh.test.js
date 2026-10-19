const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('a mutation refresh waits for an old fetch then fetches fresh data', async () => {
  const requests = [];
  const cache = new Map();
  const context = { window: {}, console, API: { get: () => new Promise(resolve => requests.push(resolve)) },
    StorageManager: { save: (key, data) => cache.set(key, data), remove: key => cache.delete(key) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/sync.js'), 'utf8'), context);
  const sync = context.window.SyncManager;
  const first = sync._fetchAndCache('dashboard', '/dashboard');
  const refresh = sync.invalidate('dashboard', '/dashboard');
  assert.equal(requests.length, 1);
  requests[0]({ status: 'pending' });
  await first;
  // invalidate must initiate a new request, rather than accepting the old pending status.
  await Promise.resolve();
  assert.equal(requests.length, 2);
  requests[1]({ status: 'completed' });
  await refresh;
  assert.equal(cache.get('dashboard').status, 'completed');
});
