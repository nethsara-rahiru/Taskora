const Timetable = require('../models/Timetable');

const getTimetables = async (userId) => {
  return await Timetable.find({ userId }).sort({ isPrimary: -1, createdAt: -1 });
};

const getTimetableById = async (userId, timetableId) => {
  const timetable = await Timetable.findOne({ _id: timetableId, userId });
  if (!timetable) {
    const err = new Error('Timetable not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return timetable;
};

const createTimetable = async (userId, data) => {
  // If set to primary, reset previous primary flag
  if (data.isPrimary) {
    await Timetable.updateMany({ userId }, { isPrimary: false });
  }

  // If this is the user's first timetable, make it primary automatically
  const count = await Timetable.countDocuments({ userId });
  const isPrimary = count === 0 ? true : !!data.isPrimary;

  const timetable = await Timetable.create({
    userId,
    title: data.title,
    description: data.description || '',
    color: data.color || '#6366F1',
    isPrimary,
    slots: data.slots || []
  });

  return timetable;
};

const updateTimetable = async (userId, timetableId, updateData) => {
  if (updateData.isPrimary) {
    await Timetable.updateMany({ userId }, { isPrimary: false });
  }

  const timetable = await Timetable.findOneAndUpdate(
    { _id: timetableId, userId },
    updateData,
    { new: true, runValidators: true }
  );

  if (!timetable) {
    const err = new Error('Timetable not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return timetable;
};

const deleteTimetable = async (userId, timetableId) => {
  const timetable = await Timetable.findOneAndDelete({ _id: timetableId, userId });
  if (!timetable) {
    const err = new Error('Timetable not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // If deleted timetable was primary, elevate the latest remaining timetable to primary
  if (timetable.isPrimary) {
    const nextOne = await Timetable.findOne({ userId }).sort({ createdAt: -1 });
    if (nextOne) {
      nextOne.isPrimary = true;
      await nextOne.save();
    }
  }

  return { success: true };
};

const addSlot = async (userId, timetableId, slotData) => {
  const timetable = await Timetable.findOne({ _id: timetableId, userId });
  if (!timetable) {
    const err = new Error('Timetable not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  timetable.slots.push(slotData);
  await timetable.save();
  return timetable;
};

const updateSlot = async (userId, timetableId, slotId, slotData) => {
  const timetable = await Timetable.findOne({ _id: timetableId, userId });
  if (!timetable) {
    const err = new Error('Timetable not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const slot = timetable.slots.id(slotId);
  if (!slot) {
    const err = new Error('Slot not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  slot.set(slotData);
  await timetable.save();
  return timetable;
};

const deleteSlot = async (userId, timetableId, slotId) => {
  const timetable = await Timetable.findOne({ _id: timetableId, userId });
  if (!timetable) {
    const err = new Error('Timetable not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  timetable.slots.pull(slotId);
  await timetable.save();
  return timetable;
};

module.exports = {
  getTimetables,
  getTimetableById,
  createTimetable,
  updateTimetable,
  deleteTimetable,
  addSlot,
  updateSlot,
  deleteSlot
};
