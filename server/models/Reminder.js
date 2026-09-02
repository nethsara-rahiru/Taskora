const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    reminderTime: {
      type: Date,
      required: true,
      index: true
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'browser'],
      default: 'whatsapp'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    sentAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

reminderSchema.index({ status: 1, reminderTime: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
