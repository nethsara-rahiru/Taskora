const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateTask, validateObjectId } = require('../middleware/validation.middleware');

router.use(protect);

router.route('/')
  .get(taskController.getTasks)
  .post(validateTask, taskController.createTask);

router.route('/:id')
  .get(validateObjectId('id'), taskController.getTaskById)
  .put(validateObjectId('id'), validateTask, taskController.updateTask)
  .delete(validateObjectId('id'), taskController.deleteTask);

router.post('/:id/complete', validateObjectId('id'), taskController.completeTask);
router.post('/:id/uncomplete', validateObjectId('id'), taskController.uncompleteTask);

module.exports = router;
