const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validation.middleware');

router.use(protect);

router.route('/')
  .get(projectController.getProjects)
  .post(projectController.createProject);

router.route('/:id')
  .get(validateObjectId('id'), projectController.getProjectById)
  .put(validateObjectId('id'), projectController.updateProject)
  .delete(validateObjectId('id'), projectController.deleteProject);

router.post('/:id/archive', validateObjectId('id'), projectController.archiveProject);

module.exports = router;
