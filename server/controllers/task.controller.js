const taskService = require('../services/task.service');

const getTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getTasks(req.user._id, req.query);
    res.json({
      success: true,
      data: { tasks }
    });
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.user._id, req.params.id);
    res.json({
      success: true,
      data: { task }
    });
  } catch (error) {
    next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.user._id, req.body);
    res.status(201).json({
      success: true,
      data: { task }
    });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.user._id, req.params.id, req.body);
    res.json({
      success: true,
      data: { task }
    });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.user._id, req.params.id);
    res.json({
      success: true,
      data: { message: 'Task deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

const completeTask = async (req, res, next) => {
  try {
    const task = await taskService.toggleCompleteTask(req.user._id, req.params.id, true);
    res.json({
      success: true,
      data: { task }
    });
  } catch (error) {
    next(error);
  }
};

const uncompleteTask = async (req, res, next) => {
  try {
    const task = await taskService.toggleCompleteTask(req.user._id, req.params.id, false);
    res.json({
      success: true,
      data: { task }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask
};
