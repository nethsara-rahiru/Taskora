const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth.middleware');
const ai = require('../services/ai.service');
const router = express.Router();
router.use(protect);
router.use((req, res, next) => {
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.get('host')) return res.status(403).json({ error: { message: 'AI requests must come from this Taskora site.' } }); }
    catch (_) { return res.status(403).json({ error: { message: 'Invalid request origin.' } }); }
  }
  res.set('Cache-Control', 'no-store');
  next();
});
const handle = fn => async (req, res, next) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (error) { if (error.status) res.status(error.status); next(error); }
};
router.get('/settings', handle(req => ai.getSettings(req.user._id)));
router.put('/settings', handle(req => ai.saveSettings(req.user._id, req.body)));
router.delete('/settings/key', handle(req => ai.removeKey(req.user._id)));
router.post('/test', handle(req => ai.testConnection(req.user._id)));
router.post('/plan', handle(req => ai.generate(req.user._id, req.body)));
router.post('/plans/:id/actions/:index', handle(req => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id) || !/^\d$/.test(req.params.index)) {
    const error = new Error('Invalid proposal.'); error.status = 400; throw error;
  }
  return ai.apply(req.user._id, req.params.id, Number(req.params.index), req.body);
}));
module.exports = router;
