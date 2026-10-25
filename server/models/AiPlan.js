const mongoose = require('mongoose');
const actionSchema = new mongoose.Schema({
  operation: { type: String, enum: ['create', 'update'], required: true },
  targetType: { type: String, enum: ['task', 'event', 'timetable', 'slot'] },
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', default: null },
  slotId: { type: mongoose.Schema.Types.ObjectId, default: null },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  originalUpdatedAt: Date,
  originalValues: mongoose.Schema.Types.Mixed,
  targetTitle: String,
  values: mongoose.Schema.Types.Mixed,
  reason: String,
  state: { type: String, enum: ['pending', 'applying', 'applied'], default: 'pending' },
  resultTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }
}, { _id: false });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  timezone: String,
  planningStart: String,
  planningEnd: String,
  actions: [actionSchema],
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });
module.exports = mongoose.model('AiPlan', schema);
