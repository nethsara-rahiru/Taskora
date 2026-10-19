let activeTimetableId = null;
let cachedTimetables = [];
let currentDayFilter = 'all';

function weekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return start;
}
let displayedWeek = weekStart(new Date());

function dateForDay(dayOfWeek) {
  const date = new Date(displayedWeek);
  date.setDate(date.getDate() + (dayOfWeek + 6) % 7);
  return date;
}


const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 0, name: 'Sunday', short: 'Sun' }
];

async function initTimetablesPage() {
  for (const [id, offset] of [['prevWeekBtn', -7], ['nextWeekBtn', 7], ['thisWeekBtn', 0]]) {
    document.getElementById(id)?.addEventListener('click', () => {
      if (offset) displayedWeek.setDate(displayedWeek.getDate() + offset);
      else displayedWeek = weekStart(new Date());
      renderWeeklyGrid(cachedTimetables);
    });
  }
  document.getElementById('createTimetableBtn')?.addEventListener('click', () => openTimetableModal());
  document.getElementById('addSlotBtn')?.addEventListener('click', () => openSlotModal());
  document.getElementById('editTimetableMetaBtn')?.addEventListener('click', () => {
    const active = cachedTimetables.find(t => t._id === activeTimetableId);
    if (active) openTimetableModal(active);
  });
  document.getElementById('deleteTimetableBtn')?.addEventListener('click', async () => {
    const active = cachedTimetables.find(t => t._id === activeTimetableId);
    if (active && confirm(`Are you sure you want to delete timetable "${active.title}"?`)) {
      await SyncManager.mutate('DELETE', `/timetables/${active._id}`, null, {
        invalidates: [{ cacheKey: 'timetables', endpoint: '/timetables' }]
      });
      Notifications.show('Timetable deleted', 'info');
      activeTimetableId = null;
      loadCurrentPageData();
    }
  });

  // Day filter tab listeners
  document.querySelectorAll('#dayFilterTabsContainer .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#dayFilterTabsContainer .tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDayFilter = e.target.dataset.day;
      renderWeeklyGrid(cachedTimetables);
    });
  });

  loadCurrentPageData();
}

const VIRTUAL_EVENTS_ID = '__virtual_events__';

function loadCurrentPageData() {
  SyncManager.load('timetables', '/timetables', (data) => {
    cachedTimetables = [...(data?.timetables || [])].sort(ScheduleRules.comparePriority);
    // Load events from tasks API and inject virtual Events schedule
    loadEventsVirtualSchedule(cachedTimetables, (merged) => {
      cachedTimetables = merged;
      renderTimetablesUI(cachedTimetables);
    });
  });
}

function loadEventsVirtualSchedule(baseTimetables, callback) {
  SyncManager.load('tasks-events', '/tasks?itemType=event', (data) => {
    const events = data?.tasks || [];

    // Convert events with startTime/endTime and dueDate to slot objects
    const virtualSlots = [];
    events.forEach(ev => {
      if (!ev.startTime || !ev.endTime || !ev.dueDate) return;
      const dow = new Date(ev.dueDate).getUTCDay(); // 0=Sun
      virtualSlots.push({
        _id: ev._id,
        subject: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        dayOfWeek: dow,
        color: '#9333EA',
        room: '',
        teacher: '',
        isVirtual: true,
        occurrenceDate: new Date(ev.dueDate).toISOString().slice(0, 10)
      });
    });

    // Build virtual timetable object
    const virtualTimetable = {
      _id: VIRTUAL_EVENTS_ID,
      title: '📅 Events',
      color: '#9333EA',
      description: 'Your events, automatically synced to the timeline.',
      slots: virtualSlots,
      isVirtual: true
    };

    // Filter out any previous virtual schedule, then add fresh one
    const cleaned = baseTimetables.filter(t => t._id !== VIRTUAL_EVENTS_ID);
    callback([...cleaned, virtualTimetable]);
  });
}

