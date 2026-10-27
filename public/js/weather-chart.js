/* A qualitative condition scale, not a measured weather or temperature index. */
const WeatherChart = {
  score(code, temperature, isDay) {
    if (!Number.isInteger(code)) return null;
    if (code === 0 || code === 1) {
      const heat = isDay === true && Number.isFinite(temperature) ? Math.max(0, temperature - 28) * 8 : 0;
      return Math.min(100, code === 0 ? heat : heat * 0.8 - 12);
    }
    if (code === 2) return -35;
    if (code === 3) return -50;
    if ([45, 48].includes(code)) return -55;
    if ([51, 53, 55, 56, 57].includes(code)) return -60;
    if ([61, 80].includes(code)) return -70;
    if ([63, 66, 81].includes(code)) return -82;
    if ([65, 67, 82].includes(code)) return -92;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return -80;
    if ([95, 96, 99].includes(code)) return -100;
    return null;
  },
  series(data) {
    if (!Array.isArray(data.hourly?.time) || typeof data.current?.time !== 'string') return [];
    const start = data.current.time.slice(0, 13) + ':00';
    return data.hourly.time.map((time, index) => ({ time, index })).filter(item => typeof item.time === 'string' && item.time >= start).slice(0, 25).map(({time, index}) => {
      const code = data.hourly.weather_code?.[index], temperature = data.hourly.temperature_2m?.[index];
      let isDay = data.hourly.is_day?.[index] === 1 ? true : data.hourly.is_day?.[index] === 0 ? false : null;
      // Older cached forecasts may lack is_day. Use sunrise/sunset if available.
      const dateIndex = data.daily?.time?.indexOf(time.slice(0, 10)) ?? -1;
      const sunrise = data.daily?.sunrise?.[dateIndex], sunset = data.daily?.sunset?.[dateIndex];
      if (isDay === null && typeof sunrise === 'string' && typeof sunset === 'string') isDay = time >= sunrise && time < sunset;
      return { time, code, temperature, isDay, rain: data.hourly.precipitation_probability?.[index], score: this.score(code, temperature, isDay) };
    });
  },
  render(target, data, conditionLabel) {
    target.replaceChildren();
    const points = this.series(data);
    if (!points.some(point => point.score !== null)) {
      const empty = document.createElement('p'); empty.className = 'ai-help'; empty.textContent = 'The hourly condition graph is unavailable for this forecast.'; target.append(empty); return;
    }
    const ns = 'http://www.w3.org/2000/svg';
    const svgNode = (tag, attrs = {}, text) => {
      const node = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      if (text !== undefined) node.textContent = text; return node;
    };
    const width = 900, height = 360, left = 136, right = 24, top = 32, bottom = 294;
    const center = (top + bottom) / 2, plotWidth = width - left - right;
    const x = i => left + (points.length === 1 ? plotWidth / 2 : i * plotWidth / (points.length - 1));
    const y = score => center - score * (bottom - top) / 200;
    const scroll = document.createElement('div'); scroll.className = 'weather-chart-scroll'; scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Hourly weather graph; scroll horizontally on small screens');
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, class: 'weather-condition-chart', role: 'img', 'aria-label': 'Weather over time. Above zero: hot and sunny. Zero: normal sunny conditions. Below zero: cloudy or rainy. Select an hour below for forecast details.' });
    const defs = svgNode('defs');
    const background = svgNode('linearGradient', { id: 'weatherChartBackground', x1: '0', y1: '0', x2: '0', y2: '1' });
    for (const [offset, color, opacity] of [['0%', '#ef4444', '.28'], ['48%', '#ef4444', '0'], ['52%', '#3b82f6', '0'], ['100%', '#3b82f6', '.28']]) background.append(svgNode('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }));
    const lineGradient = svgNode('linearGradient', { id: 'weatherChartLine', gradientUnits: 'userSpaceOnUse', x1: '0', y1: top, x2: '0', y2: bottom });
    for (const [offset, color] of [['0%', '#ef4444'], ['50%', '#d39a19'], ['100%', '#3b82f6']]) lineGradient.append(svgNode('stop', { offset, 'stop-color': color }));
    defs.append(background, lineGradient); svg.append(defs, svgNode('rect', { x: left, y: top, width: plotWidth, height: bottom - top, rx: 12, fill: 'url(#weatherChartBackground)' }));
    for (const value of [100, 50, 0, -50, -100]) {
      svg.append(svgNode('line', { x1: left, x2: width - right, y1: y(value), y2: y(value), class: value === 0 ? 'weather-chart-baseline' : 'weather-chart-grid' }));
    }
    for (const [text, value] of [['Hot / full sun (+)', 100], ['Normal sunny · 0', 0], ['Cloud / rain (−)', -100]]) svg.append(svgNode('text', { x: left - 12, y: y(value) + 4, 'text-anchor': 'end', class: 'weather-chart-axis' }, text));
    svg.append(svgNode('line', { x1: left, x2: left, y1: top, y2: bottom, class: 'weather-chart-grid' }));
    const tickIndexes = [...new Set(Array.from({ length: Math.min(7, points.length) }, (_, i) => Math.round(i * (points.length - 1) / Math.max(1, Math.min(7, points.length) - 1))))];
    for (const i of tickIndexes) {
      const time = points[i].time;
      svg.append(svgNode('text', { x: x(i), y: bottom + 25, 'text-anchor': 'middle', class: 'weather-chart-axis' }, time.slice(11, 16)));
      if (i === tickIndexes[0] || time.slice(0, 10) !== points[tickIndexes[tickIndexes.indexOf(i) - 1]]?.time.slice(0, 10)) svg.append(svgNode('text', { x: x(i), y: bottom + 42, 'text-anchor': 'middle', class: 'weather-chart-date' }, time.slice(5, 10)));
    }
    svg.append(svgNode('text', { x: left + plotWidth / 2, y: height - 5, 'text-anchor': 'middle', class: 'weather-chart-axis' }, `Time · ${data.timezone || 'Forecast local time'}`));
    let path = '', connected = false;
    const markers = [];
    points.forEach((point, i) => {
      if (point.score === null) { connected = false; markers.push(null); return; }
      path += `${connected ? ' L' : ' M'}${x(i).toFixed(2)},${y(point.score).toFixed(2)}`; connected = true;
      markers.push(svgNode('circle', { cx: x(i), cy: y(point.score), r: 3.5, class: 'weather-chart-point', 'aria-hidden': 'true' }));
    });
    svg.append(svgNode('path', { d: path, fill: 'none', stroke: 'url(#weatherChartLine)', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    markers.filter(Boolean).forEach(marker => svg.append(marker));
    const cursor = svgNode('line', { y1: top, y2: bottom, class: 'weather-chart-cursor', 'aria-hidden': 'true' }); svg.append(cursor);
    const detail = document.createElement('p'); detail.className = 'weather-chart-detail'; detail.setAttribute('role', 'status'); detail.setAttribute('aria-live', 'polite');
    const label = document.createElement('label'); label.className = 'weather-chart-control'; label.textContent = 'Explore an hour';
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = points.length - 1; slider.step = 1; slider.value = 0; slider.setAttribute('aria-label', 'Forecast hour'); label.append(slider);
    let selected = -1;
    const select = index => {
      if (index === selected) return; selected = index; slider.value = index;
      markers.forEach((marker, i) => { if (marker) { marker.classList.toggle('selected', i === index); marker.setAttribute('r', i === index ? 6 : 3.5); } });
      cursor.setAttribute('x1', x(index)); cursor.setAttribute('x2', x(index));
      const point = points[index];
      const number = (value, suffix) => typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : 'unavailable';
      const condition = point.code === 0 && point.isDay === false ? 'Clear night' : conditionLabel(point.code);
      const text = `${point.time.replace('T', ' ')} · ${condition} · ${number(point.temperature, '°C')} · Rain chance ${number(point.rain, '%')}${point.score === null ? ' · Graph value unavailable' : ''}`;
      detail.textContent = text; slider.setAttribute('aria-valuetext', text);
    };
    slider.addEventListener('input', () => select(Number(slider.value)));
    const selectAtPointer = event => {
      const bounds = svg.getBoundingClientRect();
      const position = (event.clientX - bounds.left) * width / bounds.width;
      const index = Math.round((position - left) / plotWidth * (points.length - 1));
      select(Math.max(0, Math.min(points.length - 1, index)));
    };
    svg.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') selectAtPointer(event); });
    svg.addEventListener('click', selectAtPointer);
    scroll.append(svg); target.append(scroll, label, detail); select(0);
  }
};
if (typeof module === 'object' && module.exports) module.exports = WeatherChart;
else window.WeatherChart = WeatherChart;
