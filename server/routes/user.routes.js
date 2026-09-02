const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', userController.getUserProfile);
router.put('/', userController.updateUserProfile);
router.put('/password', userController.updatePassword);
router.delete('/', userController.deleteAccount);

module.exports = router;
