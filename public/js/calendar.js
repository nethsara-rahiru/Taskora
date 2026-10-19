let currentDate = new Date();

// Calendar cells and 'today' are local dates, not UTC instants.
function localCalendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
    emptyCell.style.cssText = 'background: transparent; border: none; min-height: 84px;';
    grid.appendChild(emptyCell);
  }

  const todayStr = localCalendarDateKey(new Date());

  for (let day = 1; day <= totalDays; day++) {
    const dayDate = new Date(year, month, day);
    const dayStr = localCalendarDateKey(dayDate);

    // Date inputs are stored as UTC midnight; preserve their selected date.

    const dayTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate).toISOString().split('T')[0] === dayStr);
    const count = dayTasks.length;

    // Busyness density classification
    let densityClass = 'day-free';
    let badgeHtml = '';

    if (count >= 5) {
      densityClass = 'day-packed';
      badgeHtml = `<span class="day-badge badge-packed">${count} Packed</span>`;
    } else if (count >= 3) {
      densityClass = 'day-busy';
      badgeHtml = `<span class="day-badge badge-busy">${count} Busy</span>`;
    } else if (count >= 1) {
      densityClass = 'day-normal';
      badgeHtml = `<span class="day-badge badge-normal">${count} ${count === 1 ? 'Item' : 'Items'}</span>`;
    }

    const cell = document.createElement('div');
    cell.className = `calendar-day ${densityClass} ${dayStr === todayStr ? 'today' : ''}`;
    cell.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <span style="font-size:0.95rem; font-weight:800; color: var(--text-main);">${day}</span>
        ${dayStr === todayStr ? '<span style="font-size:0.6rem; font-weight:800; background:var(--primary); color:white; padding:0.05rem 0.3rem; border-radius:3px;">TODAY</span>' : ''}
      </div>
      <div style="display:flex; align-items:center; justify-content:flex-end; margin-top: 0.5rem;">
        ${badgeHtml}
      </div>
    `;

    // Click listener to open popup (Desktop modal vs Mobile bottom sheet card)
    cell.addEventListener('click', () => {
      openDateDetailsPopup(monthNames[month], day, year, dayStr, dayTasks);
    });

    grid.appendChild(cell);
  }
}

function openDateDetailsPopup(monthName, day, year, dateStr, dayTasks) {
  const isMobile = window.innerWidth <= 768;

  let contentHtml = '';

  if (dayTasks.length === 0) {
    contentHtml = `
      <div style="text-align:center; padding: 2rem 1rem; color: var(--text-muted);">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.75rem;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
        </div>
        <p style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">Free Day! No items scheduled</p>
        <p style="font-size: 0.85rem; margin-top: 0.25rem;">Enjoy your open schedule or add a new task for this day.</p>
        <button class="btn btn-primary btn-sm" style="margin-top: 1.25rem;" onclick="Modal.close(); App.openTaskModal();">+ Add Task for ${monthName} ${day}</button>
      </div>
    `;
  } else {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-height: 60vh; overflow-y: auto; padding-right: 2px;">
        ${dayTasks.map(t => {
          const isEvent = t.itemType === 'event';
          return `
            <div style="padding:0.85rem; border:1px solid var(--border-color); border-left: 4px solid ${isEvent ? '#9333EA' : 'var(--primary)'}; border-radius:var(--radius-md); background:var(--bg-surface);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom: 0.3rem;">
                <span style="font-size:0.65rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; background:${isEvent ? 'rgba(147, 51, 234, 0.15)' : 'var(--primary-light)'}; color:${isEvent ? '#9333EA' : 'var(--primary)'};">
                  ${isEvent ? 'EVENT' : 'TASK'}
                </span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">
                  ${t.dueTime ? `⏰ ${t.dueTime}` : 'All Day'}
                </span>
              </div>
              <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); margin-bottom:0.2rem;">${TaskCard.escapeHtml(t.title)}</div>
              ${t.description ? `<div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.4rem;">${TaskCard.escapeHtml(t.description)}</div>` : ''}
              <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; justify-content:space-between; margin-top:0.4rem; border-top:1px stroke var(--border-color); pt:0.3rem;">
                <span>Priority: <b style="text-transform:capitalize;">${t.priority || 'medium'}</b></span>
                <span>Status: <b style="text-transform:capitalize;">${t.status || 'pending'}</b></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  Modal.open(`${monthName} ${day}, ${year} — ${dayTasks.length} ${dayTasks.length === 1 ? 'Item' : 'Items'}`, contentHtml);

  // If mobile, add bottom sheet class to modal content container
  if (isMobile) {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) modalContent.classList.add('mobile-bottom-sheet');
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
