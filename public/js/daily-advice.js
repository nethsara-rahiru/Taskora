const DailyAdvice = {
  initialized: false,
  async init() {
    if (this.initialized || !Auth.currentUser) return;
    this.initialized = true;
    this.button = document.getElementById('refreshDailyAdvice');
    this.status = document.getElementById('dailyAdviceStatus');
    this.content = document.getElementById('dailyAdviceContent');
    this.status.classList.add('loading-text');
    LoadingUI.bindAction(this.button, () => this.generate());
    try {
      this.settings = await API.get('/ai/settings');
      if (!this.settings.configured || !this.settings.enabled) {
        this.status.textContent = 'Enable Groq AI and add your key in AI settings for daily suggestions.';
        return;
      }
      this.button.disabled = false;
      const saved = StorageManager.get(this.cacheKey());
      if (saved && saved.date === this.today() && saved.timezone === this.settings.timezone && typeof saved.summary === 'string' && Array.isArray(saved.recommendations)) this.render(saved);
      else await LoadingUI.run(this.button, () => this.generate());
    } catch (error) {
      this.status.textContent = error.message || 'Could not load AI preferences. Reload the page to retry.';
    } finally { this.status.classList.remove('loading-text'); }
  },
  today() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: this.settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  },
  cacheKey() { return `daily-advice:v3:${Auth.currentUser._id}:${Auth.currentUser.weatherLocation ? `${Auth.currentUser.weatherLocation.latitude},${Auth.currentUser.weatherLocation.longitude}` : 'none'}`; },
  async generate() {
    const date = this.today();
    this.status.textContent = 'Planning your day around your current commitments…';
    this.content.setAttribute('aria-busy', 'true');
    try {
      const plan = await API.post('/ai/plan', { mode: 'recommend', adviceOnly: true, date,
        prompt: `Help me work effectively today, ${date}, from the current time onward. Use my unfinished tasks, deadlines, priorities, events, active schedules and working hours. Give a friendly one- or two-sentence summary and 2–3 short, helpful suggestions. Talk to me naturally, without explaining your reasoning or listing the clock time, timezone, working hours or deadline checks. Mention specific tasks or times only if useful. Suggest realistic focus blocks or breaks when appropriate. Use the timezone in my settings. Assess how much work is left and encourage a manageable task or small step in a real free gap, even outside preferred working hours when practical. Keep it sustainable: protect sleep, breaks, meals and recovery, and do not assume unlimited energy. Use the saved location forecast for weather-sensitive plans when available. Only provide a summary and recommendations; do not propose changes to stored entries.` });
      const saved = { date, summary: plan.summary, recommendations: plan.recommendations, weather: plan.weather, generatedAt: new Date().toISOString(), timezone: this.settings.timezone };
      StorageManager.save(this.cacheKey(), saved);
      this.render(saved);
    } catch (error) {
      this.status.textContent = `${error.message || 'Could not generate advice.'} Use Refresh advice to try again.${this.content.textContent ? ' Your previous advice is still shown.' : ''}`;
    } finally { this.content.removeAttribute('aria-busy'); }
  },
  render(plan) {
    this.content.replaceChildren();
    const summary = document.createElement('p'); summary.className = 'daily-advice-summary'; summary.textContent = plan.summary;
    const list = document.createElement('ol'); list.className = 'ai-recommendations';
    plan.recommendations.forEach(text => { const item = document.createElement('li'); item.textContent = text; list.append(item); });
    this.content.append(summary, list);
    const time = new Date(plan.generatedAt).toLocaleTimeString([], { timeZone: this.settings.timezone, hour: '2-digit', minute: '2-digit' });
    this.status.textContent = `For ${plan.date} · Updated ${time} (${this.settings.timezone}). Refresh after changing your plans. Suggestions only.${plan.weather?.status === 'available' ? ` Weather: ${plan.weather.location} (${plan.weather.asOf}, ${plan.weather.timezone}).` : plan.weather?.status === 'unavailable' ? ' Weather unavailable; advice uses your commitments.' : ' Save a location in Settings to include weather.'}`;
  }
};
window.DailyAdvice = DailyAdvice;
