const express = require('express');
const router  = express.Router();

const assetHealthController = require('../controllers/assetHealth.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(requireAuth);

// GET /health → [Admin] Latest condition snapshot for every asset
router.get('/', requireAdmin, assetHealthController.getAllHealthSnapshots);

// GET /assets/:id/health → History of condition reports for one asset
router.get('/:id/health', assetHealthController.getAssetHealth);

// POST /assets/:id/health → [Admin] Log a new condition report
router.post('/:id/health', requireAdmin, assetHealthController.reportAssetHealth);

module.exports = router;
