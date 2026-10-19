const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetable.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validation.middleware');

router.use(protect);

const validateSchedule = async (req, res, next) => {
  try {
    const rules = require('../../public/js/schedule-rules');
    let settings = req.body;
    if (req.method === 'PUT') {
      const timetable = await require('../services/timetable.service').getTimetableById(req.user._id, req.params.id);
      settings = { startsOn: timetable.startsOn || null, endsOn: timetable.endsOn || null, ...req.body };
    }
    rules.normalizeSettings(settings);
    if (req.method === 'POST' && (typeof req.body.title !== 'string' || !req.body.title.trim())) {
      throw new Error('A schedule title is required.');
    }
    next();
  } catch (error) {
    res.status(error.code === 'NOT_FOUND' ? 404 : 400);
    next(error);
  }
};

router.route('/')
  .get(timetableController.getTimetables)
  .post(validateSchedule, timetableController.createTimetable);

router.route('/:id')
  .get(validateObjectId('id'), timetableController.getTimetableById)
  .put(validateObjectId('id'), validateSchedule, timetableController.updateTimetable)
  .delete(validateObjectId('id'), timetableController.deleteTimetable);

router.route('/:id/slots')
  .post(validateObjectId('id'), timetableController.addSlot);

router.route('/:id/slots/:slotId')
  .put(validateObjectId('id'), validateObjectId('slotId'), timetableController.updateSlot)
  .delete(validateObjectId('id'), validateObjectId('slotId'), timetableController.deleteSlot);

module.exports = router;
