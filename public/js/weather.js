const WeatherPage = {
  initialized: false,
  loading: false,
  location: null,
  lastAttempt: 0,
  element(tag, className, text) {
    const element = document.createElement(tag); element.className = className || ''; if (text !== undefined) element.textContent = text; return element;
  },
  validLocation(value) { return value && typeof value.name === 'string' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180; },
  init() {
    if (this.initialized || !Auth.currentUser) return;
    this.initialized = true;
    this.status = document.getElementById('weatherStatus');
    this.refresh = document.getElementById('weatherRefresh');
    LoadingUI.bindAction(this.refresh, () => this.update());
    this.initCarousel();
    const saved = Auth.currentUser.weatherLocation;
    if (this.validLocation(saved)) { this.refresh.disabled = false; this.location = saved; LoadingUI.run(this.refresh, () => this.update()); }
    else this.status.textContent = 'Save a location in Settings to see your forecast.';
    const refreshIfDue = () => {
      if (document.visibilityState === 'visible' && this.location && !this.loading && Date.now() - this.lastAttempt > 15 * 60000) {
        LoadingUI.run(this.refresh, () => this.update());
      }
    };
    this.timer = setInterval(refreshIfDue, 60000);
    document.addEventListener('visibilitychange', refreshIfDue);
  },
  initCarousel() {
    const daily = document.getElementById('weatherDaily');
    this.previous = document.getElementById('weatherDaysPrevious'); this.next = document.getElementById('weatherDaysNext');
    this.previous.addEventListener('click', () => this.moveDays(-1)); this.next.addEventListener('click', () => this.moveDays(1));
    daily.addEventListener('scroll', () => this.updateCarousel(), { passive: true });
    daily.addEventListener('keydown', event => {
      if (event.target !== daily || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); this.moveDays(event.key === 'ArrowRight' ? 1 : -1);
    });
    window.addEventListener('resize', () => this.updateCarousel());
  },
  moveDays(direction) {
    const daily = document.getElementById('weatherDaily'), card = daily.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(daily).gap || 0);
    daily.scrollBy({ left: direction * step, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  },
  updateCarousel() {
    const daily = document.getElementById('weatherDaily'), count = daily.children.length;
    if (!count || !daily.clientWidth) return;
    const step = daily.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(daily).gap || 0);
    const first = Math.min(count, Math.floor((daily.scrollLeft + 2) / step) + 1);
    const last = Math.min(count, Math.ceil((daily.scrollLeft + daily.clientWidth - 2) / step));
    this.previous.disabled = daily.scrollLeft <= 2;
    this.next.disabled = daily.scrollLeft >= daily.scrollWidth - daily.clientWidth - 2;
    document.getElementById('weatherDaysPosition').textContent = `${first === last ? first : `${first}–${last}`} of ${count} days`;
  },
  async update() {
    if (!this.location || this.loading) return false;
    this.loading = true; this.lastAttempt = Date.now();
    const location = this.location;
    const cached = StorageManager.get(`req_/weather/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`);
    if (!cached) { this.status.textContent = 'Updating weather…'; this.status.classList.add('loading-text'); }
    const panel = document.getElementById('weatherForecastPanel'); panel.setAttribute('aria-busy', 'true');
    try {
      const forecast = await API.getCached(`/weather/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`, fresh => { this.render(fresh, location); });
      this.render(forecast, location);
      this.status.textContent = navigator.onLine ? 'Weather updated.' : 'Offline — showing previously downloaded weather. Check its update time.';
      return true;
    } catch (error) {
      this.status.textContent = `${error.message || 'Weather is unavailable.'} Try Refresh weather, or check your saved location in Settings.${panel.hidden ? '' : ' Previous weather is still shown; check its update time.'}`;
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
  conditionTone(code, high) {
    if ([95, 96, 99].includes(code)) return 'storm';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([2, 3, 45, 48].includes(code)) return 'cloud';
    if ([0, 1].includes(code)) return Number.isFinite(high) && high > 32 ? 'hot' : 'sun';
    return 'unknown';
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
    WeatherChart.render(document.getElementById('weatherConditionGraph'), data, code => this.condition(code));
    const daily = document.getElementById('weatherDaily'), priorScroll = daily.scrollLeft; daily.replaceChildren();
    data.daily.time.forEach((date, index) => {
      const code = data.daily.weather_code[index], tone = this.conditionTone(code, data.daily.temperature_2m_max[index]);
      const card = this.element('article', `weather-day weather-day-${tone}`);
      card.setAttribute('role', 'group'); card.setAttribute('aria-roledescription', 'slide'); card.setAttribute('aria-label', `Day ${index + 1} of ${data.daily.time.length}`);
      const day = new Date(`${date}T12:00:00Z`).toLocaleDateString([], { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
      const icon = this.element('span', 'weather-day-icon', { sun: '☀️', hot: '☀️', cloud: '☁️', rain: '🌧️', storm: '⛈️', snow: '❄️', unknown: '◌' }[tone]); icon.setAttribute('aria-hidden', 'true');
      const condition = this.condition(code);
      card.append(this.element('strong', 'weather-day-date', `${date === data.current.time.slice(0, 10) ? 'Today · ' : ''}${day}`), icon,
        this.element('span', 'weather-day-condition', tone === 'unknown' ? condition : condition.split(' ').slice(1).join(' ')),
        this.element('strong', 'weather-day-high', this.number(data.daily.temperature_2m_max[index], '°C')),
        this.element('span', 'ai-help', `Low ${this.number(data.daily.temperature_2m_min[index], '°C')}`),
        this.element('span', 'weather-day-rain-chance', `Rain chance ${this.number(data.daily.precipitation_probability_max[index], '%')}`));
      daily.append(card);
    });
    document.getElementById('weatherForecastPanel').hidden = false;
    daily.scrollLeft = priorScroll; this.updateCarousel();
  }
};
window.WeatherPage = WeatherPage;
window.loadCurrentPageData = () => WeatherPage.init();
