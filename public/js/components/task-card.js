const TaskCard = {
  render(task, onToggleComplete, onEdit, onDelete) {
    const card = document.createElement('div');
    const isEvent = task.itemType === 'event';
    card.className = `task-card ${task.status === 'completed' ? 'completed' : ''} ${isEvent ? 'event-card' : ''}`;
    card.dataset.id = task._id;

    const formattedDueDate = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;

    const priorityBadgeClass = {
      low: 'badge-low',
      medium: 'badge-medium',
      high: 'badge-high',
      urgent: 'badge-urgent'
    }[task.priority || 'medium'];

    // Time display string
    let timeDisplay = '';
    if (isEvent) {
      if (task.startTime && task.endTime) {
        timeDisplay = `${task.startTime} - ${task.endTime}`;
      } else if (task.startTime || task.dueTime) {
        timeDisplay = task.startTime || task.dueTime;
      }
    } else if (task.dueTime) {
      timeDisplay = `at ${task.dueTime}`;
    }

    card.innerHTML = `
      <div class="task-checkbox" title="${isEvent ? 'Mark event finished' : 'Mark task ' + (task.status === 'completed' ? 'incomplete' : 'complete')}">
        ${task.status === 'completed' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
      </div>
      <div class="task-content">
        <div class="task-title" style="display:flex; align-items:center; gap:0.5rem;">
          ${isEvent ? `<span style="display:inline-flex; align-items:center; gap:0.2rem; background:rgba(147, 51, 234, 0.12); color:#9333ea; font-size:0.7rem; font-weight:800; padding:0.15rem 0.45rem; border-radius:4px; text-transform:uppercase;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Event</span>` : ''}
          ${this.escapeHtml(task.title)}
          ${task.autoCompleted ? `<span style="font-size:0.7rem; background:var(--bg-input); color:var(--text-muted); padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">Ended</span>` : ''}
        </div>
        ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          ${!isEvent ? `
            <span class="badge ${priorityBadgeClass}">
              <span class="badge-dot"></span>
              ${task.priority || 'medium'}
            </span>
          ` : ''}

          ${formattedDueDate ? `
            <span class="task-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              ${formattedDueDate} ${timeDisplay}
            </span>
          ` : ''}

          ${task.projectId ? `
            <span class="task-meta-item" style="color: ${task.projectId.color || 'var(--primary)'}; font-weight: 600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              ${this.escapeHtml(task.projectId.name)}
            </span>
          ` : ''}

          ${task.tags && task.tags.length > 0 ? task.tags.map(t => `
            <span class="tag-chip">#${this.escapeHtml(t)}</span>
          `).join('') : ''}

          ${task.recurring && task.recurring.enabled ? `
            <span class="task-meta-item" title="Recurring (${task.recurring.frequency})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              ${task.recurring.frequency}
            </span>
          ` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon edit-task-btn" title="Edit ${isEvent ? 'Event' : 'Task'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn-icon delete-task-btn" title="Delete ${isEvent ? 'Event' : 'Task'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    card.querySelector('.task-checkbox').addEventListener('click', () => {
      if (onToggleComplete) onToggleComplete(task._id, task.status !== 'completed');
    });

    card.querySelector('.edit-task-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onEdit) onEdit(task);
    });

    card.querySelector('.delete-task-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onDelete) onDelete(task._id);
    });

    return card;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }
};

window.TaskCard = TaskCard;
