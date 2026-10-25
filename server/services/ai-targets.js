const rules = require('./ai-validation');
const schedules = require('../../public/js/schedule-rules');
const timing = require('../../public/js/event-timing');
function typeOf(action) {
  return ['timetable', 'slot'].includes(action.targetType) ? action.targetType : action.values?.itemType || action.itemType || 'task';
}
function matchesSelection(action, selection) {
  if (!selection) return true;
  if (action.operation !== 'update') return false;
  const type = action.targetType || action.itemType || 'task';
  if (selection.type === 'timetable') return ['timetable', 'slot'].includes(type) && String(action.timetableId) === String(selection.id);
  if (selection.type === 'slot') return type === 'slot' && String(action.timetableId) === String(selection.id) && String(action.slotId) === String(selection.slotId);
  return type === selection.type && String(action.taskId) === String(selection.id);
}
function scheduleValues(input, original) {
  if (!input || typeof input !== 'object') rules.fail('A schedule proposal needs its settings.');
  let settings;
  try { settings = schedules.normalizeSettings({ priority: original.priority || 'medium', startsOn: original.startsOn || null,
    endsOn: original.endsOn || null, isPaused: !!original.isPaused, skipRanges: original.skipRanges || [], ...input }); }
  catch (error) { error.status = 400; throw error; }
  const title = String(input.title ?? original.title).trim().slice(0, 240);
  if (!title) rules.fail('A schedule title is required.');
  return { title, description: String(input.description ?? original.description ?? '').slice(0, 2000), ...settings };
}
function slotValues(input, original) {
  if (!input || typeof input !== 'object') rules.fail('A slot proposal needs its weekly timing.');
  const value = {};
  for (const field of ['subject', 'dayOfWeek', 'startTime', 'endTime', 'room', 'teacher']) value[field] = input[field] ?? original[field];
  value.subject = String(value.subject || '').trim().slice(0, 240);
  value.room = String(value.room || '').slice(0, 240); value.teacher = String(value.teacher || '').slice(0, 240);
  if (!value.subject || !Number.isInteger(value.dayOfWeek) || value.dayOfWeek < 0 || value.dayOfWeek > 6) rules.fail('Choose a slot title and valid weekday.');
  if (!Number.isFinite(timing.minutes(value.startTime)) || !Number.isFinite(timing.minutes(value.endTime)) || value.endTime <= value.startTime) rules.fail('The slot must end after it starts on the same day.');
  return value;
}
function slotConflicts(value, timetable, blocks, start, end) {
  const overlaps = new Set();
  for (let date = start; date <= end; date = rules.addDays(date, 1)) {
    if (new Date(`${date}T12:00:00Z`).getUTCDay() !== value.dayOfWeek || !schedules.isActiveOn(timetable, date)) continue;
    for (const title of rules.conflicts({ itemType: 'event', dueDate: date, dueTime: value.startTime, endTime: value.endTime }, blocks)) overlaps.add(title);
  }
  return [...overlaps];
}
module.exports = { typeOf, matchesSelection, scheduleValues, slotValues, slotConflicts };
