const express = require('express');
const router = express.Router();

// Import controller and middleware (you will need to create these next)
const analyticsController = require('../controllers/analytics.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

// All analytics routes require admin privileges
router.use(requireAuth, requireAdmin);

// GET /analytics/summary → [Admin] Summary stats cards
router.get('/summary', analyticsController.getSummary);

// GET /analytics/utilization → [Admin] Utilization rates over time
router.get('/utilization', analyticsController.getUtilization);

// GET /analytics/popular → [Admin] Most booked assets
router.get('/popular', analyticsController.getPopularAssets);

// GET /analytics/status-distribution → [Admin] Booking status distribution (pie chart)
router.get('/status-distribution', analyticsController.getStatusDistribution);

// GET /analytics/category-utilization → [Admin] Utilization rate per category (bar chart)
router.get('/category-utilization', analyticsController.getCategoryUtilization);

// GET /analytics/overdue → [Admin] Current overdue list
router.get('/overdue', analyticsController.getOverdueBookings);

module.exports = router;
