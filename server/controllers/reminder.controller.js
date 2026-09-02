const reminderService = require('../services/reminder.service');

const getReminders = async (req, res, next) => {
  try {
    const reminders = await reminderService.getUserReminders(req.user._id);
    res.json({
      success: true,
      data: { reminders }
    });
  } catch (error) {
    next(error);
  }
};

const createReminder = async (req, res, next) => {
  try {
    const { taskId, reminderTime, channel } = req.body;
    if (!taskId || !reminderTime) {
      res.status(400);
      return next(new Error('Task ID and reminder time are required'));
    }

    const reminder = await reminderService.createReminder(req.user._id, {
      taskId,
      reminderTime: new Date(reminderTime),
      channel
    });

    res.status(201).json({
      success: true,
      data: { reminder }
    });
  } catch (error) {
    next(error);
  }
};

const deleteReminder = async (req, res, next) => {
  try {
    await reminderService.deleteReminder(req.user._id, req.params.id);
    res.json({
      success: true,
      data: { message: 'Reminder deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReminders,
  createReminder,
  deleteReminder
};
