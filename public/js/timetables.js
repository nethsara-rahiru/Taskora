let activeTimetableId = null;
let cachedTimetables = [];
let currentDayFilter = 'all';

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
      const activeTimetable = cachedTimetables.find(t => t._id === activeTimetableId);
      if (activeTimetable) renderWeeklyGrid(activeTimetable);
    });
  });

  loadCurrentPageData();
}

function loadCurrentPageData() {
  SyncManager.load('timetables', '/timetables', (data) => {
    cachedTimetables = data?.timetables || [];
    renderTimetablesUI(cachedTimetables);
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

  // Ensure an active timetable is selected
  if (!activeTimetableId || !timetables.some(t => t._id === activeTimetableId)) {
    const primary = timetables.find(t => t.isPrimary) || timetables[0];
    activeTimetableId = primary._id;
  }

  const activeTimetable = timetables.find(t => t._id === activeTimetableId);

  // Render Schedule Switcher Tabs
  pillsContainer.innerHTML = timetables.map(t => `
    <button
      class="schedule-tab ${t._id === activeTimetableId ? 'active' : ''}"
      data-id="${t._id}"
      aria-pressed="${t._id === activeTimetableId}"
      title="Switch to ${TaskCard.escapeHtml(t.title)}"
    >
      <span class="tab-dot" style="background: ${t.color || 'var(--primary)'};"></span>
      ${TaskCard.escapeHtml(t.title)}
      ${t.isPrimary ? '<span class="tab-primary-badge">DEFAULT</span>' : ''}
    </button>
  `).join('');

  pillsContainer.querySelectorAll('.schedule-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeTimetableId = e.currentTarget.dataset.id;
      renderTimetablesUI(cachedTimetables);
      // Scroll active tab into view smoothly
      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Scroll active tab into view on load
  const activeTab = pillsContainer.querySelector('.schedule-tab.active');
  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });

  if (addSlotBtn) addSlotBtn.style.display = 'inline-flex';
  if (editBtn) editBtn.style.display = 'inline-flex';
  if (deleteBtn) deleteBtn.style.display = 'inline-flex';

  renderWeeklyGrid(activeTimetable);
}

function renderWeeklyGrid(timetable) {
  const gridContainer = document.getElementById('weeklyGridContainer');
  if (!gridContainer || !timetable) return;

  // Trigger smooth transition animation
  gridContainer.classList.remove('tab-fade-in');
  void gridContainer.offsetWidth; // Force DOM reflow
  gridContainer.classList.add('tab-fade-in');

  const todayDayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...
  const slots = timetable.slots || [];

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
    const isToday = day.id === todayDayOfWeek;
    const daySlotsCount = slots.filter(s => s.dayOfWeek === day.id).length;

    const dayHeader = document.createElement('div');
    dayHeader.className = `matrix-header-cell${isToday ? ' is-today' : ''}`;
    dayHeader.innerHTML = `
      <span>${currentDayFilter === 'all' ? day.short : day.name}</span>
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
    const isToday = day.id === todayDayOfWeek;
    const daySlots = slots.filter(s => s.dayOfWeek === day.id);

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

    dayCol.addEventListener('drop', async (e) => {
      e.preventDefault();
      dayCol.classList.remove('drag-over');

      const slotId = e.dataTransfer.getData('text/plain');
      const durationMins = parseInt(e.dataTransfer.getData('durationMins'), 10) || 60;
      if (!slotId) return;

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

      try {
        await SyncManager.mutate('PUT', `/timetables/${timetable._id}/slots/${slotId}`, {
          dayOfWeek: day.id,
          startTime: newStartTime,
          endTime: newEndTime
        }, {
          invalidates: [{ cacheKey: 'timetables', endpoint: '/timetables' }]
        });
        Notifications.show(`Moved to ${day.name} (${newStartTime}–${newEndTime})`, 'success');
        loadCurrentPageData();
      } catch (err) {
        Notifications.show(err.message || 'Failed to move slot', 'error');
      }
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

      const slotBg = slot.color || timetable.color || '#6366F1';

      const block = document.createElement('div');
      block.className = 'matrix-slot-block';
      block.setAttribute('draggable', 'true');
      block.style.top = `${topPx + 2}px`;
      block.style.height = `${heightPx - 4}px`;
      block.style.backgroundColor = slotBg;

      block.innerHTML = `
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

      // Drag start & end events
      block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', slot._id);
        e.dataTransfer.setData('durationMins', durationMins);
        e.dataTransfer.effectAllowed = 'move';
        block.classList.add('dragging');
      });

      block.addEventListener('dragend', () => {
        block.classList.remove('dragging');
        document.querySelectorAll('.matrix-day-col').forEach(c => c.classList.remove('drag-over'));
      });

      // Hover Tooltip events
      const tooltip = document.getElementById('slotHoverTooltip');

      block.addEventListener('mouseenter', () => {
        if (!tooltip) return;
        tooltip.style.borderLeftColor = slotBg;
        tooltip.innerHTML = `
          <div style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">
            ${day.name} • ${timetable.title}
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

      // Duplicate button listener
      block.querySelector('.duplicate-slot-btn').addEventListener('click', async (e) => {
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
          await SyncManager.mutate('POST', `/timetables/${timetable._id}/slots`, duplicatePayload, {
            invalidates: [{ cacheKey: 'timetables', endpoint: '/timetables' }]
          });
          Notifications.show('Slot duplicated!', 'success');
          loadCurrentPageData();
        } catch (err) {
          Notifications.show(err.message || 'Failed to duplicate slot', 'error');
        }
      });

      block.querySelector('.edit-slot-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openSlotModal(slot);
      });

      block.querySelector('.delete-slot-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${slot.subject}"?`)) {
          await SyncManager.mutate('DELETE', `/timetables/${timetable._id}/slots/${slot._id}`, null, {
            invalidates: [{ cacheKey: 'timetables', endpoint: '/timetables' }]
          });
          Notifications.show('Slot removed', 'info');
          loadCurrentPageData();
        }
      });

      dayCol.appendChild(block);
    });

    gridContainer.appendChild(dayCol);
  });
}

