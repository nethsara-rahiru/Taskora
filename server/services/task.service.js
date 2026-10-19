const Task = require('../models/Task');
const Reminder = require('../models/Reminder');
const EventTiming = require('../../public/js/event-timing');

function resolveEventTiming(data) {
  try { return EventTiming.resolve(data); }
  catch (error) { error.code = 'VALIDATION_ERROR'; throw error; }
}

const getTasks = async (userId, filters = {}) => {
  const query = { userId };

  // Filter by view type
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Filter by item type (task vs event)
  if (filters.itemType) {
    query.itemType = filters.itemType;
  }

  if (filters.view === 'today') {
    query.dueDate = { $gte: startOfToday, $lte: endOfToday };
    if (!filters.status) query.status = { $ne: 'completed' };
  } else if (filters.view === 'upcoming') {
    query.dueDate = { $gt: endOfToday };
    if (!filters.status) query.status = { $ne: 'completed' };
  } else if (filters.view === 'overdue') {
    query.dueDate = { $lt: startOfToday };
    query.status = { $nin: ['completed', 'cancelled'] };
    query.itemType = 'task'; // Events never become overdue!
  } else if (filters.view === 'completed') {
    query.status = 'completed';
  }

  // Filter by project
  if (filters.projectId) {
    query.projectId = filters.projectId;
  }

  // Filter by status
  if (filters.status) {
    query.status = filters.status;
  }

  // Filter by priority
  if (filters.priority) {
    query.priority = filters.priority;
  }

  // Filter by tag
  if (filters.tag) {
    query.tags = filters.tag;
  }

  // Filter main tasks vs subtasks
  if (filters.parentTaskId) {
    query.parentTaskId = filters.parentTaskId;
  } else if (filters.mainTasksOnly === 'true') {
    query.parentTaskId = null;
  }

  // Search keyword
  if (filters.search) {
    const searchRegex = new RegExp(filters.search, 'i');
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { tags: searchRegex }
    ];
  }

  // Sorting
  let sortOption = { createdAt: -1 };
  if (filters.sortBy === 'dueDate') {
    sortOption = { dueDate: 1, dueTime: 1 };
  } else if (filters.sortBy === 'priority') {
    // Custom sort order in JS post-query or mapped
    sortOption = { priority: -1 };
  } else if (filters.sortBy === 'alphabetical') {
    sortOption = { title: 1 };
  }

  const tasks = await Task.find(query)
    .populate('projectId', 'name color icon')
    .sort(sortOption);

  return tasks;
};

const getTaskById = async (userId, taskId) => {
  const task = await Task.findOne({ _id: taskId, userId }).populate('projectId', 'name color icon');
  if (!task) {
    const err = new Error('Task not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Get subtasks if any
  const subtasks = await Task.find({ userId, parentTaskId: taskId }).sort({ createdAt: 1 });
  const taskObj = task.toObject();
  taskObj.subtasks = subtasks;

  return taskObj;
};

const createTask = async (userId, taskData) => {
  const task = await Task.create({
    ...taskData,
    ...resolveEventTiming(taskData),
    userId
  });

  // Create reminder if reminder minutes or exact date provided
  if (taskData.reminderMinutes && task.dueDate) {
    const reminderTime = new Date(task.dueDate.getTime() - taskData.reminderMinutes * 60000);
    if (reminderTime > new Date()) {
      await Reminder.create({
        userId,
        taskId: task._id,
        reminderTime,
        channel: 'whatsapp'
      });
    }
  }

  return task;
};

const updateTask = async (userId, taskId, updateData) => {
  const existing = await Task.findOne({ _id: taskId, userId });
  if (!existing) {
    const error = new Error('Task not found'); error.code = 'NOT_FOUND'; throw error;
  }
  const timing = resolveEventTiming({ ...existing.toObject(), ...updateData });
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId },
    { ...updateData, ...timing },
    { new: true, runValidators: true }
  );

  if (!task) {
    const err = new Error('Task not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return task;
};

const deleteTask = async (userId, taskId) => {
  const task = await Task.findOneAndDelete({ _id: taskId, userId });
  if (!task) {
    const err = new Error('Task not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Delete associated subtasks & reminders
  await Task.deleteMany({ parentTaskId: taskId, userId });
  await Reminder.deleteMany({ taskId, userId });

  return { success: true };
};

const toggleCompleteTask = async (userId, taskId, completed = true) => {
  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) {
    const err = new Error('Task not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  task.status = completed ? 'completed' : 'pending';
  task.completedAt = completed ? new Date() : null;
  await task.save();

  // If task completed and is recurring, schedule next occurrence
  if (completed && task.recurring && task.recurring.enabled) {
    await handleRecurringNextTask(task);
  }

  return task;
};

const handleRecurringNextTask = async (task) => {
  const { frequency, interval = 1, endDate } = task.recurring;
  if (!task.dueDate) return;

  const nextDueDate = new Date(task.dueDate);

  if (frequency === 'daily') {
    nextDueDate.setDate(nextDueDate.getDate() + interval);
  } else if (frequency === 'weekly') {
    nextDueDate.setDate(nextDueDate.getDate() + (7 * interval));
  } else if (frequency === 'monthly') {
    nextDueDate.setMonth(nextDueDate.getMonth() + interval);
  } else if (frequency === 'yearly') {
    nextDueDate.setFullYear(nextDueDate.getFullYear() + interval);
  }

  if (endDate && nextDueDate > new Date(endDate)) {
    return; // Recurrence ended
  }

  // Create next recurring task instance
  await Task.create({
    userId: task.userId,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    title: task.title,
    description: task.description,
    status: 'pending',
    priority: task.priority,
    dueDate: nextDueDate,
    dueTime: task.dueTime,
    tags: task.tags,
    recurring: task.recurring
  });
};

/**
 * Finds all active events whose event end time / date has passed, and automatically
 * marks them as completed with autoCompleted = true.
 */
const autoCompleteExpiredEvents = async () => {
  const now = new Date();
  
  // Find events that are still pending / in_progress
  const activeEvents = await Task.find({
    itemType: 'event',
    status: { $nin: ['completed', 'cancelled'] },
    dueDate: { $ne: null }
  });

  let completedCount = 0;

  for (const event of activeEvents) {
    let eventEndTime = new Date(event.dueDate);

    // If endTime (or dueTime) specified, parse HH:mm
    const timeStr = event.endTime || event.dueTime;
    if (timeStr && timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      eventEndTime.setHours(hours, minutes, 59, 999);
    } else {
      // Default to end of day if no time specified
      eventEndTime.setHours(23, 59, 59, 999);
    }

    if (now > eventEndTime) {
      event.status = 'completed';
      event.autoCompleted = true;
      event.completedAt = new Date();
      await event.save();
      completedCount++;
    }
  }

  return completedCount;
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  toggleCompleteTask,
  handleRecurringNextTask,
  autoCompleteExpiredEvents
};
