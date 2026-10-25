const EventTiming = require('../../public/js/event-timing');
const ScheduleRules = require('../../public/js/schedule-rules');
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'];
const DEFAULTS = { enabled: false, model: MODELS[0], timezone: 'Asia/Colombo', workdayStart: '08:00', workdayEnd: '18:00', defaultDuration: 30 };
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function validTimezone(value) {
  if (typeof value !== 'string' || value.length > 80) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch (_) { return false; }
}
function localDate(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function settings(data, existing = DEFAULTS) {
  const result = { ...DEFAULTS, ...existing };
  for (const key of Object.keys(DEFAULTS)) if (key in data) result[key] = data[key];
  if (typeof result.enabled !== 'boolean' || !MODELS.includes(result.model) || !validTimezone(result.timezone)) fail('Choose valid AI settings, a supported model, and an IANA timezone.');
  if (!Number.isFinite(EventTiming.minutes(result.workdayStart)) || !Number.isFinite(EventTiming.minutes(result.workdayEnd)) || result.workdayStart >= result.workdayEnd) fail('Working hours must start before they end on the same day.');
  if (!Number.isInteger(result.defaultDuration) || result.defaultDuration < 5 || result.defaultDuration > 480) fail('Default task duration must be 5–480 minutes.');
  return result;
}
function values(input, original = null) {
  if (!input || typeof input !== 'object') fail('The AI returned an invalid task proposal. Try a more specific request.', 502);
  const itemType = original ? original.itemType || 'task' : input.itemType || 'task';
  const result = { itemType, title: String(input.title || original?.title || '').trim().slice(0, 240),
    description: String(input.description ?? original?.description ?? '').slice(0, 2000),
    priority: input.priority || original?.priority || 'medium',
    dueDate: input.dueDate || null, dueTime: input.dueTime || input.startTime || null };
  if (!result.title || !['task', 'event'].includes(itemType) || !['low', 'medium', 'high', 'urgent'].includes(result.priority)) fail('A proposal needs a title, valid type, and priority.');
  if (result.dueDate && !ScheduleRules.validDate(result.dueDate)) fail('Proposal dates must use YYYY-MM-DD.');
  if (result.dueTime && !Number.isFinite(EventTiming.minutes(result.dueTime))) fail('Proposal times must use HH:mm.');
  try { Object.assign(result, EventTiming.resolve({ ...result, startTime: result.dueTime, endTime: input.endTime, ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}) })); }
  catch (error) { fail(error.message); }
  return result;
}
function busyIntervals(tasks, timetables, start, end, duration = 30) {
  const blocks = [];
  for (const task of tasks) {
    if (['completed', 'cancelled'].includes(task.status) || !task.dueDate) continue;
    const date = new Date(task.dueDate).toISOString().slice(0, 10);
    const time = task.startTime || task.dueTime;
    if (date < start || date > end || !Number.isFinite(EventTiming.minutes(time))) continue;
    blocks.push({ date, start: EventTiming.minutes(time), end: task.itemType === 'event' && task.endTime ? EventTiming.minutes(task.endTime) : Math.min(1440, EventTiming.minutes(time) + duration), taskId: String(task._id), title: task.title });
  }
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const timetable of timetables) {
      if (!ScheduleRules.isActiveOn(timetable, date)) continue;
      for (const slot of timetable.slots || []) {
        if (slot.dayOfWeek === day) blocks.push({ date, start: EventTiming.minutes(slot.startTime), end: EventTiming.minutes(slot.endTime), title: `${timetable.title}: ${slot.subject}` });
      }
    }
  }
  return blocks;
}
function conflicts(value, blocks, taskId, duration = 30) {
  if (!value.dueDate || !value.dueTime) return [];
  const start = EventTiming.minutes(value.dueTime);
  const end = value.itemType === 'event' ? EventTiming.minutes(value.endTime) : Math.min(1440, start + duration);
  return blocks.filter(block => block.date === value.dueDate && (!taskId || block.taskId !== String(taskId)) && start < block.end && end > block.start).map(block => block.title);
}
module.exports = { MODELS, DEFAULTS, fail, validTimezone, localDate, addDays, settings, values, busyIntervals, conflicts };
