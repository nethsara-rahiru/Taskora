const App = {
  async init() {
    this.applySavedTheme();
    
    const user = await Auth.requireAuth();
    if (user) {
      Sidebar.render();
      this.initHeaderUser(user);
      this.initMobileMenu();
      this.initQuickAddBtn();
      this.initThemeToggle();
      this.initMobileFab();
      this.startNotificationPoller();
      this.initDataSync();

      if (typeof window.loadCurrentPageData === 'function') {
        window.loadCurrentPageData();
      }
    }
  },

  initDataSync() {
    // Start background polling for core data
    SyncManager.startPolling([
      { cacheKey: 'tasks', endpoint: '/tasks' },
      { cacheKey: 'projects', endpoint: '/projects' },
      { cacheKey: 'dashboard', endpoint: '/dashboard' },
      { cacheKey: 'timetables', endpoint: '/timetables' }
    ]);
    // Register online/offline + visibility listeners
    SyncManager.initNetworkListeners();

    // Show offline/online banner
    window.addEventListener('offline', () => {
      Notifications.show('You are offline. Data will sync when reconnected.', 'info');
    });
    window.addEventListener('online', () => {
      Notifications.show('Back online!', 'success');
    });
  },

  applySavedTheme() {
    const savedTheme = localStorage.getItem('taskora_theme') || 'system';
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.innerHTML = isDark 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      themeBtn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
  },

  setTheme(theme) {
    localStorage.setItem('taskora_theme', theme);
    this.applySavedTheme();
  },

  initThemeToggle() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = localStorage.getItem('taskora_theme') || 'system';
        const isCurrentlyDark = current === 'dark' || (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        this.setTheme(isCurrentlyDark ? 'light' : 'dark');
      });
    }
  },

  initHeaderUser(user) {
    const userNameElem = document.getElementById('headerUserName');
    if (userNameElem) {
      userNameElem.textContent = user.name;
    }

    const userAvatarElem = document.getElementById('headerUserAvatar');
    if (userAvatarElem) {
      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      userAvatarElem.textContent = initials;
    }

    const dateBadgeElem = document.getElementById('headerDateBadge');
    if (dateBadgeElem) {
      const now = new Date();
      dateBadgeElem.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  },

  initMobileMenu() {
    const headerGroup = document.querySelector('.header-title-group');
    if (headerGroup && !document.getElementById('hamburgerBtn')) {
      const btn = document.createElement('button');
      btn.id = 'hamburgerBtn';
      btn.className = 'btn-icon mobile-hamburger-btn';
      btn.title = 'Open Menu';
      btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      headerGroup.prepend(btn);

      btn.addEventListener('click', () => Sidebar.toggleMobileDrawer());
    }
  },

  initMobileFab() {
    if (!document.getElementById('mobileFabBtn')) {
      const fab = document.createElement('button');
      fab.id = 'mobileFabBtn';
      fab.className = 'mobile-fab-btn';
      fab.title = 'Create New Task';
      fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      document.body.appendChild(fab);

      fab.addEventListener('click', () => this.openTaskModal());
    }
  },

  initQuickAddBtn() {
    const quickAddBtn = document.getElementById('quickAddTaskBtn');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.openTaskModal());
    }
  },

  async openTaskModal(taskToEdit = null) {
    // Load projects from cache first, then fall back to API
    let projects = [];
    const cachedProjects = StorageManager.get('projects') || StorageManager.get('req_/projects');
    if (cachedProjects) {
      projects = cachedProjects.projects || [];
    } else {
      const projectsData = await API.get('/projects').catch(() => ({ projects: [] }));
      projects = projectsData.projects || [];
    }

    const currentItemType = taskToEdit ? (taskToEdit.itemType || 'task') : 'task';

    const formHtml = `
      <form id="taskForm">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">Type of Entry</label>
          <div style="display: flex; gap: 0.5rem; background: var(--bg-input); padding: 0.3rem; border-radius: var(--radius-md);">
            <label style="flex: 1; text-align: center; padding: 0.5rem; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: var(--transition-fast);" id="typeTaskLabel" class="${currentItemType === 'task' ? 'active-type-pill' : ''}">
              <input type="radio" name="itemTypeRadio" value="task" ${currentItemType === 'task' ? 'checked' : ''} style="display: none;">
              ☑ Task (Must complete)
            </label>
            <label style="flex: 1; text-align: center; padding: 0.5rem; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: var(--transition-fast);" id="typeEventLabel" class="${currentItemType === 'event' ? 'active-type-pill' : ''}">
              <input type="radio" name="itemTypeRadio" value="event" ${currentItemType === 'event' ? 'checked' : ''} style="display: none;">
              📅 Event (Ends automatically)
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" id="titleFieldLabel">${currentItemType === 'event' ? 'Event Title *' : 'Task Title *'}</label>
          <input type="text" id="taskTitleInput" class="form-control" placeholder="${currentItemType === 'event' ? 'e.g. Team Sync Meeting' : 'What needs to be done?'}" required value="${taskToEdit ? TaskCard.escapeHtml(taskToEdit.title) : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="taskDescInput" class="form-control" rows="3" placeholder="Add additional context or notes...">${taskToEdit ? TaskCard.escapeHtml(taskToEdit.description || '') : ''}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Project</label>
            <select id="taskProjectSelect" class="form-control">
              <option value="">No Project (Inbox)</option>
              ${projects.map(p => `<option value="${p._id}" ${taskToEdit && taskToEdit.projectId && (taskToEdit.projectId._id || taskToEdit.projectId) === p._id ? 'selected' : ''}>${TaskCard.escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="flex:1;">
            <label class="form-label">Priority</label>
            <select id="taskPrioritySelect" class="form-control">
              <option value="low" ${taskToEdit && taskToEdit.priority === 'low' ? 'selected' : ''}>Low Priority</option>
              <option value="medium" ${!taskToEdit || taskToEdit.priority === 'medium' ? 'selected' : ''}>Medium Priority</option>
              <option value="high" ${taskToEdit && taskToEdit.priority === 'high' ? 'selected' : ''}>High Priority</option>
              <option value="urgent" ${taskToEdit && taskToEdit.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label" id="dateFieldLabel">${currentItemType === 'event' ? 'Event Date' : 'Due Date'}</label>
            <input type="date" id="taskDueDateInput" class="form-control" value="${taskToEdit && taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : ''}">
          </div>

          <div class="form-group" style="flex:1;" id="taskDueTimeGroup">
            <label class="form-label">Time</label>
            <input type="time" id="taskDueTimeInput" class="form-control" value="${taskToEdit ? taskToEdit.dueTime || taskToEdit.startTime || '' : ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Reminder</label>
            <select id="taskReminderSelect" class="form-control">
              <option value="0">At scheduled time</option>
              <option value="15" selected>15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </select>
          </div>

          <div class="form-group" style="flex:1;">
            <label class="form-label">Tags (comma separated)</label>
            <input type="text" id="taskTagsInput" class="form-control" placeholder="work, urgent" value="${taskToEdit && taskToEdit.tags ? taskToEdit.tags.join(', ') : ''}">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modalSubmitBtn">${taskToEdit ? 'Save Changes' : (currentItemType === 'event' ? 'Create Event' : 'Create Task')}</button>
        </div>
      </form>
      <style>
        .active-type-pill {
          background: var(--bg-surface) !important;
          color: var(--primary) !important;
          box-shadow: var(--shadow-xs);
        }
      </style>
    `;

    Modal.open(taskToEdit ? (taskToEdit.itemType === 'event' ? 'Edit Event' : 'Edit Task') : 'Create New Entry', formHtml);

    // Wire radio toggle listener
    const radios = document.getElementsByName('itemTypeRadio');
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = e.target.value;
        const isEv = val === 'event';
        document.getElementById('typeTaskLabel').className = !isEv ? 'active-type-pill' : '';
        document.getElementById('typeEventLabel').className = isEv ? 'active-type-pill' : '';
        document.getElementById('titleFieldLabel').textContent = isEv ? 'Event Title *' : 'Task Title *';
        document.getElementById('dateFieldLabel').textContent = isEv ? 'Event Date' : 'Due Date';
        if (!taskToEdit) {
          document.getElementById('modalSubmitBtn').textContent = isEv ? 'Create Event' : 'Create Task';
        }
      });
    });

    document.getElementById('taskForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedType = document.querySelector('input[name="itemTypeRadio"]:checked')?.value || 'task';
      const timeVal = document.getElementById('taskDueTimeInput').value || null;

      const payload = {
        itemType: selectedType,
        title: document.getElementById('taskTitleInput').value.trim(),
        description: document.getElementById('taskDescInput').value.trim(),
        projectId: document.getElementById('taskProjectSelect').value || null,
        priority: document.getElementById('taskPrioritySelect').value,
        dueDate: document.getElementById('taskDueDateInput').value || null,
        dueTime: timeVal,
        startTime: selectedType === 'event' ? timeVal : null,
        endTime: selectedType === 'event' ? timeVal : null,
        reminderMinutes: parseInt(document.getElementById('taskReminderSelect').value, 10),
        tags: document.getElementById('taskTagsInput').value.split(',').map(t => t.trim()).filter(Boolean)
      };

      try {
        const invalidates = [
          { cacheKey: 'tasks', endpoint: '/tasks' },
          { cacheKey: 'dashboard', endpoint: '/dashboard' }
        ];
        if (taskToEdit) {
          await SyncManager.mutate('PUT', `/tasks/${taskToEdit._id}`, payload, { invalidates });
          Notifications.show(`${selectedType === 'event' ? 'Event' : 'Task'} updated successfully!`, 'success');
        } else {
          await SyncManager.mutate('POST', '/tasks', payload, { invalidates });
          Notifications.show(`${selectedType === 'event' ? 'Event' : 'Task'} created successfully!`, 'success');
        }
        Modal.close();
        if (window.loadCurrentPageData) window.loadCurrentPageData();
      } catch (err) {
        Notifications.show(err.message, 'error');
      }
    });
  },

  startNotificationPoller() {
    setInterval(async () => {
      try {
        const data = await API.get('/whatsapp/notifications');
        if (data.notifications && data.notifications.length > 0) {
          const unread = data.notifications.filter(n => n.status === 'unread' || n.status === 'sent');
          for (const n of unread) {
            Notifications.alertReminder(n.taskId?.title || 'Task Due', n.taskId?.dueTime || '');
            await API.post(`/whatsapp/notifications/${n._id}/read`).catch(() => {});
          }
        }
      } catch (e) {}
    }, 20000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
