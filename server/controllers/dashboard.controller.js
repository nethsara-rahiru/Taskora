const Task = require('../models/Task');
const Project = require('../models/Project');
const Timetable = require('../models/Timetable');
const ScheduleRules = require('../../public/js/schedule-rules');

const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...

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
      itemType: 'task',
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

    // Today's list (Tasks & Events)
    const todayTasks = await Task.find({
      userId,
      dueDate: { $gte: startOfToday, $lte: endOfToday }
    }).populate('projectId', 'name color icon').sort({ dueTime: 1, priority: -1 });

    // Today's Timetable Slots (Gathered from all active timetables)
    let todayTimetableSlots = [];
    const userTimetables = await Timetable.find({ userId });
    userTimetables.forEach(tt => {
      if (tt.slots && ScheduleRules.isActiveOn(tt, now)) {
        const matchingSlots = tt.slots.filter(s => s.dayOfWeek === dayOfWeek).map(s => ({
          ...s.toObject(),
          parentTimetableTitle: tt.title,
          priority: tt.priority || 'medium',
          color: s.color || tt.color
        }));
        todayTimetableSlots.push(...matchingSlots);
      }
    });
    todayTimetableSlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || ScheduleRules.comparePriority(a, b));

    // All active high/urgent tasks; do not silently truncate the dashboard list.
    const highPriorityTasks = await Task.find({
      userId,
      priority: { $in: ['high', 'urgent'] },
      status: { $in: ['pending', 'in_progress'] }
    }).populate('projectId', 'name color icon').sort({ dueDate: 1 });
    highPriorityTasks.sort(ScheduleRules.comparePriority);

    // Upcoming tasks & events (next 7 days)
    const nextWeek = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = await Task.find({
      userId,
      dueDate: { $gt: endOfToday, $lte: nextWeek },
      status: { $ne: 'completed' }
    }).populate('projectId', 'name color icon').sort({ dueDate: 1, dueTime: 1 }).limit(6);

    // Keep the recent card limited to the last 15 hours.
    const recentCompletionCutoff = new Date(now.getTime() - 15 * 60 * 60 * 1000);
    const recentlyCompleted = await Task.find({
      userId,
      status: 'completed',
      $or: [
        { completedAt: { $gte: recentCompletionCutoff, $lte: now } },
        // Older status edits did not record completedAt; use their last update as an estimate.
        { completedAt: null, updatedAt: { $gte: recentCompletionCutoff, $lte: now } }
      ]
    }).populate('projectId', 'name color icon');
    const recentCompletionItems = recentlyCompleted.map(task => ({
      ...task.toObject(),
      completedAt: task.completedAt || task.updatedAt,
      completionTimeEstimated: !task.completedAt
    })).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    // Tomorrow's tasks & events
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
    const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;

    const tomorrowTasks = await Task.find({
      userId,
      dueDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
      status: { $ne: 'completed' }
    }).populate('projectId', 'name color icon').sort({ dueTime: 1, priority: -1 }).limit(10);

    let tomorrowTimetableSlots = [];
    userTimetables.forEach(tt => {
      if (tt.slots && ScheduleRules.isActiveOn(tt, startOfTomorrow)) {
        const matchingSlots = tt.slots.filter(s => s.dayOfWeek === tomorrowDayOfWeek).map(s => ({
          ...s.toObject(),
          parentTimetableTitle: tt.title,
          priority: tt.priority || 'medium',
          color: s.color || tt.color
        }));
        tomorrowTimetableSlots.push(...matchingSlots);
      }
    });
    tomorrowTimetableSlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || ScheduleRules.comparePriority(a, b));

    // Active projects count
    const projectsCount = await Project.countDocuments({ userId, archived: false });

    res.json({
      success: true,
      data: {
        summary: {
          todayTasks: todayTasksCount + todayTimetableSlots.length,
          completedToday: completedTodayCount,
          overdue: overdueCount,
          upcoming: upcomingCount,
          highPriorityCount: highPriorityTasks.length,
          totalTasks,
          totalCompleted,
          completionRate,
          projectsCount
        },
        todayTasks,
        todayTimetableSlots,
        tomorrowTasks,
        tomorrowTimetableSlots,
        highPriorityTasks,
        upcomingTasks,
        recentlyCompleted: recentCompletionItems
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
