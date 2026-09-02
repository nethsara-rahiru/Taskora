const Notification = require('../models/Notification');

const logNotification = async ({ userId, taskId, reminderId, type = 'reminder', channel = 'whatsapp', message, status = 'unread', error = null }) => {
  try {
    const notification = await Notification.create({
      userId,
      taskId,
      reminderId,
      type,
      channel,
      message,
      status,
      error,
      sentAt: new Date()
    });
    return notification;
  } catch (err) {
    console.error(`[Notification Log Error] ${err.message}`);
  }
};

const getUserNotifications = async (userId, limit = 20) => {
  return await Notification.find({ userId })
    .sort({ sentAt: -1 })
    .limit(limit)
    .populate('taskId', 'title dueDate dueTime priority');
};

const markAsRead = async (userId, notificationId) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { status: 'read' },
    { new: true }
  );
};

module.exports = {
  logNotification,
  getUserNotifications,
  markAsRead
};
