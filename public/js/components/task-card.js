const TaskCard = {
  render(task, onToggleComplete, onEdit, onDelete) {
    const card = document.createElement('div');
    card.className = `task-card ${task.status === 'completed' ? 'completed' : ''}`;
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

    card.innerHTML = `
      <div class="task-checkbox" title="Toggle complete">
        ${task.status === 'completed' ? '✓' : ''}
      </div>
      <div class="task-content">
        <div class="task-title">${this.escapeHtml(task.title)}</div>
        ${task.description ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">${this.escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          <span class="badge ${priorityBadgeClass}">${task.priority}</span>
          ${formattedDueDate ? `<span>📅 ${formattedDueDate} ${task.dueTime || ''}</span>` : ''}
          ${task.projectId ? `<span style="color: ${task.projectId.color || 'var(--primary)'}; font-weight: 600;">📁 ${this.escapeHtml(task.projectId.name)}</span>` : ''}
          ${task.tags && task.tags.length > 0 ? task.tags.map(t => `<span class="tag-chip">#${this.escapeHtml(t)}</span>`).join('') : ''}
          ${task.recurring && task.recurring.enabled ? `<span title="Recurring task">🔄 ${task.recurring.frequency}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon edit-task-btn" title="Edit Task">✏️</button>
        <button class="btn-icon delete-task-btn" title="Delete Task">🗑️</button>
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
