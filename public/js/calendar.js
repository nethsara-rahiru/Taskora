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

async function loadCurrentPageData() {
  const monthTitle = document.getElementById('calendarMonthTitle');
  const grid = document.getElementById('calendarDaysGrid');
  if (!grid || !monthTitle) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  monthTitle.textContent = `${monthNames[month]} ${year}`;

  try {
    const data = await API.get('/tasks');
    const allTasks = data.tasks || [];

    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Blank offset cells
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.cssText = 'background: transparent; border: none;';
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
        <div style="display:flex; justify-content:space-between;">
          <span>${day}</span>
          ${dayTasks.length > 0 ? `<span style="font-size:0.75rem; background:var(--primary); color:white; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center;">${dayTasks.length}</span>` : ''}
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${dayTasks.slice(0, 2).map(t => `• ${TaskCard.escapeHtml(t.title)}`).join('<br>')}
        </div>
      `;

      cell.addEventListener('click', () => {
        if (dayTasks.length > 0) {
          const listHtml = `
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${dayTasks.map(t => `
                <div style="padding:0.75rem; border:1px solid var(--border-color); border-radius:var(--radius-md); background:var(--bg-surface);">
                  <div style="font-weight:600;">${TaskCard.escapeHtml(t.title)}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">Priority: ${t.priority} ${t.dueTime ? '| Time: ' + t.dueTime : ''}</div>
                </div>
              `).join('')}
            </div>
          `;
          Modal.open(`Tasks for ${monthNames[month]} ${day}, ${year}`, listHtml);
        }
      });

      grid.appendChild(cell);
    }
  } catch (err) {
    Notifications.show(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initCalendar);
window.loadCurrentPageData = loadCurrentPageData;
