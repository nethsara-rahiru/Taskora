const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    dueTime: {
      type: String,
      default: null // HH:mm format (e.g. "18:00")
    },
    tags: [{
      type: String,
      trim: true
    }],
    itemType: {
      type: String,
      enum: ['task', 'event'],
      default: 'task',
      index: true
    },
    startTime: {
      type: String,
      default: null // HH:mm format (e.g. "14:00")
    },
    endTime: {
      type: String,
      default: null // HH:mm format (e.g. "15:30")
    },
    autoCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    },
    recurring: {
      enabled: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        default: 'daily'
      },
      interval: {
        type: Number,
        default: 1
      },
      daysOfWeek: [{
        type: Number // 0-6 (Sun-Sat)
      }],
      endDate: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user task queries by status & due date
taskSchema.index({ userId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
