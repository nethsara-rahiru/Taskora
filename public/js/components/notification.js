const Notifications = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 4000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || 'ℹ'}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  alertReminder(taskTitle, dueTime) {
    // Standard browser alert fallback as requested
    const msg = `🔔 Taskora Task Reminder:\n\nTask: "${taskTitle}" is due now!${dueTime ? ` (${dueTime})` : ''}`;
    this.show(`🔔 Task Reminder: "${taskTitle}" is due!`, 'warning', 7000);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Taskora Reminder', { body: `"${taskTitle}" is due!` });
    } else {
      alert(msg);
    }
  }
};

window.Notifications = Notifications;
