// Open-Meteo requires no API key for its public, non-commercial endpoint.
const cache = new Map();
const pending = new Map();
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
async function cached(key, url, ttl, validate = () => true) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) fail('Weather service is unavailable. Please try again later.', 502);
      const value = await response.json();
      if (!value || value.error) fail('Weather service is unavailable. Please try again later.', 502);
      if (!validate(value)) fail('The weather service returned incomplete data. Please retry.', 502);
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    } catch (error) {
      if (error.status) throw error;
      fail('Could not reach the weather service. Please try again.', 502);
    } finally { pending.delete(key); }
  })();
  pending.set(key, request);
  return request;
}
async function search(query) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100) fail('Enter a city name between 2 and 100 characters.');
  const name = query.trim();
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name, count: '6', language: 'en', format: 'json' });
  const data = await cached(`city:${name.toLowerCase()}`, url, 3600000, value => !value.results || Array.isArray(value.results));
  return { locations: (data.results || []).slice(0, 6).filter(city => typeof city.name === 'string' && Number.isFinite(city.latitude) && Number.isFinite(city.longitude)).map(city => ({ name: city.name, region: city.admin1 || '', country: city.country || '', latitude: city.latitude, longitude: city.longitude })) };
}
async function forecast(latitude, longitude) {
  const valid = (value, limit) => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;
  if (!valid(latitude, 90) || !valid(longitude, 180)) fail('Choose a valid weather location.');
  const lat = Number(latitude).toFixed(4), lon = Number(longitude).toFixed(4);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' });
  const data = await cached(`forecast:${lat}:${lon}`, url, 10 * 60000, value => !!value.current && Array.isArray(value.daily?.time) && Array.isArray(value.hourly?.time));
  return { ...data, source: 'Open-Meteo' };
}
module.exports = { search, forecast };