function renderTimetablesUI(timetables) {
  const pillsContainer = document.getElementById('timetablePillsContainer');
  const gridContainer = document.getElementById('weeklyGridContainer');
  const addSlotBtn = document.getElementById('addSlotBtn');
  const editBtn = document.getElementById('editTimetableMetaBtn');
  const deleteBtn = document.getElementById('deleteTimetableBtn');

  if (!pillsContainer || !gridContainer) return;

  if (timetables.length === 0) {
    pillsContainer.innerHTML = `<span style="color: var(--text-muted); font-size: 0.875rem;">No timetables created yet</span>`;
    gridContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-xl); border: 1px solid var(--border-color);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <p style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">No Timetables Available</p>
        <p style="font-size: 0.875rem; margin-top: 0.25rem;">Create a schedule for work, study, gym, or any weekly routine to organize your time.</p>
        <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="openTimetableModal()">+ Create First Schedule</button>
      </div>
    `;
    if (addSlotBtn) addSlotBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    return;
  }

  // Ensure an active timetable is selected (defaults to 'all')
  if (!activeTimetableId) {
    activeTimetableId = 'all';
  }

  // Render Schedule Switcher Tabs (All View + Individual Schedules)
  const allTabHtml = `
    <button
      class="schedule-tab ${activeTimetableId === 'all' ? 'active' : ''}"
      data-id="all"
      aria-pressed="${activeTimetableId === 'all'}"
      title="Show All Schedules"
    >
      <span class="tab-dot" style="background: var(--primary);"></span>
      All Schedules (${timetables.length})
    </button>
  `;

  pillsContainer.innerHTML = allTabHtml + timetables.map(t => `
    <button
      class="schedule-tab ${t._id === activeTimetableId ? 'active' : ''}"
      data-id="${t._id}"
      aria-pressed="${t._id === activeTimetableId}"
      title="Focus on ${TaskCard.escapeHtml(t.title)}"
    >
      <span class="tab-dot" style="background: ${t.color || 'var(--primary)'};"></span>
      ${TaskCard.escapeHtml(t.title)}
      ${t.isVirtual ? '' : `<span class="schedule-state">${t.isPaused ? 'Paused' : (t.priority || 'medium')}</span>`}
    </button>
  `).join('');

  pillsContainer.querySelectorAll('.schedule-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeTimetableId = e.currentTarget.dataset.id;
      renderTimetablesUI(cachedTimetables);
      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Scroll active tab into view on load
  const activeTab = pillsContainer.querySelector('.schedule-tab.active');
  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });

  const isAllView = activeTimetableId === 'all';
  const isVirtualView = activeTimetableId === VIRTUAL_EVENTS_ID;

  if (addSlotBtn) addSlotBtn.style.display = (isAllView || isVirtualView) ? 'none' : 'inline-flex';
  if (editBtn) editBtn.style.display = (isAllView || isVirtualView) ? 'none' : 'inline-flex';
  if (deleteBtn) deleteBtn.style.display = (isAllView || isVirtualView) ? 'none' : 'inline-flex';

  renderWeeklyGrid(cachedTimetables);
}

function renderWeeklyGrid(timetablesInput) {
  const gridContainer = document.getElementById('weeklyGridContainer');
  if (!gridContainer || !timetablesInput) return;

  const timetablesList = (Array.isArray(timetablesInput) ? timetablesInput : [timetablesInput])
    .filter(tt => activeTimetableId === 'all' || tt._id === activeTimetableId)
    .sort(ScheduleRules.comparePriority);
  const weekEnd = dateForDay(0);
  document.getElementById('scheduleWeekLabel').textContent =
    `${displayedWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const selected = timetablesList[0];
  const summary = document.getElementById('scheduleSummary');
  summary.textContent = activeTimetableId === 'all'
    ? 'Schedules are ordered by priority. Select a schedule to change its settings.'
    : selected?.isVirtual ? 'Events appear only in the week of their date.'
    : selected ? [
      `${selected.priority || 'medium'} priority`,
      selected.isPaused ? 'Paused — resume in Settings'
        : selected.endsOn && selected.endsOn < ScheduleRules.dateKey(displayedWeek) ? 'Ended'
        : selected.startsOn && selected.startsOn > ScheduleRules.dateKey(weekEnd) ? 'Not started yet' : 'Enabled',
      selected.startsOn ? `From ${selected.startsOn}` : '',
      selected.endsOn ? `Through ${selected.endsOn}` : 'No end date',
      selected.skipRanges?.length ? `${selected.skipRanges.length} skip range(s)` : ''
    ].filter(Boolean).join(' · ') : '';


  // Trigger smooth transition animation
  gridContainer.classList.remove('tab-fade-in');
  void gridContainer.offsetWidth; // Force DOM reflow
  gridContainer.classList.add('tab-fade-in');

  const todayKey = ScheduleRules.dateKey(new Date());

  // Flatten all slots across timetables
  const allSlots = [];
  timetablesList.forEach(tt => {
    (tt.slots || []).forEach(s => {
      const occurrenceDate = ScheduleRules.dateKey(dateForDay(s.dayOfWeek));
      if (tt.isVirtual ? s.occurrenceDate !== occurrenceDate : !ScheduleRules.isActiveOn(tt, occurrenceDate)) return;
      allSlots.push({
        ...s,
        parentTimetableId: tt._id,
        parentTimetableTitle: tt.title,
        priority: tt.priority || 'medium',
        parentColor: tt.color || '#6366F1'
      });
    });
  });

  gridContainer.innerHTML = '';

  const daysToRender = currentDayFilter === 'all'
    ? DAYS_OF_WEEK
    : DAYS_OF_WEEK.filter(d => d.id === parseInt(currentDayFilter, 10));

  // Toggle single-day CSS class for clean full-width layout
  if (currentDayFilter !== 'all') {
    gridContainer.classList.add('single-day');
  } else {
    gridContainer.classList.remove('single-day');
  }

  // 1. Render Header Row (Top Left Corner + Day Column Headers)
  const cornerHeader = document.createElement('div');
  cornerHeader.className = 'matrix-header-cell time-header-corner';
  cornerHeader.textContent = 'TIME';
  gridContainer.appendChild(cornerHeader);

  daysToRender.forEach(day => {
    const isToday = ScheduleRules.dateKey(dateForDay(day.id)) === todayKey;
    const daySlotsCount = allSlots.filter(s => s.dayOfWeek === day.id).length;

    const dayHeader = document.createElement('div');
    dayHeader.className = `matrix-header-cell${isToday ? ' is-today' : ''}`;
    dayHeader.innerHTML = `
      <span>${currentDayFilter === 'all' ? day.short : day.name} ${dateForDay(day.id).getDate()}</span>
      <span style="font-size: 0.65rem; opacity: 0.75; font-weight: 600;">${daySlotsCount} ${daySlotsCount === 1 ? 'slot' : 'slots'}</span>
    `;
    gridContainer.appendChild(dayHeader);
  });

  // 2. Render Timeline Column (06:00 to 22:00 = 17 hours, 54px each)
  const START_HOUR = 6;
  const END_HOUR = 22; // 22:00
  const HOUR_HEIGHT = 54; // px per hour

  const timeCol = document.createElement('div');
  timeCol.className = 'time-axis-col';

  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const hourLabel = document.createElement('div');
    hourLabel.className = 'time-slot-label';
    const formatted = `${h.toString().padStart(2, '0')}:00`;
    hourLabel.textContent = formatted;
    timeCol.appendChild(hourLabel);
  }
  gridContainer.appendChild(timeCol);

  // 3. Render Day Grid Columns
  daysToRender.forEach(day => {
    const isToday = ScheduleRules.dateKey(dateForDay(day.id)) === todayKey;
    const daySlots = allSlots.filter(s => s.dayOfWeek === day.id);

    const dayCol = document.createElement('div');
    dayCol.className = `matrix-day-col${isToday ? ' is-today' : ''}`;
    dayCol.dataset.dayId = day.id;

    // Drag & Drop handlers on target day column
    dayCol.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dayCol.classList.add('drag-over');
    });

    dayCol.addEventListener('dragleave', () => {
      dayCol.classList.remove('drag-over');
    });

    dayCol.addEventListener('drop', (e) => {
      e.preventDefault();
      dayCol.classList.remove('drag-over');

      const slotId = e.dataTransfer.getData('text/plain');
      const parentTtId = e.dataTransfer.getData('parentTimetableId');
      const durationMins = parseInt(e.dataTransfer.getData('durationMins'), 10) || 60;
      if (!slotId || !parentTtId) return;

      const rect = dayCol.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;

      // Calculate dropped start minute based on 54px per hour timeline starting at 06:00
      const minsFromBase = (offsetY / HOUR_HEIGHT) * 60;
      let startMins = Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, minsFromBase));
      startMins = Math.round(startMins / 15) * 15; // Snap to 15-minute intervals

      const absoluteStartMins = START_HOUR * 60 + startMins;
      const absoluteEndMins = Math.min(23 * 60 + 59, absoluteStartMins + durationMins);

      const formatTime = (totalMins) => {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      const newStartTime = formatTime(absoluteStartMins);
      const newEndTime = formatTime(absoluteEndMins);

      // Optimistically update local state & trigger debounced save
      updateSlotOptimistically(parentTtId, slotId, day.id, newStartTime, newEndTime);
    });

    // Render background hour grid lines
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const line = document.createElement('div');
      line.className = 'hour-grid-line';
      dayCol.appendChild(line);
    }

    // Render solid color slot blocks inside day column
    daySlots.forEach(slot => {
      if (!slot.startTime || !slot.endTime) return;

      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);

      const startTotalMins = startH * 60 + (startM || 0);
      const endTotalMins = endH * 60 + (endM || 0);
      const baseMins = START_HOUR * 60;

      const topPx = Math.max(0, ((startTotalMins - baseMins) / 60) * HOUR_HEIGHT);
      const durationMins = Math.max(15, endTotalMins - startTotalMins);
      const heightPx = Math.max(34, (durationMins / 60) * HOUR_HEIGHT);

      const slotBg = slot.color || slot.parentColor || '#6366F1';
      const isFaded = activeTimetableId !== 'all' && activeTimetableId !== slot.parentTimetableId;

      const block = document.createElement('div');
      block.className = `matrix-slot-block${isFaded ? ' faded' : ''}`;
      block.setAttribute('draggable', slot.isVirtual ? 'false' : 'true');
      block.style.top = `${topPx + 2}px`;
      block.style.height = `${heightPx - 4}px`;
      block.style.backgroundColor = slotBg;

      block.innerHTML = `
        ${!slot.isVirtual ? `
          <div class="slot-block-actions">
            <button class="slot-block-btn duplicate-slot-btn" title="Duplicate Slot">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="slot-block-btn edit-slot-btn" title="Edit Slot">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="slot-block-btn delete-slot-btn" title="Delete Slot">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        ` : ''}

        <div>
          <div class="slot-block-title" title="${TaskCard.escapeHtml(slot.subject)}">${TaskCard.escapeHtml(slot.subject)}</div>
          <div class="slot-block-time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${slot.startTime}–${slot.endTime}
          </div>
        </div>

        ${(slot.room || slot.teacher) ? `
          <div class="slot-block-meta">
            ${slot.room ? `📍 ${TaskCard.escapeHtml(slot.room)}` : ''} ${slot.teacher ? `👤 ${TaskCard.escapeHtml(slot.teacher)}` : ''}
          </div>
        ` : ''}
      `;

      if (!slot.isVirtual) {
        // Drag start & end events
        block.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', slot._id);
          e.dataTransfer.setData('parentTimetableId', slot.parentTimetableId);
          e.dataTransfer.setData('durationMins', durationMins);
          e.dataTransfer.effectAllowed = 'move';
          block.classList.add('dragging');
        });

        block.addEventListener('dragend', () => {
          block.classList.remove('dragging');
          document.querySelectorAll('.matrix-day-col').forEach(c => c.classList.remove('drag-over'));
        });
      }

      // Hover Tooltip events
      const tooltip = document.getElementById('slotHoverTooltip');

      block.addEventListener('mouseenter', () => {
        if (!tooltip) return;
        tooltip.style.borderLeftColor = slotBg;
        tooltip.innerHTML = `
          <div style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">
            ${day.name} • ${TaskCard.escapeHtml(slot.parentTimetableTitle)}
          </div>
          <div style="font-size:0.95rem; font-weight:800; color:var(--text-main); margin-bottom:0.35rem; line-height:1.2;">
            ${TaskCard.escapeHtml(slot.subject)}
          </div>
          <div style="font-size:0.78rem; font-weight:700; color:var(--primary); margin-bottom:0.4rem; display:flex; align-items:center; gap:0.3rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${slot.startTime} – ${slot.endTime} (${durationMins} mins)
          </div>
          ${slot.room ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.15rem;">📍 Location: <b>${TaskCard.escapeHtml(slot.room)}</b></div>` : ''}
          ${slot.teacher ? `<div style="font-size:0.78rem; color:var(--text-muted);">👤 With/Organizer: <b>${TaskCard.escapeHtml(slot.teacher)}</b></div>` : ''}
        `;
        tooltip.classList.add('visible');
      });

      block.addEventListener('mousemove', (e) => {
        if (!tooltip) return;
        const x = Math.min(window.innerWidth - 260, e.clientX + 16);
        const y = Math.min(window.innerHeight - 180, e.clientY + 16);
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
      });

      block.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.classList.remove('visible');
      });

      if (!slot.isVirtual) {
        // Duplicate button listener
        block.querySelector('.duplicate-slot-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const duplicatePayload = {
              subject: `${slot.subject} (Copy)`,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.room,
              teacher: slot.teacher,
              color: slot.color
            };
            await SyncManager.mutate('POST', `/timetables/${slot.parentTimetableId}/slots`, duplicatePayload, {
              invalidates: [{ cacheKey: 'timetables', endpoint: '/timetables' }]
            });
            Notifications.show('Slot duplicated!', 'success');
            loadCurrentPageData();
          } catch (err) {
            Notifications.show(err.message || 'Failed to duplicate slot', 'error');
          }
        });

        block.querySelector('.edit-slot-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openSlotModal(slot);
        });

        block.querySelector('.delete-slot-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${slot.subject}"?`)) {
            await SyncManager.mutate('DELETE', `/timetables/${slot.parentTimetableId}/slots/${slot._id}`, null, {
              invalidates: [{ cacheKey: 'timetables', endpoint: '/timetables' }]
            });
            Notifications.show('Slot removed', 'info');
            loadCurrentPageData();
          }
        });
      }

      dayCol.appendChild(block);
    });

    gridContainer.appendChild(dayCol);
  });
}

