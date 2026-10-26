const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const weather = require('../services/weather.service');
router.use(protect);
const handle = fn => async (req, res, next) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (error) { if (error.status) res.status(error.status); next(error); }
};
router.get('/locations', handle(req => weather.search(req.query.q)));
router.get('/forecast', handle(req => weather.forecast(req.query.latitude, req.query.longitude)));
module.exports = router;
