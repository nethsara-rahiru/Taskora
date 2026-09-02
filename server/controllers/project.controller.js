const Project = require('../models/Project');
const Task = require('../models/Task');

const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { projects }
    });
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      res.status(404);
      return next(new Error('Project not found'));
    }
    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const { name, description, icon, color } = req.body;
    if (!name || !name.trim()) {
      res.status(400);
      return next(new Error('Project name is required'));
    }

    const project = await Project.create({
      userId: req.user._id,
      name,
      description: description || '',
      icon: icon || 'folder',
      color: color || '#6366F1'
    });

    res.status(201).json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!project) {
      res.status(404);
      return next(new Error('Project not found'));
    }

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      res.status(404);
      return next(new Error('Project not found'));
    }

    // Unassign tasks from this project
    await Task.updateMany({ projectId: req.params.id, userId: req.user._id }, { projectId: null });

    res.json({
      success: true,
      data: { message: 'Project deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

const archiveProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      res.status(404);
      return next(new Error('Project not found'));
    }

    project.archived = !project.archived;
    await project.save();

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  archiveProject
};
