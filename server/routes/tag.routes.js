const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tag.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validation.middleware');

router.use(protect);

router.route('/')
  .get(tagController.getTags)
  .post(tagController.createTag);

router.route('/:id')
  .put(validateObjectId('id'), tagController.updateTag)
  .delete(validateObjectId('id'), tagController.deleteTag);

module.exports = router;
