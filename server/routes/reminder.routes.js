const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminder.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validation.middleware');

router.use(protect);

router.route('/')
  .get(reminderController.getReminders)
  .post(reminderController.createReminder);

router.delete('/:id', validateObjectId('id'), reminderController.deleteReminder);

module.exports = router;
