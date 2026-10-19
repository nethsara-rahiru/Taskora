(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EventTiming = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function minutes(time) {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  }

  function resolve(data) {
    if (data.itemType !== 'event') return { startTime: null, endTime: null };
    const date = data.dueDate;
    if (!date || !Number.isFinite(new Date(date).getTime())) throw new Error('Choose an event date.');
    const startTime = data.startTime || data.dueTime;
    const start = minutes(startTime);
    if (!Number.isFinite(start)) throw new Error('Choose an event start time.');
    let endTime = data.endTime;
    if (data.durationMinutes !== undefined) {
      const duration = Number(data.durationMinutes);
      if (!Number.isInteger(duration) || duration <= 0) throw new Error('Enter a positive duration in minutes.');
      const end = start + duration;
      if (end >= 24 * 60) throw new Error('The event must end on the same day. Choose a shorter duration.');
      endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    }
    const end = minutes(endTime);
    if (!Number.isFinite(end)) throw new Error('Choose an event end time or duration.');
    if (end <= start) throw new Error('The end time must be after the start time on the same day.');
    return { startTime, endTime };
  }

  return { minutes, resolve };
});
