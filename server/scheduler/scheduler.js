const mongoose = require('mongoose');
const { processPendingReminders } = require('./reminder.worker');
const { processRecurringTasks } = require('./recurring.worker');

let schedulerInterval = null;

const runWorkers = async () => {
  if (mongoose.connection.readyState !== 1) {
    return; // Silent wait until MongoDB is connected
  }
  await processPendingReminders();
  await processRecurringTasks();
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