function openTimetableModal(timetableToEdit = null) {
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

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Color Accent</label>
          <input type="color" id="ttColorInput" class="form-control" value="${timetableToEdit ? timetableToEdit.color : '#6366F1'}" style="height:44px; padding:3px; cursor:pointer;">
        </div>

        <div class="form-group" style="flex:1; display:flex; align-items:center; pt:1.5rem; margin-top:1.5rem;">
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:700; cursor:pointer; font-size:0.875rem;">
            <input type="checkbox" id="ttPrimaryCheckbox" ${timetableToEdit && timetableToEdit.isPrimary ? 'checked' : ''} style="width:18px; height:18px;">
            Set as Primary Timetable
          </label>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button type="submit" class="btn btn-primary">${timetableToEdit ? 'Save Changes' : 'Create Timetable'}</button>
      </div>
    </form>
  `;

  Modal.open(timetableToEdit ? 'Edit Timetable' : 'Create New Timetable', formHtml);

  document.getElementById('timetableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('ttTitleInput').value.trim(),
      description: document.getElementById('ttDescInput').value.trim(),
      color: document.getElementById('ttColorInput').value,
      isPrimary: document.getElementById('ttPrimaryCheckbox').checked
    };

    try {
      const invalidates = [{ cacheKey: 'timetables', endpoint: '/timetables' }];
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
      Notifications.show(err.message, 'error');
    }
  });
}

function openSlotModal(slotToEdit = null) {
  if (!activeTimetableId) {
    Notifications.show('Please create a timetable first.', 'info');
    return;
  }

  const formHtml = `
    <form id="slotForm">
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
        await SyncManager.mutate('PUT', `/timetables/${activeTimetableId}/slots/${slotToEdit._id}`, payload, { invalidates });
        Notifications.show('Slot updated!', 'success');
      } else {
        await SyncManager.mutate('POST', `/timetables/${activeTimetableId}/slots`, payload, { invalidates });
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
