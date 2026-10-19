/* Date-only schedule rules shared by the browser and dashboard API. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScheduleRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const rank = { urgent: 3, high: 2, medium: 1, low: 0 };

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function isActiveOn(schedule, date) {
    const key = typeof date === 'string' ? date : dateKey(date);
    return !schedule.isPaused &&
      (!schedule.startsOn || key >= schedule.startsOn) &&
      (!schedule.endsOn || key <= schedule.endsOn) &&
      !(schedule.skipRanges || []).some(range => key >= range.start && key <= range.end);
  }

  function comparePriority(a, b) {
    return (rank[b.priority || 'medium'] ?? 1) - (rank[a.priority || 'medium'] ?? 1);
  }

  function normalizeSettings(data) {
    const settings = {};
    if ('priority' in data) {
      if (!priorities.includes(data.priority)) throw new Error('Choose a valid schedule priority.');
      settings.priority = data.priority;
    }
    for (const field of ['startsOn', 'endsOn']) {
      if (!(field in data)) continue;
      if (data[field] !== null && data[field] !== '' && !validDate(data[field])) {
        throw new Error('Schedule dates must be valid dates in YYYY-MM-DD format.');
      }
      settings[field] = data[field] || null;
    }
    if (data.startsOn && data.endsOn && data.startsOn > data.endsOn) {
      throw new Error('The end date must be on or after the start date.');
    }
    if ('isPaused' in data) {
      if (typeof data.isPaused !== 'boolean') throw new Error('Pause must be true or false.');
      settings.isPaused = data.isPaused;
    }
    if ('skipRanges' in data) {
      if (!Array.isArray(data.skipRanges) || data.skipRanges.length > 100) {
        throw new Error('Use at most 100 skip ranges.');
      }
      settings.skipRanges = data.skipRanges.map(range => {
        if (!range || !validDate(range.start) || !validDate(range.end) || range.start > range.end) {
          throw new Error('Each skip range needs valid start and end dates in order.');
        }
        return { start: range.start, end: range.end };
      });
    }
    return settings;
  }

  return { priorities, dateKey, validDate, isActiveOn, comparePriority, normalizeSettings };
});
