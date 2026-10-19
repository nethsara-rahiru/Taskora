const test = require('node:test');
const assert = require('node:assert/strict');
const timing = require('../../public/js/event-timing');
const event = { itemType: 'event', dueDate: '2026-11-05', startTime: '09:30' };

test('events accept an end time or calculate it from a duration', () => {
  assert.deepEqual(timing.resolve({ ...event, endTime: '11:00' }), { startTime: '09:30', endTime: '11:00' });
  assert.deepEqual(timing.resolve({ ...event, durationMinutes: 90 }), { startTime: '09:30', endTime: '11:00' });
  assert.deepEqual(timing.resolve({ ...event, startTime: '22:00', durationMinutes: 119 }), { startTime: '22:00', endTime: '23:59' });
});

test('events require a date, start, and a later same-day ending', () => {
  for (const input of [
    { ...event, dueDate: null, endTime: '10:00' }, { ...event, startTime: '', endTime: '10:00' },
    { ...event }, { ...event, endTime: '09:30' }, { ...event, endTime: '08:00' },
    { ...event, durationMinutes: 0 }, { ...event, durationMinutes: -1 },
    { ...event, durationMinutes: 1.5 }, { ...event, durationMinutes: 1000 },
    { ...event, endTime: '24:00' }
  ]) assert.throws(() => timing.resolve(input));
});

test('tasks have no start or end time even when converting an event', () => {
  assert.deepEqual(timing.resolve({ ...event, itemType: 'task', endTime: '11:00' }), { startTime: null, endTime: null });
});
