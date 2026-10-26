const LocationSettings = {
  initialized: false,
  busy: false,
  init(user) {
    if (this.initialized) return;
    this.initialized = true;
    this.saved = user.weatherLocation || null; this.draft = this.saved;
    this.status = document.getElementById('settingsLocationStatus');
    this.selected = document.getElementById('settingsLocationSelected');
    this.results = document.getElementById('settingsLocationResults');
    this.saveButton = document.getElementById('settingsLocationSave');
    this.clearButton = document.getElementById('settingsLocationClear');
    LoadingUI.bindForm(document.getElementById('locationSearchForm'), () => this.search());
    LoadingUI.bindAction(document.getElementById('settingsLocationLocate'), () => this.locate());
    LoadingUI.bindAction(this.saveButton, () => this.persist(false), { manageDisabled: false });
    LoadingUI.bindAction(this.clearButton, () => this.persist(true), { manageDisabled: false });
    this.render();
  },
  render() {
    this.selected.textContent = this.draft ? `${this.draft.name} · ${this.draft.latitude.toFixed(4)}, ${this.draft.longitude.toFixed(4)}` : 'No location selected.';
    this.saveButton.disabled = this.busy || !this.draft;
    this.clearButton.disabled = this.busy || !this.saved;
  },
  async search() {
    if (this.busy) return;
    this.status.textContent = 'Searching cities…'; this.results.replaceChildren();
    try {
      const data = await API.get(`/weather/locations?q=${encodeURIComponent(document.getElementById('settingsLocationCity').value.trim())}`);
      this.status.textContent = data.locations.length ? 'Choose a city, then save your location.' : 'No cities found. Try another spelling or a nearby city.';
      data.locations.forEach(city => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary';
        const name = [city.name, city.region, city.country].filter(Boolean).join(', ').slice(0, 160); button.textContent = name;
        button.addEventListener('click', () => {
          if (this.busy) return;
          this.draft = { name, latitude: city.latitude, longitude: city.longitude }; this.results.replaceChildren(); this.status.textContent = 'Location selected. Save to use it for weather and AI planning.'; this.render();
        });
        this.results.append(button);
      });
    } catch (error) { this.status.textContent = error.message || 'Could not search locations. Try again.'; }
  },
  async locate() {
    if (this.busy) return;
    if (!navigator.geolocation) { this.status.textContent = 'Device location is unavailable. Search for a city instead.'; return; }
    this.status.textContent = 'Waiting for location permission…';
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false }));
      if (this.busy) return;
      this.draft = { name: 'My location', latitude: position.coords.latitude, longitude: position.coords.longitude };
      this.results.replaceChildren(); this.status.textContent = 'Location selected. Save to use it for weather and AI planning.'; this.render();
    } catch (_) { this.status.textContent = 'Could not access your location. Allow access or search for a city.'; }
  },
  async persist(remove) {
    if (this.busy || (!remove && !this.draft)) return;
    this.busy = true; this.render(); this.status.textContent = remove ? 'Removing saved location…' : 'Saving location…';
    try {
      const data = remove ? await API.delete('/user/location') : await API.put('/user/location', this.draft);
      this.saved = data.location; this.draft = this.saved;
      if (Auth.currentUser) Auth.currentUser.weatherLocation = this.saved;
      // Clear the old device-only default so a removed account location does not reappear.
      StorageManager.remove(`weather-location:${Auth.currentUser._id}`);
      this.status.textContent = remove ? 'Saved location removed. AI will plan without weather.' : 'Location saved. Weather and new AI suggestions will use this forecast.';
    } catch (error) { this.status.textContent = error.message || 'Could not save your location. Please try again.'; }
    finally { this.busy = false; this.render(); }
  }
};
window.LocationSettings = LocationSettings;
