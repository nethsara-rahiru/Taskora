const mongoose = require('mongoose');

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    return next(new Error('Name is required'));
  }
  if (!email || !email.includes('@')) {
    res.status(400);
    return next(new Error('Valid email is required'));
  }
  if (!password || password.length < 6) {
    res.status(400);
    return next(new Error('Password must be at least 6 characters long'));
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    return next(new Error('Email and password are required'));
  }
  next();
};

const validateTask = (req, res, next) => {
  const { title, priority, status, itemType } = req.body;
  if (req.method === 'POST' && (!title || !title.trim())) {
    res.status(400);
    return next(new Error('Title is required'));
  }
  if (itemType && !['task', 'event'].includes(itemType)) {
    res.status(400);
    return next(new Error('Invalid item type (must be "task" or "event")'));
  }
  if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
    res.status(400);
    return next(new Error('Invalid priority value'));
  }
  if (status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    res.status(400);
    return next(new Error('Invalid status value'));
  }
  next();
};

const validateObjectId = (paramName) => (req, res, next) => {
  const id = req.params[paramName];
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    return next(new Error(`Invalid ${paramName} format`));
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateTask,
  validateObjectId
};
