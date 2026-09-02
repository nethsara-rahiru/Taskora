const User = require('../models/User');
const { sendWhatsAppMessage } = require('../services/whatsapp.service');
const { getUserNotifications, markAsRead } = require('../services/notification.service');

const updateWhatsAppSettings = async (req, res, next) => {
  try {
    const { phoneNumber, enabled } = req.body;
    const user = await User.findById(req.user._id);

    if (phoneNumber !== undefined) user.whatsapp.phoneNumber = phoneNumber;
    if (enabled !== undefined) user.whatsapp.enabled = enabled;

    await user.save();

    res.json({
      success: true,
      data: { whatsapp: user.whatsapp }
    });
  } catch (error) {
    next(error);
  }
};

const sendTestNotification = async (req, res, next) => {
  try {
    const phoneNumber = req.user.whatsapp?.phoneNumber || req.body.phoneNumber;
    
    const result = await sendWhatsAppMessage({
      phoneNumber: phoneNumber || 'User',
      message: `🔔 *Taskora Test Notification*\n\nHi ${req.user.name},\nYour WhatsApp reminders are configured successfully!`
    });

    res.json({
      success: true,
      data: {
        message: 'Test notification sent',
        result
      }
    });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await getUserNotifications(req.user._id);
    res.json({
      success: true,
      data: { notifications }
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await markAsRead(req.user._id, req.params.id);
    res.json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateWhatsAppSettings,
  sendTestNotification,
  getNotifications,
  markNotificationRead
};
