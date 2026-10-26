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
