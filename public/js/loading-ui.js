/* Shared UI state for asynchronous reads and writes. Never changes form values. */
const LoadingUI = {
  jobs: new WeakSet(),
  keys: new Set(),
  regions: new WeakMap(),
  async run(element, job, options = {}) {
    if (!element || this.jobs.has(element)) return;
    const resource = options.key || element.closest('[data-loading-key]')?.dataset.loadingKey;
    if (resource && this.keys.has(resource)) return;
    this.jobs.add(element); if (resource) this.keys.add(resource);
    const form = element.matches('form') ? element : null;
    const button = options.button || (form ? form.querySelector('button[type="submit"]') : element);
    const managed = options.manageDisabled ?? !(form?.matches('#aiRequestForm, #groqSettingsForm, .ai-proposal'));
    const controls = managed ? [...new Set(form ? [...form.querySelectorAll('button'), ...(form.closest('.modal-overlay')?.querySelectorAll('#modalCloseBtn') || [])] : [button])] : [];
    const states = controls.map(control => ({ control, disabled: control.disabled, aria: control.getAttribute('aria-disabled') }));
    const oldBusy = element.getAttribute('aria-busy');
    element.setAttribute('aria-busy', 'true');
    for (const { control } of states) { if ('disabled' in control) control.disabled = true; control.setAttribute('aria-disabled', 'true'); }
    const oldLabel = button?.getAttribute('aria-label');
    if (button) button.setAttribute('aria-label', `${options.label || 'Working'}: ${oldLabel || button.title || button.textContent.trim()}`);
    const timer = setTimeout(() => button?.classList.add('is-loading'), 100);
    try { return await job(); }
    finally {
      clearTimeout(timer); button?.classList.remove('is-loading');
      if (button) { if (oldLabel === null) button.removeAttribute('aria-label'); else if (oldLabel !== undefined) button.setAttribute('aria-label', oldLabel); }
      if (oldBusy === null) element.removeAttribute('aria-busy'); else element.setAttribute('aria-busy', oldBusy);
      for (const { control, disabled, aria } of states) {
        if ('disabled' in control) control.disabled = disabled;
        if (aria === null) control.removeAttribute('aria-disabled'); else control.setAttribute('aria-disabled', aria);
      }
      this.jobs.delete(element); if (resource) this.keys.delete(resource);
    }
  },
  report(error) {
    if (window.Notifications) Notifications.show(error.message || 'The action failed. Please try again.', 'error');
  },
  bindForm(form, handler, options = {}) {
    if (!form) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      this.run(form, () => handler(event), { ...options, button: event.submitter || form.querySelector('button[type="submit"]') }).catch(error => this.report(error));
    });
  },
  bindAction(element, handler, options = {}) {
    if (!element) return;
    if (!element.matches('button, input, a')) {
      element.setAttribute('role', 'button'); element.tabIndex = 0;
      element.setAttribute('aria-label', element.title || 'Update item');
      element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); element.click(); }
      });
    }
    element.addEventListener('click', event => {
      // Stop bubbling immediately, even if the handler later awaits a request.
      event.stopPropagation();
      this.run(element, () => handler(event), options).catch(error => this.report(error));
    });
  },
  regionFor(key) {
    const ids = key === 'dashboard' ? ['unifiedFocusList']
      : key.startsWith('tasks') ? ['tasksListContainer', 'calendarDaysGrid', 'weeklyGridContainer']
      : key === 'projects' ? ['projectsContainer'] : key === 'timetables' ? ['weeklyGridContainer'] : [];
    return ids.map(id => document.getElementById(id)).find(Boolean) || null;
  },
  startRegion(element) {
    if (!element) return () => {};
    const existing = this.regions.get(element);
    if (existing) { existing.count++; return () => this.finishRegion(element); }
    const placeholder = document.createElement('div'); placeholder.className = 'loading-placeholder'; placeholder.setAttribute('role', 'status');
    const spinner = document.createElement('span'); spinner.className = 'loading-spinner'; spinner.setAttribute('aria-hidden', 'true');
    placeholder.append(spinner, document.createTextNode('Loading data…'));
    element.replaceChildren(placeholder);
    this.regions.set(element, { count: 1, placeholder, busy: element.getAttribute('aria-busy') });
    element.setAttribute('aria-busy', 'true');
    return () => this.finishRegion(element);
  },
  finishRegion(element) {
    const state = this.regions.get(element); if (!state || --state.count > 0) return;
    state.placeholder.remove();
    if (state.busy === null) element.removeAttribute('aria-busy'); else element.setAttribute('aria-busy', state.busy);
    this.regions.delete(element);
  },
  regionError(element, retry) {
    if (!element) return;
    const error = document.createElement('div'); error.className = 'loading-placeholder loading-error'; error.setAttribute('role', 'status');
    const message = document.createElement('span'); message.textContent = 'Could not load data. Check your connection and try again.';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary btn-sm'; button.textContent = 'Retry';
    this.bindAction(button, retry, { label: 'Retrying' }); error.append(message, button); element.replaceChildren(error);
  }
};
window.LoadingUI = LoadingUI;