// ── Debounced Auto-Save Engine ──
const pendingChangesMap = new Map(); // key: slotId -> { parentTtId, slotId, dayOfWeek, startTime, endTime }
let saveDebounceTimer = null;

function updateSlotOptimistically(parentTtId, slotId, dayOfWeek, startTime, endTime) {
  if (parentTtId === VIRTUAL_EVENTS_ID) return;

  // 1. Update in-memory cache optimistically
  const tt = cachedTimetables.find(t => t._id === parentTtId);
  if (tt && tt.slots) {
    const slot = tt.slots.find(s => s._id === slotId);
    if (slot) {
      slot.dayOfWeek = dayOfWeek;
      slot.startTime = startTime;
      slot.endTime = endTime;
    }
  }

  // 2. Queue payload for pending save
  pendingChangesMap.set(slotId, { parentTtId, slotId, dayOfWeek, startTime, endTime });

  // 3. Update header status badge
  updateSaveStatusBadge('unsaved');

  // 4. Re-render UI immediately (zero lag)
  renderWeeklyGrid(cachedTimetables);

  // 5. Start 3-second debounce timer
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(flushPendingSaves, 3000);
}

async function flushPendingSaves() {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }

  if (pendingChangesMap.size === 0) return;

  const itemsToSave = Array.from(pendingChangesMap.values());
  pendingChangesMap.clear();

  updateSaveStatusBadge('saving');

  try {
    for (const item of itemsToSave) {
      await API.put(`/timetables/${item.parentTtId}/slots/${item.slotId}`, {
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime
      });
    }

    // Invalidate local SWR cache
    SyncManager.invalidate('timetables', '/timetables');
    updateSaveStatusBadge('saved');
  } catch (err) {
    Notifications.show(err.message || 'Failed to auto-save changes', 'error');
    updateSaveStatusBadge('error');
  }
}

