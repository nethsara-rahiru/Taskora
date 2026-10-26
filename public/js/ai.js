const AiAssistant = {
  targets: new Map(),
  async init() {
    document.getElementById('generateAiBtn').disabled = true;
    document.getElementById('aiSetupStatus').classList.add('loading-text');
    const params = new URLSearchParams(location.search);
    const dateInput = document.getElementById('aiPlanningDate');
    const now = new Date();
    dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') :
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (['quick_add', 'schedule', 'recommend', 'update'].includes(params.get('mode'))) document.getElementById('aiMode').value = params.get('mode');
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
    finally { document.getElementById('aiSetupStatus').classList.remove('loading-text'); }
    await this.loadTargets();
    document.getElementById('aiTarget').addEventListener('change', event => { if (event.target.value) document.getElementById('aiMode').value = 'update'; });
    document.getElementById('aiMode').addEventListener('change', event => {
      if (event.target.value === 'quick_add') document.getElementById('aiTarget').value = '';
    });
    document.querySelectorAll('.ai-examples button').forEach(button => button.addEventListener('click', () => {
      document.getElementById('aiMode').value = button.dataset.mode;
      if (button.dataset.mode === 'quick_add') document.getElementById('aiTarget').value = '';
      document.getElementById('aiPrompt').value = button.dataset.prompt;
      document.getElementById('aiPrompt').focus();
    }));
    LoadingUI.bindForm(document.getElementById('aiRequestForm'), event => this.generate(event));
    document.getElementById('generateAiBtn').disabled = false;
  },
  async generate(event) {
    event.preventDefault();
    const button = document.getElementById('generateAiBtn'); const status = document.getElementById('aiRequestStatus');
    button.disabled = true; button.textContent = 'Thinking…'; status.textContent = 'Checking your tasks and schedule with Groq…';
    try {
      const target = this.targets.get(document.getElementById('aiTarget').value) || null;
      const result = await API.post('/ai/plan', { mode: document.getElementById('aiMode').value,
        target, date: document.getElementById('aiPlanningDate').value, prompt: document.getElementById('aiPrompt').value.trim() });
      this.render(result); status.textContent = 'Suggestions ready. Nothing has been changed yet.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; button.textContent = 'Generate suggestions'; }
  },
  async loadTargets() {
    const select = document.getElementById('aiTarget');
    const previous = select.value; select.disabled = true;
    const label = document.querySelector('label[for="aiTarget"]'); label.classList.add('loading-text');
    try {
      const [taskData, scheduleData] = await Promise.all([API.get('/tasks'), API.get('/timetables')]);
      select.replaceChildren(this.element('option', '', 'Let AI identify the item from my request')); select.firstElementChild.value = '';
      this.targets.clear();
      const add = (group, text, target) => {
        const key = JSON.stringify(target); this.targets.set(key, target);
        const option = this.element('option', '', text); option.value = key; group.append(option);
      };
      const tasks = document.createElement('optgroup'); tasks.label = 'Tasks and events';
      (taskData.tasks || []).filter(task => ['pending', 'in_progress'].includes(task.status)).forEach(task => add(tasks,
        `${task.itemType === 'event' ? 'Event' : 'Task'}: ${task.title}`, { type: task.itemType || 'task', id: task._id })); select.append(tasks);
      const schedules = document.createElement('optgroup'); schedules.label = 'Schedules and weekly slots';
      for (const timetable of scheduleData.timetables || []) {
        add(schedules, `Schedule: ${timetable.title}`, { type: 'timetable', id: timetable._id });
        for (const slot of timetable.slots || []) add(schedules, `Slot: ${timetable.title} — ${slot.subject} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][slot.dayOfWeek]} ${slot.startTime})`,
          { type: 'slot', id: timetable._id, slotId: slot._id });
      }
      select.append(schedules); if (this.targets.has(previous)) select.value = previous;
    } catch (_) { /* Generation still works without an explicit target. */ }
    finally { select.disabled = false; label.classList.remove('loading-text'); }
  },
  describe(value) {
    if ('subject' in value) return `${value.subject} · ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][value.dayOfWeek]} ${value.startTime}–${value.endTime}${value.room ? ` · ${value.room}` : ''}`;
    if ('isPaused' in value) return `${value.title} · ${value.priority} · ${value.isPaused ? 'Paused' : 'Enabled'} · ${value.startsOn || 'No start limit'} to ${value.endsOn || 'No end limit'} · ${(value.skipRanges || []).length} skip ranges`;
    return [value.title, value.priority, value.dueDate || 'No date', value.dueTime || 'No time', value.endTime ? `to ${value.endTime}` : ''].filter(Boolean).join(' · ');
  },
  timetableProposal(plan, action) {
    const isSlot = action.targetType === 'slot'; const value = action.values; const fields = {};
    const card = this.element('form', 'ai-panel ai-proposal');
    card.append(this.element('h3', '', isSlot ? `Update weekly slot — ${action.targetTitle}` : 'Update schedule'), this.element('p', 'ai-help', action.reason));
    if (action.originalValues) card.append(this.element('p', 'ai-before', `Current: ${this.describe(action.originalValues)}`));
    const field = (name, label, type = 'text') => {
      const group = this.element('label', 'form-group'); group.append(this.element('span', 'form-label', label));
      const input = this.element('input', 'form-control'); input.type = type; input.value = value[name] ?? '';
      if (['title', 'subject', 'startTime', 'endTime'].includes(name)) input.required = true;
      group.append(input); fields[name] = input; card.append(group);
    };
    const select = (name, label, options) => {
      const group = this.element('label', 'form-group'); group.append(this.element('span', 'form-label', label));
      const input = this.element('select', 'form-control');
      options.forEach(([key, text]) => { const option = this.element('option', '', text); option.value = key; input.append(option); });
      input.value = value[name]; group.append(input); fields[name] = input; card.append(group);
    };
    const rangeValues = (value.skipRanges || []).map(range => ({ start: range.start, end: range.end }));
    if (isSlot) {
      field('subject', 'Slot title'); select('dayOfWeek', 'Weekday', ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, index) => [index, day]));
      field('startTime', 'Start time', 'time'); field('endTime', 'End time', 'time'); field('room', 'Location'); field('teacher', 'Organizer / with');
      card.append(this.element('p', 'ai-help', 'This changes the weekly template for all active weeks. Conflict checks cover the selected planning week.'));
    } else {
      field('title', 'Schedule title'); field('description', 'Description'); select('priority', 'Priority', ['low','medium','high','urgent'].map(priority => [priority, priority]));
      field('startsOn', 'Start date (optional)', 'date'); field('endsOn', 'Follow through (optional)', 'date');
      const pause = this.element('label', 'form-label'); const checkbox = this.element('input'); checkbox.type = 'checkbox'; checkbox.checked = value.isPaused;
      pause.append(checkbox, document.createTextNode(' Pause this schedule')); card.append(pause); fields.isPaused = checkbox;
      const ranges = this.element('div'); card.append(this.element('p', 'ai-help', 'Skipped dates/ranges (inclusive). Removing a range restores those occurrences.'), ranges);
      const renderRanges = () => {
        ranges.replaceChildren(); rangeValues.forEach((range, index) => {
          const row = this.element('div', 'schedule-skip-row');
          for (const [key, title] of [['start','From'],['end','Through']]) {
            const label = this.element('label', 'form-label', title); const input = this.element('input', 'form-control'); input.type = 'date'; input.required = true; input.value = range[key];
            input.addEventListener('change', () => { range[key] = input.value; }); label.append(input); row.append(label);
          }
          const remove = this.element('button', 'btn-icon', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove skip range ${index + 1}`);
          remove.addEventListener('click', () => { rangeValues.splice(index, 1); renderRanges(); }); row.append(remove); ranges.append(row);
        });
      }; renderRanges();
      const add = this.element('button', 'btn btn-secondary btn-sm', 'Add skip range'); add.type = 'button'; add.addEventListener('click', () => { rangeValues.push({ start: '', end: '' }); renderRanges(); }); card.append(add);
    }
    const status = this.element('p', 'ai-help'); status.setAttribute('role', 'status');
    const button = this.element('button', 'btn btn-primary', isSlot ? 'Update weekly slot' : 'Update schedule'); button.type = 'submit'; card.append(status, button);
    LoadingUI.bindForm(card, async event => {
      event.preventDefault(); button.disabled = true; status.textContent = 'Validating and saving…'; let saved = false;
      try {
        const edits = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : key === 'dayOfWeek' ? Number(input.value) : input.value]));
        if (!isSlot) edits.skipRanges = rangeValues;
        await API.post(`/ai/plans/${plan.planId}/actions/${action.index}`, edits); saved = true; button.textContent = 'Saved'; status.textContent = 'Saved to Timetables & Schedules.';
        card.querySelectorAll('input, select, button').forEach(input => { input.disabled = true; }); await this.loadTargets();
        await Promise.all([SyncManager.invalidate('timetables','/timetables'), SyncManager.invalidate('dashboard','/dashboard')]);
      } catch (error) { status.textContent = error.message; }
      finally { if (!saved) button.disabled = false; }
    });
    return card;
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
      if (['timetable', 'slot'].includes(action.targetType)) { results.append(this.timetableProposal(plan, action)); return; }
      const card = this.element('form', 'ai-panel ai-proposal'); const value = action.values;
      card.append(this.element('h3', '', action.operation === 'update' ? `Update ${value.itemType}` : `New ${value.itemType}`), this.element('p', 'ai-help', action.reason));
      if (action.originalValues) card.append(this.element('p', 'ai-before', `Current: ${this.describe(action.originalValues)}`));
      if (action.conflicts?.length) card.append(this.element('p', 'ai-conflict', `Choose another time: overlaps ${action.conflicts.join(', ')}.`));
      const fields = {};
      const field = (name, label, type = 'text') => {
        const group = this.element('label', 'form-group'); group.append(this.element('span', 'form-label', label));
        const input = document.createElement('input'); input.type = type; input.className = 'form-control'; input.value = value[name] || '';
        if (name === 'title') { input.required = true; input.maxLength = 240; }
        if ((value.itemType === 'event' && ['dueDate', 'dueTime', 'endTime'].includes(name))) input.required = true;
        group.append(input); fields[name] = input; return group;
      };
      card.append(field('title', 'Title'), field('description', 'Description'));
      const row = this.element('div', 'form-row'); row.append(field('dueDate', 'Date', 'date'), field('dueTime', value.itemType === 'event' ? 'Start time' : 'Task time', 'time'));
      if (value.itemType === 'event') row.append(field('endTime', 'End time', 'time')); card.append(row);
      const priorityGroup = this.element('label', 'form-group'); priorityGroup.append(this.element('span', 'form-label', 'Priority'));
      const priority = this.element('select', 'form-control');
      for (const name of ['low', 'medium', 'high', 'urgent']) { const option = this.element('option', '', name); option.value = name; priority.append(option); }
      priority.value = value.priority; priorityGroup.append(priority); card.append(priorityGroup); fields.priority = priority;
      const status = this.element('p', 'ai-help'); status.setAttribute('role', 'status');
      const button = this.element('button', 'btn btn-primary', action.operation === 'update' ? `Update ${value.itemType}` : `Add ${value.itemType}`); button.type = 'submit';
      card.append(button, status);
      LoadingUI.bindForm(card, async event => {
        event.preventDefault(); button.disabled = true; status.textContent = 'Checking availability and saving…';
        let saved = false;
        try {
          const edits = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, ['dueDate', 'dueTime', 'endTime'].includes(key) ? input.value || null : input.value]));
          await API.post(`/ai/plans/${plan.planId}/actions/${action.index}`, edits);
          saved = true; button.textContent = 'Saved'; status.textContent = 'Saved to your tasks and calendar.';
          await this.loadTargets();
          for (const input of Object.values(fields)) input.disabled = true;
          await Promise.all([
            SyncManager.invalidate('tasks', '/tasks'), SyncManager.invalidate('tasks-events', '/tasks?itemType=event'), SyncManager.invalidate('dashboard', '/dashboard'), SyncManager.invalidate('timetables', '/timetables')
          ]);
        } catch (error) { status.textContent = error.message; }
        finally { if (!saved) button.disabled = false; }
      });
      results.append(card);
    });
    if (!plan.actions.length) overview.append(this.element('p', 'ai-help', 'No changes proposed. Refine your request if you want a specific placement.'));
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
document.addEventListener('DOMContentLoaded', () => AiAssistant.init());
