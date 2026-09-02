const Sidebar = {
  render(activePath = '') {
    const currentPath = activePath || window.location.pathname;

    const navItems = [
      { path: '/dashboard.html', label: 'Dashboard', icon: '📊' },
      { path: '/tasks.html', label: 'Tasks', icon: '✅' },
      { path: '/projects.html', label: 'Projects', icon: '📁' },
      { path: '/calendar.html', label: 'Calendar', icon: '📅' },
      { path: '/settings.html', label: 'Settings', icon: '⚙️' }
    ];

    const sidebarHtml = `
      <div class="sidebar-header">
        <div class="brand-logo">
          ⚡ <span>Taskora</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(item => `
          <a href="${item.path}" class="nav-item ${currentPath.includes(item.path) ? 'active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="btn btn-secondary btn-sm" style="width: 100%;" id="logoutBtn">
          🚪 Logout
        </button>
      </div>
    `;

    const sidebarElem = document.querySelector('.sidebar');
    if (sidebarElem) {
      sidebarElem.innerHTML = sidebarHtml;
      document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
    }
  }
};

window.Sidebar = Sidebar;
