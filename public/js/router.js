const Router = {
  cache: new Map(),

  init() {
    // Intercept clicks on internal navigation links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      // Only intercept relative HTML links (not javascript:, #, external http, logout)
      if (href && href.endsWith('.html') && !href.startsWith('http') && !link.dataset.noRouter) {
        e.preventDefault();
        this.navigate(href);
      }
    });

    // Handle browser Back / Forward buttons
    window.addEventListener('popstate', () => {
      this.navigate(window.location.pathname, false);
    });
  },

  async navigate(path, pushState = true) {
    if (!path) return;
    const targetPath = path.startsWith('/') ? path : '/' + path;

    try {
      let pageHtml = this.cache.get(targetPath);
      if (!pageHtml) {
        const response = await fetch(targetPath);
        if (!response.ok) {
          window.location.href = targetPath; // Fallback to normal navigation on error
          return;
        }
        pageHtml = await response.text();
        this.cache.set(targetPath, pageHtml);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(pageHtml, 'text/html');

      const newMain = doc.querySelector('main.page-container') || doc.querySelector('.main-content');
      const currentMain = document.querySelector('main.page-container');

      if (newMain && currentMain) {
        // Apply smooth transition animation
        currentMain.classList.remove('page-view-fade');
        void currentMain.offsetWidth; // Force reflow

        currentMain.innerHTML = newMain.innerHTML;
        currentMain.classList.add('page-view-fade');

        // Update Page Title
        if (doc.title) {
          document.title = doc.title;
        }

        // Update URL
        if (pushState) {
          history.pushState({ path: targetPath }, '', targetPath);
        }

        // Update Sidebar Active state
        if (typeof Sidebar !== 'undefined' && Sidebar.render) {
          Sidebar.render(targetPath);
        }

        // Execute Page Initializer
        this.reinitializePageScripts(targetPath);

        // Scroll inner view to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = targetPath;
      }
    } catch (err) {
      console.error('Router navigation error:', err);
      window.location.href = targetPath;
    }
  },

  reinitializePageScripts(path) {
    // Re-bind quick add button or mobile FAB if available
    if (typeof App !== 'undefined') {
      App.initQuickAddBtn();
    }

    if (path.includes('tasks')) {
      if (typeof window.initTasksPage === 'function') window.initTasksPage();
      else if (typeof window.loadCurrentPageData === 'function') window.loadCurrentPageData();
    } else if (path.includes('projects')) {
      if (typeof window.initProjectsPage === 'function') window.initProjectsPage();
      else if (typeof window.loadCurrentPageData === 'function') window.loadCurrentPageData();
    } else if (path.includes('calendar')) {
      if (typeof window.initCalendar === 'function') window.initCalendar();
      else if (typeof window.loadCurrentPageData === 'function') window.loadCurrentPageData();
    } else if (path.includes('timetables')) {
      if (typeof window.initTimetablesPage === 'function') window.initTimetablesPage();
      else if (typeof window.loadCurrentPageData === 'function') window.loadCurrentPageData();
    } else {
      if (typeof window.loadCurrentPageData === 'function') window.loadCurrentPageData();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Router.init());