function updateSaveStatusBadge(status) {
  const badge = document.getElementById('saveStatusBadge');
  if (!badge) return;

  if (status === 'unsaved') {
    badge.style.display = 'inline-flex';
    badge.style.background = 'var(--color-warning-bg)';
    badge.style.color = 'var(--color-warning)';
    badge.textContent = 'Unsaved changes...';
  } else if (status === 'saving') {
    badge.style.display = 'inline-flex';
    badge.style.background = 'var(--primary-light)';
    badge.style.color = 'var(--primary)';
    badge.textContent = 'Saving changes...';
  } else if (status === 'saved') {
    badge.style.display = 'inline-flex';
    badge.style.background = 'var(--color-success-bg)';
    badge.style.color = 'var(--color-success)';
    badge.textContent = 'All changes saved ✓';
    setTimeout(() => {
      if (pendingChangesMap.size === 0) {
        badge.style.display = 'none';
      }
    }, 2500);
  } else if (status === 'error') {
    badge.style.display = 'inline-flex';
    badge.style.background = 'var(--color-danger-bg)';
    badge.style.color = 'var(--color-danger)';
    badge.textContent = 'Save failed!';
  }
}

// Flush pending saves on page leave / tab unload
window.addEventListener('beforeunload', () => { flushPendingSaves(); });
window.addEventListener('visibilitychange', () => { if (document.hidden) flushPendingSaves(); });

