const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const EventTiming = require('../../public/js/event-timing');

function service(record) {
  const model = {
    findOne: async () => record && ({ ...record, toObject: () => ({ ...record }) }),
    findOneAndUpdate: async (query, update) => ({ ...record, ...update }),
    create: async data => data
  };
  const context = { module: { exports: {} }, require: name =>
    name.endsWith('/Task') ? model : name.endsWith('/Reminder') ? {} : EventTiming, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/task.service.js'), 'utf8'), context);
  return context.module.exports;
}

test('completing through an ordinary edit records completion time', async () => {
  const before = Date.now();
  const result = await service({ status: 'pending', itemType: 'task', completedAt: null })
    .updateTask('user', 'task', { status: 'completed' });
  assert.equal(result.status, 'completed');
  assert(result.completedAt.getTime() >= before && result.completedAt.getTime() <= Date.now());
});

test('editing an already completed task preserves its completion time; reopening clears it', async () => {
  const completedAt = new Date('2026-11-05T10:00:00Z');
  const api = service({ status: 'completed', itemType: 'task', completedAt });
  assert.equal((await api.updateTask('user', 'task', { title: 'Edited' })).completedAt, completedAt);
  assert.equal((await api.updateTask('user', 'task', { status: 'completed' })).completedAt, completedAt);
  assert.equal((await api.updateTask('user', 'task', { status: 'pending' })).completedAt, null);
});

test('creating a completed task records time; pending tasks cannot retain stale timestamps', async () => {
  const api = service(null);
  assert((await api.createTask('user', { title: 'Done', status: 'completed' })).completedAt instanceof Date);
  assert.equal((await api.createTask('user', { title: 'Pending', completedAt: new Date() })).completedAt, null);
});
