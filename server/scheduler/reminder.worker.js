const Reminder = require('../models/Reminder');
const { findPendingDueReminders } = require('../services/reminder.service');
const { sendWhatsAppMessage } = require('../services/whatsapp.service');
const { logNotification } = require('../services/notification.service');

const processPendingReminders = async () => {
  try {
    const dueReminders = await findPendingDueReminders();
    if (!dueReminders || dueReminders.length === 0) return;

    console.log(`[Reminder Worker] Found ${dueReminders.length} due reminder(s) to process.`);

    for (const reminder of dueReminders) {
      // Prevent race conditions by atomically setting status to 'processing'
      const updated = await Reminder.findOneAndUpdate(
        { _id: reminder._id, status: 'pending' },
        { status: 'processing' }
      );

      if (!updated) continue; // Already picked up by another process

      const user = reminder.userId;
      const task = reminder.taskId;

      // Skip if task deleted or completed/cancelled
      if (!task || task.status === 'completed' || task.status === 'cancelled') {
        await Reminder.findByIdAndUpdate(reminder._id, { status: 'cancelled' });
        continue;
      }

      const messageText = `🔔 *Taskora Reminder*\n\nHi ${user.name || 'there'},\nYour task "*${task.title}*" is due! ${task.dueTime ? `\nDue Time: ${task.dueTime}` : ''}\n\nTaskora Productivity App`;

      try {
        const dispatchResult = await sendWhatsAppMessage({
          phoneNumber: user.whatsapp?.phoneNumber || 'User',
          message: messageText
        });

        await Reminder.findByIdAndUpdate(reminder._id, {
          status: 'sent',
          sentAt: new Date()
        });

        await logNotification({
          userId: user._id,
          taskId: task._id,
          reminderId: reminder._id,
          type: 'reminder',
          channel: 'whatsapp',
          message: messageText,
          status: 'sent'
        });

        console.log(`[Reminder Worker] Reminder ${reminder._id} sent successfully for task "${task.title}".`);
      } catch (err) {
        console.error(`[Reminder Worker Error] Failed to send reminder ${reminder._id}: ${err.message}`);

        await Reminder.findByIdAndUpdate(reminder._id, {
          status: 'failed'
        });

        await logNotification({
          userId: user._id,
          taskId: task._id,
          reminderId: reminder._id,
          type: 'reminder',
          channel: 'whatsapp',
          message: messageText,
          status: 'failed',
          error: err.message
        });
      }
    }
  } catch (error) {
    console.error(`[Reminder Worker Fatal Error] ${error.message}`);
  }
};

module.exports = {
  processPendingReminders
};
