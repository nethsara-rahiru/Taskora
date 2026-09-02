const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.put('/settings', whatsappController.updateWhatsAppSettings);
router.post('/test', whatsappController.sendTestNotification);
router.get('/notifications', whatsappController.getNotifications);
router.post('/notifications/:id/read', whatsappController.markNotificationRead);

module.exports = router;
