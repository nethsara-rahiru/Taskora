const App = {
  async init() {
    this.applySavedTheme();
    
    const user = await Auth.requireAuth();
    if (user) {
      Sidebar.render();
      this.initHeaderUser(user);
      this.initQuickAddBtn();
      this.startNotificationPoller();
    }
  },

  applySavedTheme() {
    const savedTheme = localStorage.getItem('taskora_theme') || 'system';
    if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  },

  setTheme(theme) {
    localStorage.setItem('taskora_theme', theme);
    this.applySavedTheme();
  },

  initHeaderUser(user) {
    const userNameElem = document.getElementById('headerUserName');
    if (userNameElem) {
      userNameElem.textContent = user.name;
    }
  },

  initQuickAddBtn() {
    const quickAddBtn = document.getElementById('quickAddTaskBtn');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.openTaskModal());
    }
  },

  async openTaskModal(taskToEdit = null) {
    const projectsData = await API.get('/projects').catch(() => ({ projects: [] }));
    const projects = projectsData.projects || [];

    const formHtml = `
      <form id="taskForm">
        <div class="form-group">
          <label class="form-label">Task Title *</label>
          <input type="text" id="taskTitleInput" class="form-control" placeholder="What needs to be done?" required value="${taskToEdit ? TaskCard.escapeHtml(taskToEdit.title) : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="taskDescInput" class="form-control" rows="2" placeholder="Add additional details...">${taskToEdit ? TaskCard.escapeHtml(taskToEdit.description || '') : ''}</textarea>
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
              <option value="low" ${taskToEdit && taskToEdit.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${!taskToEdit || taskToEdit.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${taskToEdit && taskToEdit.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="urgent" ${taskToEdit && taskToEdit.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Due Date</label>
            <input type="date" id="taskDueDateInput" class="form-control" value="${taskToEdit && taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : ''}">
          </div>

          <div class="form-group" style="flex:1;">
            <label class="form-label">Due Time</label>
            <input type="time" id="taskDueTimeInput" class="form-control" value="${taskToEdit ? taskToEdit.dueTime || '' : ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Reminder (Minutes Before)</label>
            <select id="taskReminderSelect" class="form-control">
              <option value="0">At due time</option>
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
          <button type="submit" class="btn btn-primary">${taskToEdit ? 'Save Changes' : 'Create Task'}</button>
        </div>
      </form>
    `;

    Modal.open(taskToEdit ? 'Edit Task' : 'Create New Task', formHtml);

    document.getElementById('taskForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('taskTitleInput').value.trim(),
        description: document.getElementById('taskDescInput').value.trim(),
        projectId: document.getElementById('taskProjectSelect').value || null,
        priority: document.getElementById('taskPrioritySelect').value,
        dueDate: document.getElementById('taskDueDateInput').value || null,
        dueTime: document.getElementById('taskDueTimeInput').value || null,
        reminderMinutes: parseInt(document.getElementById('taskReminderSelect').value, 10),
        tags: document.getElementById('taskTagsInput').value.split(',').map(t => t.trim()).filter(Boolean)
      };

      try {
        if (taskToEdit) {
          await API.put(`/tasks/${taskToEdit._id}`, payload);
          Notifications.show('Task updated successfully!', 'success');
        } else {
          await API.post('/tasks', payload);
          Notifications.show('Task created successfully!', 'success');
        }
        Modal.close();
        if (window.loadCurrentPageData) window.loadCurrentPageData();
      } catch (err) {
        Notifications.show(err.message, 'error');
      }
    });
  },

  startNotificationPoller() {
    // Poll for notifications every 20 seconds
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
      } catch (e) {
        // Silent poll error handling
      }
    }, 20000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
