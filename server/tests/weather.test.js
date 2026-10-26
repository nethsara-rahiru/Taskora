const test = require('node:test');
const assert = require('node:assert/strict');
const weather = require('../services/weather.service');

test('weather validates coordinates and city queries before contacting the provider', async () => {
  for (const [lat, lon] of [['', '0'], ['91', '0'], ['0', '-181'], ['NaN', '0'], [null, '0'], [['5'], '0']]) {
    await assert.rejects(weather.forecast(lat, lon), { status: 400 });
  }
  for (const query of ['', 'a', ['Colombo'], 'x'.repeat(101)]) await assert.rejects(weather.search(query), { status: 400 });
});

test('city lookup encodes query text and returns a bounded location shape', async () => {
  const original = global.fetch;
  global.fetch = async url => {
    assert.equal(url.hostname, 'geocoding-api.open-meteo.com');
    assert.equal(url.searchParams.get('name'), 'Galle & Fort');
    return { ok: true, json: async () => ({ results: [{ name: 'Galle', country: 'Sri Lanka', latitude: 6.03, longitude: 80.22, id: 1 }] }) };
  };
  try { assert.deepEqual(await weather.search('Galle & Fort'), { locations: [{ name: 'Galle', region: '', country: 'Sri Lanka', latitude: 6.03, longitude: 80.22 }] }); }
  finally { global.fetch = original; }
});

test('forecast requests deduplicate, cache and use the selected location timezone', async () => {
  const original = global.fetch; let requests = 0;
  global.fetch = async url => {
    requests++;
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('timezone'), 'auto');
    assert.equal(url.searchParams.get('forecast_days'), '7');
    return { ok: true, json: async () => ({ current: { temperature_2m: 28 }, hourly: { time: [] }, daily: { time: [] } }) };
  };
  try {
    const values = await Promise.all([weather.forecast('6.9', '79.8'), weather.forecast('6.9', '79.8')]);
    assert.equal(values[0].current.temperature_2m, 28);
    await weather.forecast('6.9', '79.8');
    assert.equal(requests, 1);
  } finally { global.fetch = original; }
});

test('provider errors and incomplete forecasts can be retried without being reported as successful weather', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => ({ ok: false });
    await assert.rejects(weather.forecast('1', '1'), { status: 502 });
    global.fetch = async () => { throw new TypeError('network failed'); };
    await assert.rejects(weather.forecast('1', '1'), { status: 502 });
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(weather.forecast('2', '2'), { status: 502 });
    global.fetch = async () => ({ ok: true, json: async () => ({ current: {}, hourly: { time: [] }, daily: { time: [] } }) });
    assert.equal((await weather.forecast('1', '1')).source, 'Open-Meteo');
  } finally { global.fetch = original; }
});

test('planning forecast is compact, dated and omits coordinates, with graceful missing data fallback', async () => {
  const original = global.fetch;
  try {
    assert.deepEqual(await weather.forPlanning(null, '2026-10-26', '2026-11-01'), { status: 'not_configured' });
    global.fetch = async () => ({ ok: true, json: async () => ({ latitude: 8, longitude: 81, timezone: 'Asia/Colombo', current: { time: '2026-10-26T12:00', temperature_2m: 30 },
      hourly: { time: ['2026-10-26T11:00', '2026-10-26T13:00'], precipitation_probability: [20, 90], temperature_2m: [29, 30] },
      daily: { time: ['2026-10-26', '2026-10-27'], precipitation_probability_max: [90, 70], temperature_2m_max: [31, 32], temperature_2m_min: [24, 25] } }) });
    const result = await weather.forPlanning({ name: 'Saved city', latitude: 8, longitude: 81 }, '2026-10-26', '2026-10-26');
    assert.equal(result.status, 'available'); assert.equal(result.location, 'Saved city'); assert.equal(result.daily.length, 1);
    assert.equal(result.hourly.length, 1); assert.equal(result.hourly[0].rainChancePercent, 90);
    assert.equal(result.latitude, undefined); assert.equal(result.longitude, undefined);
    assert.equal((await weather.forPlanning({ name: 'Saved city', latitude: 8, longitude: 81 }, '2027-01-01', '2027-01-07')).status, 'unavailable');
    global.fetch = async () => { throw new Error('Provider offline'); };
    assert.deepEqual(await weather.forPlanning({ name: 'Other city', latitude: 9, longitude: 82 }, '2026-10-26', '2026-11-01'), { status: 'unavailable', location: 'Other city' });
  } finally { global.fetch = original; }
});
