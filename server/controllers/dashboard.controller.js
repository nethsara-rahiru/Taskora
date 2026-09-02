const Task = require('../models/Task');
const Project = require('../models/Project');

const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Counts
    const todayTasksCount = await Task.countDocuments({
      userId,
      dueDate: { $gte: startOfToday, $lte: endOfToday },
      status: { $ne: 'completed' }
    });

    const completedTodayCount = await Task.countDocuments({
      userId,
      status: 'completed',
      completedAt: { $gte: startOfToday, $lte: endOfToday }
    });

    const overdueCount = await Task.countDocuments({
      userId,
      dueDate: { $lt: startOfToday },
      status: { $nin: ['completed', 'cancelled'] }
    });

    const upcomingCount = await Task.countDocuments({
      userId,
      dueDate: { $gt: endOfToday },
      status: { $ne: 'completed' }
    });

    const totalTasks = await Task.countDocuments({ userId });
    const totalCompleted = await Task.countDocuments({ userId, status: 'completed' });
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // Today's list
    const todayTasks = await Task.find({
      userId,
      dueDate: { $gte: startOfToday, $lte: endOfToday }
    }).populate('projectId', 'name color icon').sort({ dueTime: 1, priority: -1 });

    // Recently completed
    const recentlyCompleted = await Task.find({
      userId,
      status: 'completed'
    }).populate('projectId', 'name color icon').sort({ completedAt: -1 }).limit(5);

    // Active projects count
    const projectsCount = await Project.countDocuments({ userId, archived: false });

    res.json({
      success: true,
      data: {
        summary: {
          todayTasks: todayTasksCount,
          completedToday: completedTodayCount,
          overdue: overdueCount,
          upcoming: upcomingCount,
          totalTasks,
          totalCompleted,
          completionRate,
          projectsCount
        },
        todayTasks,
        recentlyCompleted
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
