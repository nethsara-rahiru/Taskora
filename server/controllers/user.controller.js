const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sanitizeUser } = require('../services/auth.service');

const getUserProfile = async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
};

const updateUserProfile = async (req, res, next) => {
  try {
    const { name, email, preferences, whatsapp } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        res.status(400);
        return next(new Error('Email is already taken'));
      }
      user.email = email.toLowerCase();
    }

    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    if (whatsapp) {
      user.whatsapp = { ...user.whatsapp, ...whatsapp };
    }

    await user.save();

    res.json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400);
      return next(new Error('New password must be at least 6 characters long'));
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400);
      return next(new Error('Current password is incorrect'));
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      success: true,
      data: { message: 'Password updated successfully' }
    });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.clearCookie('token');
    res.json({
      success: true,
      data: { message: 'Account deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updatePassword,
  deleteAccount
};
