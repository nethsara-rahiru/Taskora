const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const User = require('../models/User');
const { validateLocation } = require('../lib/weather-location');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/location', (req, res) => res.json({ success: true, data: { location: req.user.weatherLocation || null } }));
router.put('/location', async (req, res, next) => {
  try {
    const location = validateLocation(req.body);
    await User.updateOne({ _id: req.user._id }, { $set: { weatherLocation: location } }, { runValidators: true });
    res.json({ success: true, data: { location } });
  } catch (error) { if (error.status) res.status(error.status); next(error); }
});
router.delete('/location', async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { weatherLocation: null } });
    res.json({ success: true, data: { location: null } });
  } catch (error) { next(error); }
});
router.get('/', userController.getUserProfile);
router.put('/', userController.updateUserProfile);
router.put('/password', userController.updatePassword);
router.delete('/', userController.deleteAccount);

module.exports = router;
