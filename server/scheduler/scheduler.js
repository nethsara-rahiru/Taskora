const { processPendingReminders } = require('./reminder.worker');
const { processRecurringTasks } = require('./recurring.worker');

let schedulerInterval = null;

const startScheduler = (intervalMs = 30000) => {
  console.log(`[Taskora Scheduler] Scheduler initialized (polling interval: ${intervalMs / 1000}s)...`);

  // Run immediately on boot
  processPendingReminders();
  processRecurringTasks();

  // Set periodic execution timer
  schedulerInterval = setInterval(async () => {
    await processPendingReminders();
    await processRecurringTasks();
  }, intervalMs);
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
