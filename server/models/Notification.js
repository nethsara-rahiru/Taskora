const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    reminderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reminder',
      default: null
    },
    type: {
      type: String,
      default: 'reminder'
    },
    channel: {
      type: String,
      default: 'whatsapp'
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered', 'unread', 'read'],
      default: 'unread'
    },
    error: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
