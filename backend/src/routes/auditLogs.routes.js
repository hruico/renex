const express = require('express');
const router = express.Router();

// Import controller and middleware (you will need to create these next)
const auditLogController = require('../controllers/auditLog.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

// All audit log routes require admin privileges
router.use(requireAuth, requireAdmin);

// GET /audit-logs → [Admin] Paginated audit log
router.get('/', auditLogController.getAuditLogs);

module.exports = router;
