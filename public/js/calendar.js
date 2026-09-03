let currentDate = new Date();

async function initCalendar() {
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadCurrentPageData();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadCurrentPageData();
  });

  loadCurrentPageData();
}

function renderCalendar(allTasks) {
  const monthTitle = document.getElementById('calendarMonthTitle');
  const grid = document.getElementById('calendarDaysGrid');
  if (!grid || !monthTitle) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  monthTitle.textContent = `${monthNames[month]} ${year}`;

  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Blank offset cells
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.style.cssText = 'background: transparent; border: none; min-height: 90px;';
    grid.appendChild(emptyCell);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let day = 1; day <= totalDays; day++) {
    const dayDate = new Date(year, month, day);
    const dayStr = dayDate.toISOString().split('T')[0];

    const dayTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate).toISOString().split('T')[0] === dayStr);

    const cell = document.createElement('div');
    cell.className = `calendar-day ${dayStr === todayStr ? 'today' : ''}`;
    cell.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.9rem; font-weight:700;">${day}</span>
        ${dayTasks.length > 0 ? `<span style="font-size:0.75rem; font-weight:700; background:var(--primary); color:white; border-radius:50%; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;">${dayTasks.length}</span>` : ''}
      </div>
      <div style="font-size:0.75rem; color:var(--text-muted); display:flex; flex-direction:column; gap:0.25rem; margin-top:0.35rem;">
        ${dayTasks.slice(0, 2).map(t => `
          <div style="background:var(--primary-light); color:var(--primary); padding:0.15rem 0.35rem; border-radius:4px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${TaskCard.escapeHtml(t.title)}
          </div>
        `).join('')}
        ${dayTasks.length > 2 ? `<div style="font-size:0.7rem; color:var(--text-light); font-weight:600;">+ ${dayTasks.length - 2} more</div>` : ''}
      </div>
    `;

    cell.addEventListener('click', () => {
      if (dayTasks.length > 0) {
        const listHtml = `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${dayTasks.map(t => `
              <div style="padding:1rem; border:1px solid var(--border-color); border-radius:var(--radius-md); background:var(--bg-surface);">
                <div style="font-weight:700; font-size:1rem; margin-bottom:0.25rem;">${TaskCard.escapeHtml(t.title)}</div>
                ${t.description ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">${TaskCard.escapeHtml(t.description)}</div>` : ''}
                <div style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:0.75rem;">
                  <span>Priority: <b>${t.priority}</b></span>
                  ${t.dueTime ? `<span>Time: <b>${t.dueTime}</b></span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
        Modal.open(`Tasks for ${monthNames[month]} ${day}, ${year}`, listHtml);
      }
    });

    grid.appendChild(cell);
  }
}

async function loadCurrentPageData() {
  // Load tasks from cache instantly, then revalidate in background
  SyncManager.load('tasks', '/tasks', (data) => {
    const allTasks = data?.tasks || [];
    renderCalendar(allTasks);
  });
}

document.addEventListener('DOMContentLoaded', initCalendar);
window.loadCurrentPageData = loadCurrentPageData;
