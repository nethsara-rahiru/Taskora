const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetable.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validation.middleware');

router.use(protect);

router.route('/')
  .get(timetableController.getTimetables)
  .post(timetableController.createTimetable);

router.route('/:id')
  .get(validateObjectId('id'), timetableController.getTimetableById)
  .put(validateObjectId('id'), timetableController.updateTimetable)
  .delete(validateObjectId('id'), timetableController.deleteTimetable);

router.route('/:id/slots')
  .post(validateObjectId('id'), timetableController.addSlot);

router.route('/:id/slots/:slotId')
  .put(validateObjectId('id'), validateObjectId('slotId'), timetableController.updateSlot)
  .delete(validateObjectId('id'), validateObjectId('slotId'), timetableController.deleteSlot);

module.exports = router;
