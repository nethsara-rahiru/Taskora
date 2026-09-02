const Reminder = require('../models/Reminder');
const Task = require('../models/Task');

const createReminder = async (userId, reminderData) => {
  const task = await Task.findOne({ _id: reminderData.taskId, userId });
  if (!task) {
    const err = new Error('Associated task not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const reminder = await Reminder.create({
    userId,
    taskId: reminderData.taskId,
    reminderTime: reminderData.reminderTime,
    channel: reminderData.channel || 'whatsapp'
  });

  return reminder;
};

const getUserReminders = async (userId) => {
  return await Reminder.find({ userId })
    .populate('taskId', 'title dueDate dueTime priority status')
    .sort({ reminderTime: 1 });
};

const deleteReminder = async (userId, reminderId) => {
  const reminder = await Reminder.findOneAndDelete({ _id: reminderId, userId });
  if (!reminder) {
    const err = new Error('Reminder not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return { success: true };
};

const findPendingDueReminders = async () => {
  const now = new Date();
  // Fetch reminders that are due and still pending
  return await Reminder.find({
    status: 'pending',
    reminderTime: { $lte: now }
  }).populate('userId', 'name email whatsapp').populate('taskId', 'title description dueDate dueTime status');
};

module.exports = {
  createReminder,
  getUserReminders,
  deleteReminder,
  findPendingDueReminders
};
