const timetableService = require('../services/timetable.service');

const getTimetables = async (req, res, next) => {
  try {
    const timetables = await timetableService.getTimetables(req.user._id);
    res.json({
      success: true,
      data: { timetables }
    });
  } catch (error) {
    next(error);
  }
};

const getTimetableById = async (req, res, next) => {
  try {
    const timetable = await timetableService.getTimetableById(req.user._id, req.params.id);
    res.json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    next(error);
  }
};

const createTimetable = async (req, res, next) => {
  try {
    const timetable = await timetableService.createTimetable(req.user._id, req.body);
    res.status(201).json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    next(error);
  }
};

const updateTimetable = async (req, res, next) => {
  try {
    const timetable = await timetableService.updateTimetable(req.user._id, req.params.id, req.body);
    res.json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    next(error);
  }
};

const deleteTimetable = async (req, res, next) => {
  try {
    await timetableService.deleteTimetable(req.user._id, req.params.id);
    res.json({
      success: true,
      data: { message: 'Timetable deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

const addSlot = async (req, res, next) => {
  try {
    const timetable = await timetableService.addSlot(req.user._id, req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    next(error);
  }
};

const updateSlot = async (req, res, next) => {
  try {
    const timetable = await timetableService.updateSlot(req.user._id, req.params.id, req.params.slotId, req.body);
    res.json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    next(error);
  }
};

const deleteSlot = async (req, res, next) => {
  try {
    const timetable = await timetableService.deleteSlot(req.user._id, req.params.id, req.params.slotId);
    res.json({
      success: true,
      data: { timetable }
    });
  } catch (error) {
    next(error);
  }
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
