let currentView = 'all';

async function initTasksPage() {
  await loadProjectsDropdown();
  setupEventListeners();
  loadCurrentPageData();
}

async function loadProjectsDropdown() {
  try {
    const data = await API.get('/projects');
    const select = document.getElementById('projectFilter');
    if (select && data.projects) {
      select.innerHTML = '<option value="">All Projects</option>' +
        data.projects.map(p => `<option value="${p._id}">${TaskCard.escapeHtml(p.name)}</option>`).join('');
    }
  } catch (e) {}
}

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentView = e.target.dataset.view;
      loadCurrentPageData();
    });
  });

  const searchInput = document.getElementById('searchInput');
  const projectFilter = document.getElementById('projectFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const sortFilter = document.getElementById('sortFilter');

  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadCurrentPageData, 300);
  });

  projectFilter?.addEventListener('change', loadCurrentPageData);
  priorityFilter?.addEventListener('change', loadCurrentPageData);
  sortFilter?.addEventListener('change', loadCurrentPageData);
}

async function loadCurrentPageData() {
  const container = document.getElementById('tasksListContainer');
  if (!container) return;

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const projectId = document.getElementById('projectFilter')?.value || '';
  const priority = document.getElementById('priorityFilter')?.value || '';
  const sortBy = document.getElementById('sortFilter')?.value || 'createdAt';

  const queryParams = new URLSearchParams();
  if (currentView !== 'all') queryParams.append('view', currentView);
  if (search) queryParams.append('search', search);
  if (projectId) queryParams.append('projectId', projectId);
  if (priority) queryParams.append('priority', priority);
  if (sortBy) queryParams.append('sortBy', sortBy);

  try {
    const data = await API.get(`/tasks?${queryParams.toString()}`);
    const tasks = data.tasks || [];

    container.innerHTML = '';
    if (tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📋</div>
          <p style="font-weight: 600;">No tasks found</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your filters or click "+ Add Task" to create one.</p>
        </div>
      `;
      return;
    }

    tasks.forEach(task => {
      const card = TaskCard.render(
        task,
        async (id, completed) => {
          const endpoint = completed ? `/tasks/${id}/complete` : `/tasks/${id}/uncomplete`;
          await API.post(endpoint);
          loadCurrentPageData();
        },
        (taskToEdit) => App.openTaskModal(taskToEdit),
        async (id) => {
          if (confirm('Are you sure you want to delete this task?')) {
            await API.delete(`/tasks/${id}`);
            Notifications.show('Task deleted', 'info');
            loadCurrentPageData();
          }
        }
      );
      container.appendChild(card);
    });
  } catch (err) {
    Notifications.show(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initTasksPage);
window.loadCurrentPageData = loadCurrentPageData;