function openTimetableModal(timetableToEdit = null) {
  let skipRanges = (timetableToEdit?.skipRanges || []).map(range => ({ start: range.start, end: range.end }));
  const formHtml = `
    <form id="timetableForm">
      <div class="form-group">
        <label class="form-label">Schedule Title *</label>
        <input type="text" id="ttTitleInput" class="form-control" placeholder="e.g. Work Schedule / Weekly Routine / Gym Plan" required value="${timetableToEdit ? TaskCard.escapeHtml(timetableToEdit.title) : ''}">
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="ttDescInput" class="form-control" rows="2" placeholder="Brief details about this schedule...">${timetableToEdit ? TaskCard.escapeHtml(timetableToEdit.description || '') : ''}</textarea>
      </div>

      <div class="form-group" style="max-width:200px;">
        <label class="form-label">Color Accent</label>
        <input type="color" id="ttColorInput" class="form-control" value="${timetableToEdit ? timetableToEdit.color : '#6366F1'}" style="height:44px; padding:3px; cursor:pointer;">
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label for="ttPriorityInput" class="form-label">Priority</label>
          <select id="ttPriorityInput" class="form-control">
            ${ScheduleRules.priorities.map(priority => `<option value="${priority}" ${(timetableToEdit?.priority || 'medium') === priority ? 'selected' : ''}>${priority[0].toUpperCase() + priority.slice(1)}</option>`).join('')}
          </select>
          <p class="schedule-help">Higher priorities appear first. Overlapping slots remain visible.</p>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label for="ttStartsOnInput" class="form-label">Start date (optional)</label>
          <input type="date" id="ttStartsOnInput" class="form-control" value="${timetableToEdit?.startsOn || ''}">
        </div>
        <div class="form-group" style="flex:1;">
          <label for="ttEndsOnInput" class="form-label">Follow through (optional)</label>
          <input type="date" id="ttEndsOnInput" class="form-control" value="${timetableToEdit?.endsOn || ''}">
        </div>
      </div>
      <p class="schedule-help">Includes the end date. Leave blank to keep repeating.</p>
      <div class="form-group">
        <label class="form-label"><input type="checkbox" id="ttPausedInput" ${timetableToEdit?.isPaused ? 'checked' : ''}> Pause this schedule</label>
        <p class="schedule-help">Hide all occurrences until you turn this off. Your slots stay saved.</p>
      </div>
      <fieldset class="schedule-skips">
        <legend class="form-label">Skip dates or weeks</legend>
        <p class="schedule-help">Skip a single date or an inclusive date range. Remove a range to restore those occurrences.</p>
        <div id="ttSkipRanges"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="ttAddSkipRange">Add date / range</button>
        <div class="schedule-week-picker">
          <label for="ttSkipWeekInput" class="form-label">Skip a week containing</label>
          <input type="date" id="ttSkipWeekInput" class="form-control">
          <button type="button" class="btn btn-secondary btn-sm" id="ttAddSkipWeek">Skip whole week</button>
        </div>
        <p class="schedule-help">Whole weeks run Monday through Sunday.</p>
      </fieldset>
      <p id="ttSettingsError" class="schedule-error" role="alert"></p>
      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button type="submit" class="btn btn-primary">${timetableToEdit ? 'Save Changes' : 'Create Timetable'}</button>
      </div>
    </form>
  `;

  Modal.open(timetableToEdit ? 'Schedule Settings' : 'Create New Timetable', formHtml);

  const renderRanges = () => {
    const container = document.getElementById('ttSkipRanges');
    container.innerHTML = '';
    skipRanges.forEach((range, index) => {
      const row = document.createElement('div');
      row.className = 'schedule-skip-row';
      row.innerHTML = `<label class="form-label">From<input type="date" class="form-control skip-start" required value="${range.start}"></label>
        <label class="form-label">Through<input type="date" class="form-control skip-end" required value="${range.end}"></label>
        <button type="button" class="btn-icon" aria-label="Remove skip range ${index + 1}">×</button>`;
      row.querySelector('.skip-start').addEventListener('change', e => {
        range.start = e.target.value;
        if (!range.end) { range.end = range.start; row.querySelector('.skip-end').value = range.end; }
      });
      row.querySelector('.skip-end').addEventListener('change', e => { range.end = e.target.value; });
      row.querySelector('button').addEventListener('click', () => { skipRanges.splice(index, 1); renderRanges(); });
      container.appendChild(row);
    });
  };
  renderRanges();
  document.getElementById('ttAddSkipRange').addEventListener('click', () => {
    skipRanges.push({ start: '', end: '' }); renderRanges();
  });
  document.getElementById('ttAddSkipWeek').addEventListener('click', () => {
    const input = document.getElementById('ttSkipWeekInput');
    if (!input.value) { input.focus(); return; }
    const start = weekStart(new Date(`${input.value}T12:00:00`));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    skipRanges.push({ start: ScheduleRules.dateKey(start), end: ScheduleRules.dateKey(end) });
    renderRanges(); input.value = '';
  });

  document.getElementById('timetableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('ttTitleInput').value.trim(),
      description: document.getElementById('ttDescInput').value.trim(),
      color: document.getElementById('ttColorInput').value,
      priority: document.getElementById('ttPriorityInput').value,
      startsOn: document.getElementById('ttStartsOnInput').value || null,
      endsOn: document.getElementById('ttEndsOnInput').value || null,
      isPaused: document.getElementById('ttPausedInput').checked,
      skipRanges
    };

    try {
      ScheduleRules.normalizeSettings(payload);
      const invalidates = [
        { cacheKey: 'timetables', endpoint: '/timetables' },
        { cacheKey: 'dashboard', endpoint: '/dashboard' }
      ];
      if (timetableToEdit) {
        await SyncManager.mutate('PUT', `/timetables/${timetableToEdit._id}`, payload, { invalidates });
        Notifications.show('Schedule updated!', 'success');
      } else {
        const created = await SyncManager.mutate('POST', '/timetables', payload, { invalidates });
        if (created?.timetable) activeTimetableId = created.timetable._id;
        Notifications.show('Schedule created!', 'success');
      }
      Modal.close();
      loadCurrentPageData();
    } catch (err) {
      document.getElementById('ttSettingsError').textContent = err.message;
    }
  });
}

