const Tag = require('../models/Tag');

const getTags = async (req, res, next) => {
  try {
    const tags = await Tag.find({ userId: req.user._id }).sort({ name: 1 });
    res.json({
      success: true,
      data: { tags }
    });
  } catch (error) {
    next(error);
  }
};

const createTag = async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      res.status(400);
      return next(new Error('Tag name is required'));
    }

    const tag = await Tag.create({
      userId: req.user._id,
      name: name.trim(),
      color: color || '#4F46E5'
    });

    res.status(201).json({
      success: true,
      data: { tag }
    });
  } catch (error) {
    next(error);
  }
};

const updateTag = async (req, res, next) => {
  try {
    const tag = await Tag.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!tag) {
      res.status(404);
      return next(new Error('Tag not found'));
    }
    res.json({
      success: true,
      data: { tag }
    });
  } catch (error) {
    next(error);
  }
};

const deleteTag = async (req, res, next) => {
  try {
    const tag = await Tag.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!tag) {
      res.status(404);
      return next(new Error('Tag not found'));
    }
    res.json({
      success: true,
      data: { message: 'Tag deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTags,
  createTag,
  updateTag,
  deleteTag
};
