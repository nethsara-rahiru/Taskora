async function loadCurrentPageData() {
  const container = document.getElementById('projectsContainer');
  if (!container) return;

  try {
    const data = await API.get('/projects');
    const projects = data.projects || [];

    container.innerHTML = '';
    if (projects.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📁</div>
          <p style="font-weight: 600;">No projects yet</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Organize tasks into projects like Work, Personal, or University.</p>
        </div>
      `;
      return;
    }

    projects.forEach(project => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <div>
          <div class="project-header">
            <div class="project-title">
              <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${project.color || '#6366F1'};"></span>
              ${TaskCard.escapeHtml(project.name)}
            </div>
            <div class="task-actions">
              <button class="btn-icon edit-project-btn">✏️</button>
              <button class="btn-icon delete-project-btn">🗑️</button>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">${TaskCard.escapeHtml(project.description || 'No description provided.')}</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid var(--border-color); pt: 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
          <span>Project</span>
          <a href="/tasks.html?projectId=${project._id}" style="font-weight: 600;">View Tasks →</a>
        </div>
      `;

      card.querySelector('.edit-project-btn').addEventListener('click', () => openProjectModal(project));
      card.querySelector('.delete-project-btn').addEventListener('click', async () => {
        if (confirm(`Delete project "${project.name}"?`)) {
          await API.delete(`/projects/${project._id}`);
          Notifications.show('Project deleted', 'info');
          loadCurrentPageData();
        }
      });

      container.appendChild(card);
    });
  } catch (err) {
    Notifications.show(err.message, 'error');
  }
}

function openProjectModal(projectToEdit = null) {
  const formHtml = `
    <form id="projectForm">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input type="text" id="projNameInput" class="form-control" placeholder="e.g. University / Work" required value="${projectToEdit ? TaskCard.escapeHtml(projectToEdit.name) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="projDescInput" class="form-control" rows="2" placeholder="Brief summary of this project...">${projectToEdit ? TaskCard.escapeHtml(projectToEdit.description || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Color Theme</label>
        <input type="color" id="projColorInput" class="form-control" value="${projectToEdit ? projectToEdit.color : '#6366F1'}" style="height:42px; padding:2px;">
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
      if (projectToEdit) {
        await API.put(`/projects/${projectToEdit._id}`, payload);
        Notifications.show('Project updated!', 'success');
      } else {
        await API.post('/projects', payload);
        Notifications.show('Project created!', 'success');
      }
      Modal.close();
      loadCurrentPageData();
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createProjectBtn')?.addEventListener('click', () => openProjectModal());
  loadCurrentPageData();
});

window.loadCurrentPageData = loadCurrentPageData;
