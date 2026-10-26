const WeatherPage = {
  initialized: false,
  loading: false,
  location: null,
  lastAttempt: 0,
  element(tag, className, text) {
    const element = document.createElement(tag); element.className = className || ''; if (text !== undefined) element.textContent = text; return element;
  },
  storageKey() { return `weather-location:${Auth.currentUser._id}`; },
  validLocation(value) { return value && typeof value.name === 'string' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180; },
  init() {
    if (this.initialized || !Auth.currentUser) return;
    this.initialized = true;
    this.status = document.getElementById('weatherStatus');
    this.results = document.getElementById('weatherLocations');
    this.refresh = document.getElementById('weatherRefresh');
    LoadingUI.bindForm(document.getElementById('weatherSearchForm'), () => this.search());
    LoadingUI.bindAction(document.getElementById('weatherLocate'), () => this.locate());
    LoadingUI.bindAction(this.refresh, () => this.update());
    const saved = Auth.currentUser.weatherLocation || StorageManager.get(this.storageKey());
    if (this.validLocation(saved)) { this.location = saved; LoadingUI.run(this.refresh, () => this.update()); }
    const refreshIfDue = () => {
      if (document.visibilityState === 'visible' && this.location && !this.loading && Date.now() - this.lastAttempt > 15 * 60000) {
        LoadingUI.run(this.refresh, () => this.update());
      }
    };
    this.timer = setInterval(refreshIfDue, 60000);
    document.addEventListener('visibilitychange', refreshIfDue);
  },
  async search() {
    this.status.textContent = 'Searching cities…'; this.results.replaceChildren();
    try {
      const data = await API.get(`/weather/locations?q=${encodeURIComponent(document.getElementById('weatherCity').value.trim())}`);
      if (!data.locations.length) { this.status.textContent = 'No cities found. Try a nearby city or a different spelling.'; return; }
      this.status.textContent = 'Choose a location:';
      data.locations.forEach(city => {
        const name = [city.name, city.region, city.country].filter(Boolean).join(', ');
        const button = this.element('button', 'btn btn-secondary', name); button.type = 'button';
        LoadingUI.bindAction(button, () => this.choose({ name, latitude: city.latitude, longitude: city.longitude }));
        this.results.append(button);
      });
    } catch (error) { this.status.textContent = error.message || 'City search failed. Please try again.'; }
  },
  async choose(location) {
    if (this.loading || !this.validLocation(location)) return;
    const previous = this.location;
    this.location = location;
    const success = await LoadingUI.run(this.refresh, () => this.update());
    if (success) { StorageManager.save(this.storageKey(), location); this.results.replaceChildren(); }
    else this.location = previous;
  },
  async locate() {
    if (!navigator.geolocation) { this.status.textContent = 'Device location is unavailable. Search for a city instead.'; return; }
    if (this.loading) return;
    this.status.textContent = 'Waiting for your location permission…';
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false }));
      await this.choose({ name: 'My location', latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (_) { this.status.textContent = 'Could not access your location. Allow location access or search for a city.'; }
  },
  async update() {
    if (!this.location || this.loading) return false;
    this.loading = true; this.lastAttempt = Date.now();
    const location = this.location;
    this.status.textContent = 'Updating weather…'; this.status.classList.add('loading-text');
    const panel = document.getElementById('weatherForecastPanel'); panel.setAttribute('aria-busy', 'true');
    try {
      const forecast = await API.get(`/weather/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`);
      this.render(forecast, location);
      this.status.textContent = navigator.onLine ? 'Weather updated.' : 'Offline — showing previously downloaded weather. Check its update time.';
      return true;
    } catch (error) {
      this.status.textContent = `${error.message || 'Weather is unavailable.'} Try again using Refresh weather or select a city.${panel.hidden ? '' : ' Previous weather is still shown; check its update time.'}`;
      return false;
    } finally { this.loading = false; this.status.classList.remove('loading-text'); panel.removeAttribute('aria-busy'); }
  },
  condition(code) {
    if (code === 0) return '☀ Clear sky';
    if ([1, 2].includes(code)) return '🌤 Partly cloudy';
    if (code === 3) return '☁ Overcast';
    if ([45, 48].includes(code)) return '🌫 Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌦 Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧 Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄ Snow';
    if ([95, 96, 99].includes(code)) return '⛈ Thunderstorm';
    return 'Conditions unavailable';
  },
  number(value, unit = '') { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${unit}` : '—'; },
  render(data, location) {
    const current = data.current;
    if (!current || !Array.isArray(data.hourly?.time) || !Array.isArray(data.daily?.time)) throw new Error('Weather data is incomplete.');
    document.getElementById('weatherLocationName').textContent = location.name;
    document.getElementById('weatherUpdated').textContent = `Conditions as of ${current.time.replace('T', ' ')} · ${data.timezone}`;
    const overview = document.getElementById('weatherCurrent'); overview.replaceChildren();
    overview.append(this.element('p', 'weather-temperature', this.number(current.temperature_2m, '°C')), this.element('p', 'weather-condition', this.condition(current.weather_code)));
    const metrics = this.element('div', 'weather-metrics');
    for (const [label, value] of [['Feels like', this.number(current.apparent_temperature, '°C')], ['Humidity', this.number(current.relative_humidity_2m, '%')], ['Wind', this.number(current.wind_speed_10m, ' km/h')]]) {
      const item = this.element('div', 'weather-metric'); item.append(this.element('span', 'ai-help', label), this.element('strong', '', value)); metrics.append(item);
    }
    overview.append(metrics);
    const hourly = document.getElementById('weatherHourly'); hourly.replaceChildren();
    data.hourly.time.map((time, index) => ({ time, index })).filter(item => item.time >= current.time).slice(0, 12).forEach(({time, index}) => {
      const card = this.element('div', 'weather-hour');
      card.append(this.element('strong', '', `${time.slice(5, 10)} ${time.slice(11, 16)}`), this.element('span', '', this.condition(data.hourly.weather_code[index])), this.element('span', '', this.number(data.hourly.temperature_2m[index], '°C')), this.element('span', 'ai-help', `${this.number(data.hourly.precipitation_probability[index], '%')} rain`)); hourly.append(card);
    });
    const daily = document.getElementById('weatherDaily'); daily.replaceChildren();
    data.daily.time.forEach((date, index) => {
      const card = this.element('div', 'weather-day');
      const day = new Date(`${date}T12:00:00Z`).toLocaleDateString([], { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
      card.append(this.element('strong', '', day), this.element('span', '', this.condition(data.daily.weather_code[index])), this.element('span', '', `${this.number(data.daily.temperature_2m_min[index], '°')} / ${this.number(data.daily.temperature_2m_max[index], '°C')}`), this.element('span', 'ai-help', `${this.number(data.daily.precipitation_probability_max[index], '%')} rain`)); daily.append(card);
    });
    document.getElementById('weatherForecastPanel').hidden = false;
  }
};
window.WeatherPage = WeatherPage;
window.loadCurrentPageData = () => WeatherPage.init();
