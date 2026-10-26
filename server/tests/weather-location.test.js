const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLocation } = require('../lib/weather-location');
test('saved locations validate coordinates and store only a bounded name and rounded coordinates', () => {
  assert.deepEqual(validateLocation({ name: ' Colombo ', latitude: 6.92712345, longitude: 79.8612345, userId: 'other-user', enabled: true }), { name: 'Colombo', latitude: 6.9271, longitude: 79.8612 });
  assert.deepEqual(validateLocation({ name: 'Equator', latitude: 0, longitude: 0 }), { name: 'Equator', latitude: 0, longitude: 0 });
  for (const value of [null, [], {}, { name: 'x', latitude: '6', longitude: 79 }, { name: 'x', latitude: 91, longitude: 79 }, { name: 'x', latitude: 6, longitude: -181 }, { name: 'x', latitude: NaN, longitude: 79 }, { name: 'x'.repeat(161), latitude: 6, longitude: 79 }]) assert.throws(() => validateLocation(value), { status: 400 });
});
