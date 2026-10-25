const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../services/ai-validation');

test('relative dates use the user timezone rather than server timezone', () => {
  const instant = new Date('2026-10-25T20:00:00Z');
  assert.equal(rules.localDate(instant, 'Asia/Colombo'), '2026-10-26');
  assert.equal(rules.localDate(instant, 'America/Los_Angeles'), '2026-10-25');
  assert.equal(rules.addDays('2026-12-29', 6), '2027-01-04');
});
test('settings validate model, timezone, working hours, and task duration', () => {
  for (const value of [{ model: 'arbitrary' }, { timezone: 'Invalid/Zone' }, { enabled: 'yes' }, { workdayStart: '20:00' }, { defaultDuration: 0 }]) {
    assert.throws(() => rules.settings(value));
  }
  assert.equal(rules.settings({ timezone: 'Asia/Colombo', defaultDuration: 45 }).defaultDuration, 45);
});
test('AI proposals are sanitized and cannot change task status or ownership', () => {
  const value = rules.values({ title: 'Write report', itemType: 'task', dueDate: '2026-11-05', dueTime: '09:00', status: 'completed', userId: 'other', endTime: '10:00' });
  assert.equal(value.status, undefined); assert.equal(value.userId, undefined); assert.equal(value.endTime, null);
  assert.throws(() => rules.values({ title: 'Bad date', dueDate: '2026-02-30' }));
  assert.throws(() => rules.values({ title: 'Bad event', itemType: 'event', dueDate: '2026-11-05', dueTime: '09:00', endTime: '08:00' }));
  const event = rules.values({ title: 'Call', itemType: 'event', dueDate: '2026-11-05', dueTime: '09:00', durationMinutes: 45 });
  assert.equal(event.endTime, '09:45');
});
test('conflict checks include tasks, events, and active schedules, respecting skips', () => {
  const tasks = [{ _id: 't1', title: 'Busy task', status: 'pending', dueDate: '2026-11-05', dueTime: '09:00' },
    { _id: 'done', title: 'Done', status: 'completed', dueDate: '2026-11-05', dueTime: '11:00' }];
  const schedules = [{ title: 'Work', slots: [{ dayOfWeek: 4, subject: 'Meeting', startTime: '10:00', endTime: '11:00' }] },
    { title: 'Paused', isPaused: true, slots: [{ dayOfWeek: 4, subject: 'Paused meeting', startTime: '12:00', endTime: '13:00' }] },
    { title: 'Skipped', skipRanges: [{ start: '2026-11-05', end: '2026-11-05' }], slots: [{ dayOfWeek: 4, subject: 'Skipped', startTime: '14:00', endTime: '15:00' }] }];
  const busy = rules.busyIntervals(tasks, schedules, '2026-11-05', '2026-11-05', 30);
  assert.equal(busy.length, 2);
  assert.deepEqual(rules.conflicts({ dueDate: '2026-11-05', dueTime: '09:15', itemType: 'task' }, busy, null), ['Busy task']);
  assert.deepEqual(rules.conflicts({ dueDate: '2026-11-05', dueTime: '09:15', itemType: 'task' }, busy, 't1'), []);
  assert.deepEqual(rules.conflicts({ dueDate: '2026-11-05', dueTime: '09:30', itemType: 'task' }, busy), []);
  assert.deepEqual(rules.conflicts({ dueDate: '2026-11-05', dueTime: '10:00', itemType: 'event', endTime: '10:45' }, busy), ['Work: Meeting']);
});
