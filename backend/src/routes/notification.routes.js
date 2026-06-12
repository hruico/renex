const express = require('express');
const router = express.Router();

// Import controller and middleware (you will need to create these next)
const notificationController = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// All notification routes require authentication
router.use(requireAuth);

// GET /notifications → User's notifications
router.get('/', notificationController.getNotifications);

// PUT /notifications/read-all → Mark all as read
// Note: This route is placed before /:id/read to prevent route parameter collision
router.put('/read-all', notificationController.markAllAsRead);

// PUT /notifications/:id/read → Mark one as read
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
