const Notification = require('../models/notification.model');

// GET /notifications
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const query = { user: req.user.id };
    if (unread === 'true') query.isRead = false;

    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('relatedBooking', 'status'),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user.id, isRead: false }),
    ]);

    return res.json({
      notifications,
      unreadCount,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    return res.json({ notification });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /notifications/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
