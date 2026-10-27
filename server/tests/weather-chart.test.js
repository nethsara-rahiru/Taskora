const test = require('node:test');
const assert = require('node:assert/strict');
const chart = require('../../public/js/weather-chart');

test('clear mild days sit at zero and hot sunny days rise above the baseline', () => {
  assert.equal(chart.score(0, 28, true), 0);
  assert.equal(chart.score(0, 24, true), 0);
  assert(chart.score(0, 35, true) > chart.score(0, 30, true));
  assert.equal(chart.score(0, 50, true), 100);
});
test('clouds and rain stay negative, even when it is hot', () => {
  assert(chart.score(2, 35, true) < 0);
  assert(chart.score(3, 35, true) < chart.score(2, 35, true));
  assert(chart.score(61, 35, true) < chart.score(3, 35, true));
  assert(chart.score(65, 35, true) < chart.score(61, 35, true));
  assert.equal(chart.score(95, 35, true), -100);
});
test('nighttime and unknown conditions are not presented as hot sunshine', () => {
  assert.equal(chart.score(0, 35, false), 0);
  assert.equal(chart.score(0, 35, null), 0);
  assert.equal(chart.score(null, 35, true), null);
  assert.equal(chart.score(999, 35, true), null);
  assert.equal(chart.score(0, null, true), 0);
});
test('hourly series starts with the current hour and spans 24 hours across midnight', () => {
  const times = Array.from({ length: 60 }, (_, index) => new Date(Date.UTC(2026, 9, 27, index)).toISOString().slice(0, 16));
  const result = chart.series({ current: { time: '2026-10-27T23:15' }, hourly: { time: times, temperature_2m: times.map(() => 34), weather_code: times.map(() => 0), is_day: times.map(() => 1) } });
  assert.equal(result.length, 25);
  assert.equal(result[0].time, '2026-10-27T23:00');
  assert.equal(result.at(-1).time, '2026-10-28T23:00');
});
test('older forecasts use sunrise and sunset and missing codes leave graph gaps', () => {
  const result = chart.series({ current: { time: '2026-10-27T17:15' }, daily: { time: ['2026-10-27'], sunrise: ['2026-10-27T06:00'], sunset: ['2026-10-27T18:00'] },
    hourly: { time: ['2026-10-27T17:00', '2026-10-27T18:00', '2026-10-27T19:00'], temperature_2m: [34, 34, 34], weather_code: [0, 0, null] } });
  assert(result[0].score > 0); assert.equal(result[1].score, 0); assert.equal(result[2].score, null);
  assert.deepEqual(chart.series({}), []);
});
