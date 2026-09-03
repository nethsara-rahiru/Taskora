let currentView = 'all';
let currentLayout = 'list';

async function initTasksPage() {
  await loadProjectsDropdown();
  setupEventListeners();
  loadCurrentPageData();
}

async function loadProjectsDropdown() {
  // Use SyncManager to serve from cache immediately, revalidate in background
  SyncManager.load('projects', '/projects', (data) => {
    const projects = data?.projects || [];
    const select = document.getElementById('projectFilter');
    if (select) {
      select.innerHTML = '<option value="">All Projects</option>' +
        projects.map(p => `<option value="${p._id}">${TaskCard.escapeHtml(p.name)}</option>`).join('');
    }
  });
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

  const listViewBtn = document.getElementById('listViewBtn');
  const kanbanViewBtn = document.getElementById('kanbanViewBtn');

  listViewBtn?.addEventListener('click', () => {
    currentLayout = 'list';
    listViewBtn.classList.add('active');
    kanbanViewBtn?.classList.remove('active');
    loadCurrentPageData();
  });

  kanbanViewBtn?.addEventListener('click', () => {
    currentLayout = 'kanban';
    kanbanViewBtn.classList.add('active');
    listViewBtn?.classList.remove('active');
    loadCurrentPageData();
  });

  const searchInput = document.getElementById('searchInput');
  const projectFilter = document.getElementById('projectFilter');
  const itemTypeFilter = document.getElementById('itemTypeFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const sortFilter = document.getElementById('sortFilter');

  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadCurrentPageData, 300);
  });

  projectFilter?.addEventListener('change', loadCurrentPageData);
  itemTypeFilter?.addEventListener('change', loadCurrentPageData);
  priorityFilter?.addEventListener('change', loadCurrentPageData);
  sortFilter?.addEventListener('change', loadCurrentPageData);
}

async function loadCurrentPageData() {
  const container = document.getElementById('tasksListContainer');
  if (!container) return;

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const projectId = document.getElementById('projectFilter')?.value || '';
  const itemType = document.getElementById('itemTypeFilter')?.value || '';
  const priority = document.getElementById('priorityFilter')?.value || '';
  const sortBy = document.getElementById('sortFilter')?.value || 'createdAt';

  const queryParams = new URLSearchParams();
  if (currentView !== 'all') queryParams.append('view', currentView);
  if (search) queryParams.append('search', search);
  if (projectId) queryParams.append('projectId', projectId);
  if (itemType) queryParams.append('itemType', itemType);
  if (priority) queryParams.append('priority', priority);
  if (sortBy) queryParams.append('sortBy', sortBy);

  const queryString = queryParams.toString();
  const endpoint = `/tasks${queryString ? '?' + queryString : ''}`;

  // Stale-while-revalidate: render from cache immediately, then update with fresh data
  const hasFilters = search || projectId || itemType || priority || sortBy !== 'createdAt' || currentView !== 'all';
  const cacheKey = hasFilters ? 'tasks_filtered_' + queryString : 'tasks';

  SyncManager.load(cacheKey, endpoint, (data, meta) => {
    const tasks = data?.tasks || [];

    // Show subtle "Refreshing..." indicator on background fetch (not on initial cache load)
    if (!meta?.fromCache) {
      container.querySelectorAll('.task-card-stale-overlay')?.forEach(el => el.remove());
    }

    container.innerHTML = '';
    if (tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-xl); border: 1px solid var(--border-color);">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          </div>
          <p style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">No tasks found</p>
          <p style="font-size: 0.875rem; margin-top: 0.25rem;">Try adjusting your filters or click "+ New Task" to create one.</p>
        </div>
      `;
      return;
    }

    if (currentLayout === 'kanban') {
      renderKanbanBoard(container, tasks);
    } else {
      renderListView(container, tasks);
    }
  });
}

function renderListView(container, tasks) {
  tasks.forEach(task => {
    const card = TaskCard.render(
      task,
      async (id, completed) => {
        // Optimistic update for instant 0ms mobile UI response
        StorageManager.updateTaskInCache(id, { status: completed ? 'completed' : 'pending' });
        loadCurrentPageData();

        const endpoint = completed ? `/tasks/${id}/complete` : `/tasks/${id}/uncomplete`;
        await SyncManager.mutate('POST', endpoint, null, {
          invalidates: [
            { cacheKey: 'tasks', endpoint: '/tasks' },
            { cacheKey: 'dashboard', endpoint: '/dashboard' }
          ]
        });
      },
      (taskToEdit) => App.openTaskModal(taskToEdit),
      async (id) => {
        if (confirm('Are you sure you want to delete this item?')) {
          // Optimistic update for instant 0ms mobile UI response
          StorageManager.removeTaskFromCache(id);
          loadCurrentPageData();

          await SyncManager.mutate('DELETE', `/tasks/${id}`, null, {
            invalidates: [
              { cacheKey: 'tasks', endpoint: '/tasks' },
              { cacheKey: 'dashboard', endpoint: '/dashboard' }
            ]
          });
          Notifications.show('Item deleted', 'info');
        }
      }
    );
    container.appendChild(card);
  });
}

function renderKanbanBoard(container, tasks) {
  const board = document.createElement('div');
  board.className = 'kanban-board';

  const columns = [
    { id: 'pending', title: 'Pending Tasks', tasks: tasks.filter(t => t.status === 'pending') },
    { id: 'in_progress', title: 'In Progress', tasks: tasks.filter(t => t.status === 'in_progress') },
    { id: 'completed', title: 'Completed', tasks: tasks.filter(t => t.status === 'completed') }
  ];

  columns.forEach(col => {
    const colElem = document.createElement('div');
    colElem.className = 'kanban-column';
    colElem.innerHTML = `
      <div class="kanban-column-header">
        <span>${col.title}</span>
        <span class="count-pill">${col.tasks.length}</span>
      </div>
      <div class="kanban-task-list" id="col-${col.id}"></div>
    `;

    const listContainer = colElem.querySelector(`#col-${col.id}`);
    if (col.tasks.length === 0) {
      listContainer.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 1.5rem 0; text-align: center;">No tasks in this column</div>`;
    } else {
      col.tasks.forEach(task => {
        const card = TaskCard.render(
          task,
          async (id, completed) => {
            StorageManager.updateTaskInCache(id, { status: completed ? 'completed' : 'pending' });
            loadCurrentPageData();

            const endpoint = completed ? `/tasks/${id}/complete` : `/tasks/${id}/uncomplete`;
            await SyncManager.mutate('POST', endpoint, null, {
              invalidates: [{ cacheKey: 'tasks', endpoint: '/tasks' }]
            });
          },
          (taskToEdit) => App.openTaskModal(taskToEdit),
          async (id) => {
            if (confirm('Delete item?')) {
              StorageManager.removeTaskFromCache(id);
              loadCurrentPageData();

              await SyncManager.mutate('DELETE', `/tasks/${id}`, null, {
                invalidates: [{ cacheKey: 'tasks', endpoint: '/tasks' }]
              });
            }
          }
        );
        listContainer.appendChild(card);
      });
    }

    board.appendChild(colElem);
  });

  container.appendChild(board);
}

document.addEventListener('DOMContentLoaded', initTasksPage);
window.loadCurrentPageData = loadCurrentPageData;
