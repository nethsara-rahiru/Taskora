// Latest fetched data stored for cross-cache compositing
let _cachedProjects = [];
let _cachedAllTasks = [];

function renderProjectsUI() {
  const container = document.getElementById('projectsContainer');
  if (!container) return;

  const projects = _cachedProjects;
  const allTasks = _cachedAllTasks;

  container.innerHTML = '';
  if (projects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-xl); border: 1px solid var(--border-color);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <p style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">No projects created yet</p>
        <p style="font-size: 0.875rem; margin-top: 0.25rem;">Group your tasks into projects like Work, Personal, or University.</p>
      </div>
    `;
    return;
  }

  projects.forEach(project => {
    const projTasks = allTasks.filter(t => t.projectId && (t.projectId._id || t.projectId) === project._id);
    const completedCount = projTasks.filter(t => t.status === 'completed').length;
    const progressPercent = projTasks.length > 0 ? Math.round((completedCount / projTasks.length) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.85rem;">
          <div style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.65rem;">
            <span style="display:inline-block; width:14px; height:14px; border-radius:50%; background-color:${project.color || '#6366F1'}; box-shadow: 0 0 10px ${project.color || '#6366F1'};"></span>
            ${TaskCard.escapeHtml(project.name)}
          </div>
          <div class="task-actions" style="opacity: 1;">
            <button class="btn-icon edit-project-btn" title="Edit Project">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon delete-project-btn" title="Delete Project">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.4;">${TaskCard.escapeHtml(project.description || 'No project description provided.')}</p>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size: 0.8rem; font-weight:600; color: var(--text-muted); margin-bottom: 0.4rem;">
          <span>${completedCount} of ${projTasks.length} Tasks Done</span>
          <span>${progressPercent}%</span>
        </div>
        <div style="width:100%; height:6px; background:var(--bg-input); border-radius:3px; overflow:hidden; margin-bottom: 1rem;">
          <div style="width:${progressPercent}%; height:100%; background:${project.color || 'var(--primary)'};"></div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid var(--border-color); pt: 0.85rem; padding-top:0.75rem;">
          <span style="font-size: 0.75rem; color: var(--text-light);">Updated ${new Date(project.updatedAt).toLocaleDateString()}</span>
          <a href="/tasks.html?projectId=${project._id}" style="font-size: 0.85rem; font-weight: 700; display:inline-flex; align-items:center; gap:0.3rem;">
            View Tasks →
          </a>
        </div>
      </div>
    `;

    card.querySelector('.edit-project-btn').addEventListener('click', () => openProjectModal(project));
    card.querySelector('.delete-project-btn').addEventListener('click', async () => {
      if (confirm(`Delete project "${project.name}"?`)) {
        await SyncManager.mutate('DELETE', `/projects/${project._id}`, null, {
          invalidates: [
            { cacheKey: 'projects', endpoint: '/projects' },
            { cacheKey: 'tasks', endpoint: '/tasks' }
          ]
        });
        Notifications.show('Project deleted', 'info');
        loadCurrentPageData();
      }
    });

    container.appendChild(card);
  });
}

async function loadCurrentPageData() {
  // Load projects from cache instantly, then revalidate in background
  SyncManager.load('projects', '/projects', (data) => {
    _cachedProjects = data?.projects || [];
    renderProjectsUI();
  });

  // Load tasks from cache instantly, then revalidate in background
  SyncManager.load('tasks', '/tasks', (data) => {
    _cachedAllTasks = data?.tasks || [];
    renderProjectsUI();
  });
}


function openProjectModal(projectToEdit = null) {
  const formHtml = `
    <form id="projectForm">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input type="text" id="projNameInput" class="form-control" placeholder="e.g. Work / University / Personal" required value="${projectToEdit ? TaskCard.escapeHtml(projectToEdit.name) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="projDescInput" class="form-control" rows="3" placeholder="Brief summary of project goals...">${projectToEdit ? TaskCard.escapeHtml(projectToEdit.description || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Color Theme Accent</label>
        <input type="color" id="projColorInput" class="form-control" value="${projectToEdit ? projectToEdit.color : '#6366F1'}" style="height:44px; padding:3px; cursor:pointer;">
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button type="submit" class="btn btn-primary">${projectToEdit ? 'Save Changes' : 'Create Project'}</button>
      </div>
    </form>
  `;

  Modal.open(projectToEdit ? 'Edit Project' : 'Create Project', formHtml);

  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('projNameInput').value.trim(),
      description: document.getElementById('projDescInput').value.trim(),
      color: document.getElementById('projColorInput').value
    };

    try {
      const invalidates = [{ cacheKey: 'projects', endpoint: '/projects' }];
      if (projectToEdit) {
        await SyncManager.mutate('PUT', `/projects/${projectToEdit._id}`, payload, { invalidates });
        Notifications.show('Project updated!', 'success');
      } else {
        await SyncManager.mutate('POST', '/projects', payload, { invalidates });
        Notifications.show('Project created!', 'success');
      }
      Modal.close();
      loadCurrentPageData();
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });
}

function initProjectsPage() {
  document.getElementById('createProjectBtn')?.addEventListener('click', () => openProjectModal());
  loadCurrentPageData();
}

document.addEventListener('DOMContentLoaded', initProjectsPage);
window.initProjectsPage = initProjectsPage;
window.loadCurrentPageData = loadCurrentPageData;
