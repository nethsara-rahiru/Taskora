const AiAssistant = {
  async init() {
    const params = new URLSearchParams(location.search);
    const dateInput = document.getElementById('aiPlanningDate');
    const now = new Date();
    dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') :
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (['quick_add', 'schedule', 'recommend'].includes(params.get('mode'))) document.getElementById('aiMode').value = params.get('mode');
    try {
      const settings = await API.get('/ai/settings');
      document.getElementById('aiSetupStatus').textContent = settings.configured && settings.enabled
        ? `Ready · ${settings.timezone} · Working hours ${settings.workdayStart}–${settings.workdayEnd} · ${settings.defaultDuration} min per task`
        : 'Add your Groq key and enable AI in Settings to get started.';
      if (!params.get('date')) {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
        const get = type => parts.find(part => part.type === type).value;
        dateInput.value = `${get('year')}-${get('month')}-${get('day')}`;
      }
    } catch (error) { document.getElementById('aiSetupStatus').textContent = error.message; }
    document.querySelectorAll('.ai-examples button').forEach(button => button.addEventListener('click', () => {
      document.getElementById('aiMode').value = button.dataset.mode;
      document.getElementById('aiPrompt').value = button.dataset.prompt;
      document.getElementById('aiPrompt').focus();
    }));
    document.getElementById('aiRequestForm').addEventListener('submit', event => this.generate(event));
  },
  async generate(event) {
    event.preventDefault();
    const button = document.getElementById('generateAiBtn'); const status = document.getElementById('aiRequestStatus');
    button.disabled = true; button.textContent = 'Thinking…'; status.textContent = 'Checking your tasks and schedule with Groq…';
    try {
      const result = await API.post('/ai/plan', { mode: document.getElementById('aiMode').value,
        date: document.getElementById('aiPlanningDate').value, prompt: document.getElementById('aiPrompt').value.trim() });
      this.render(result); status.textContent = 'Suggestions ready. Nothing has been changed yet.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; button.textContent = 'Generate suggestions'; }
  },
  element(tag, className, text) {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = text; return element;
  },
  render(plan) {
    const results = document.getElementById('aiResults'); results.hidden = false; results.replaceChildren();
    const overview = this.element('div', 'ai-panel'); overview.append(this.element('h2', '', 'Your proposed plan'), this.element('p', 'ai-help', plan.summary),
      this.element('p', 'ai-help', `Times shown in ${plan.timezone}. Proposals expire after one hour.`));
    const list = this.element('ul', 'ai-recommendations');
    plan.recommendations.forEach(text => list.append(this.element('li', '', text))); overview.append(list); results.append(overview);
    plan.actions.forEach(action => {
      const card = this.element('form', 'ai-panel ai-proposal'); const value = action.values;
      card.append(this.element('h3', '', action.operation === 'update' ? 'Reschedule existing task' : `New ${value.itemType}`), this.element('p', 'ai-help', action.reason));
      if (action.conflicts?.length) card.append(this.element('p', 'ai-conflict', `Choose another time: overlaps ${action.conflicts.join(', ')}.`));
      const fields = {};
      const field = (name, label, type = 'text') => {
        const group = this.element('label', 'form-group'); group.append(this.element('span', 'form-label', label));
        const input = document.createElement('input'); input.type = type; input.className = 'form-control'; input.value = value[name] || '';
        if (name === 'title') { input.required = true; input.maxLength = 240; }
        if ((value.itemType === 'event' && ['dueDate', 'dueTime', 'endTime'].includes(name)) || (action.operation === 'update' && ['dueDate', 'dueTime'].includes(name))) input.required = true;
        group.append(input); fields[name] = input; return group;
      };
      card.append(field('title', 'Title'));
      const row = this.element('div', 'form-row'); row.append(field('dueDate', 'Date', 'date'), field('dueTime', value.itemType === 'event' ? 'Start time' : 'Task time', 'time'));
      if (value.itemType === 'event') row.append(field('endTime', 'End time', 'time')); card.append(row);
      const priorityGroup = this.element('label', 'form-group'); priorityGroup.append(this.element('span', 'form-label', 'Priority'));
      const priority = this.element('select', 'form-control');
      for (const name of ['low', 'medium', 'high', 'urgent']) { const option = this.element('option', '', name); option.value = name; priority.append(option); }
      priority.value = value.priority; priorityGroup.append(priority); card.append(priorityGroup); fields.priority = priority;
      const status = this.element('p', 'ai-help'); status.setAttribute('role', 'status');
      const button = this.element('button', 'btn btn-primary', action.operation === 'update' ? 'Apply placement' : `Add ${value.itemType}`); button.type = 'submit';
      card.append(button, status);
      card.addEventListener('submit', async event => {
        event.preventDefault(); button.disabled = true; status.textContent = 'Checking availability and saving…';
        let saved = false;
        try {
          const edits = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value || null]));
          await API.post(`/ai/plans/${plan.planId}/actions/${action.index}`, edits);
          saved = true; button.textContent = 'Saved'; status.textContent = 'Saved to your tasks and calendar.';
          for (const input of Object.values(fields)) input.disabled = true;
          await Promise.all([
            SyncManager.invalidate('tasks', '/tasks'), SyncManager.invalidate('tasks-events', '/tasks?itemType=event'), SyncManager.invalidate('dashboard', '/dashboard')
          ]);
        } catch (error) { status.textContent = error.message; }
        finally { if (!saved) button.disabled = false; }
      });
      results.append(card);
    });
    if (!plan.actions.length) overview.append(this.element('p', 'ai-help', 'No task changes proposed. Refine your request if you want a specific placement.'));
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
document.addEventListener('DOMContentLoaded', () => AiAssistant.init());
