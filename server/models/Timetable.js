const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  room: {
    type: String,
    default: '',
    trim: true
  },
  teacher: {
    type: String,
    default: '',
    trim: true
  },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6 // 0=Sunday, 1=Monday, ..., 6=Saturday
  },
  startTime: {
    type: String,
    required: true // HH:mm format (e.g. "09:00")
  },
  endTime: {
    type: String,
    required: true // HH:mm format (e.g. "10:30")
  },
  color: {
    type: String,
    default: '#6366F1'
  }
}, { _id: true });

const timetableSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Timetable title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    color: {
      type: String,
      default: '#6366F1'
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    startsOn: { type: String, default: null },
    endsOn: { type: String, default: null },
    isPaused: { type: Boolean, default: false },
    skipRanges: [{
      _id: false,
      start: { type: String, required: true },
      end: { type: String, required: true }
    }],
    slots: [slotSchema]
  },
  {
    timestamps: true
  }
);

timetableSchema.index({ userId: 1, isPrimary: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
