const Task = require('../models/Task');
const { handleRecurringNextTask } = require('../services/task.service');

const processRecurringTasks = async () => {
  try {
    const now = new Date();
    // Find recurring tasks whose due date passed and are marked pending
    const recurringTasks = await Task.find({
      'recurring.enabled': true,
      status: 'pending',
      dueDate: { $lt: now }
    });

    for (const task of recurringTasks) {
      // Auto advance or create next instance if overdue recurring task
      await handleRecurringNextTask(task);
    }
  } catch (error) {
    console.error(`[Recurring Worker Error] ${error.message}`);
  }
};

module.exports = {
  processRecurringTasks
};