function openSlotModal(slotToEdit = null) {
  if (cachedTimetables.length === 0) {
    Notifications.show('Please create a timetable first.', 'info');
    return;
  }

  const targetTtId = slotToEdit
    ? slotToEdit.parentTimetableId
    : (activeTimetableId !== 'all' ? activeTimetableId : cachedTimetables[0]._id);

  const ttSelectorHtml = (activeTimetableId === 'all' && !slotToEdit) ? `
    <div class="form-group">
      <label class="form-label">Target Schedule *</label>
      <select id="slotTimetableSelect" class="form-control">
        ${cachedTimetables.map(t => `<option value="${t._id}">${TaskCard.escapeHtml(t.title)}</option>`).join('')}
      </select>
    </div>
  ` : '';

  const formHtml = `
    <form id="slotForm">
      ${ttSelectorHtml}

      <div class="form-group">
        <label class="form-label">Title *</label>
        <input type="text" id="slotSubjectInput" class="form-control" placeholder="e.g. Team Standup / Gym / Deep Work" required value="${slotToEdit ? TaskCard.escapeHtml(slotToEdit.subject) : ''}">
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Day of Week *</label>
          <select id="slotDaySelect" class="form-control">
            ${DAYS_OF_WEEK.map(d => `<option value="${d.id}" ${slotToEdit && slotToEdit.dayOfWeek === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="flex:1;">
          <label class="form-label">Accent Color</label>
          <input type="color" id="slotColorInput" class="form-control" value="${slotToEdit ? slotToEdit.color : '#6366F1'}" style="height:44px; padding:3px; cursor:pointer;">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Start Time *</label>
          <input type="time" id="slotStartTimeInput" class="form-control" required value="${slotToEdit ? slotToEdit.startTime : '09:00'}">
        </div>

        <div class="form-group" style="flex:1;">
          <label class="form-label">End Time *</label>
          <input type="time" id="slotEndTimeInput" class="form-control" required value="${slotToEdit ? slotToEdit.endTime : '10:30'}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Location</label>
          <input type="text" id="slotRoomInput" class="form-control" placeholder="e.g. Office, Home, Gym, Online" value="${slotToEdit ? TaskCard.escapeHtml(slotToEdit.room || '') : ''}">
        </div>

        <div class="form-group" style="flex:1;">
          <label class="form-label">Organizer / With</label>
          <input type="text" id="slotTeacherInput" class="form-control" placeholder="e.g. Alex, Team, Solo" value="${slotToEdit ? TaskCard.escapeHtml(slotToEdit.teacher || '') : ''}">
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button type="submit" class="btn btn-primary">${slotToEdit ? 'Save Changes' : 'Add Slot'}</button>
      </div>
    </form>
  `;

  Modal.open(slotToEdit ? 'Edit Slot' : 'Add Slot', formHtml);

  document.getElementById('slotForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedTtId = document.getElementById('slotTimetableSelect')
      ? document.getElementById('slotTimetableSelect').value
      : targetTtId;

    const payload = {
      subject: document.getElementById('slotSubjectInput').value.trim(),
      dayOfWeek: parseInt(document.getElementById('slotDaySelect').value, 10),
      startTime: document.getElementById('slotStartTimeInput').value,
      endTime: document.getElementById('slotEndTimeInput').value,
      room: document.getElementById('slotRoomInput').value.trim(),
      teacher: document.getElementById('slotTeacherInput').value.trim(),
      color: document.getElementById('slotColorInput').value
    };

    try {
      const invalidates = [{ cacheKey: 'timetables', endpoint: '/timetables' }];
      if (slotToEdit) {
        await SyncManager.mutate('PUT', `/timetables/${selectedTtId}/slots/${slotToEdit._id}`, payload, { invalidates });
        Notifications.show('Slot updated!', 'success');
      } else {
        await SyncManager.mutate('POST', `/timetables/${selectedTtId}/slots`, payload, { invalidates });
        Notifications.show('Slot added!', 'success');
      }
      Modal.close();
      loadCurrentPageData();
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', initTimetablesPage);
window.loadCurrentPageData = loadCurrentPageData;
