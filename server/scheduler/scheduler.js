const mongoose = require('mongoose');
const { processPendingReminders } = require('./reminder.worker');
const { processRecurringTasks } = require('./recurring.worker');

const { autoCompleteExpiredEvents } = require('../services/task.service');

let schedulerInterval = null;

const runWorkers = async () => {
  if (mongoose.connection.readyState !== 1) {
    return; // Silent wait until MongoDB is connected
  }
  await processPendingReminders();
  await processRecurringTasks();
  try {
    const expiredCount = await autoCompleteExpiredEvents();
    if (expiredCount > 0) {
      console.log(`[Taskora Scheduler] Automatically completed ${expiredCount} expired event(s).`);
    }
  } catch (err) {
    console.error('[Taskora Scheduler] Error auto-completing events:', err.message);
  }
};

const startScheduler = (intervalMs = 30000) => {
  console.log(`[Taskora Scheduler] Scheduler initialized (polling interval: ${intervalMs / 1000}s)...`);

  // Run initial check
  runWorkers();

  // Set periodic execution timer
  schedulerInterval = setInterval(runWorkers, intervalMs);
};

const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    console.log('[Taskora Scheduler] Scheduler stopped.');
  }
};

module.exports = {
  startScheduler,
  stopScheduler
};
