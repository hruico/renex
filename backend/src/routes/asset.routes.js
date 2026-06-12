const express = require('express');
const router = express.Router();

// Import controller and middleware (you will need to create these next)
const assetController = require('../controllers/asset.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// GET /assets → List all assets (search, filter, paginate)
router.get('/', assetController.getAllAssets);

// GET /assets/:id → Single asset detail
router.get('/:id', assetController.getAssetById);

// POST /assets → [Admin] Create asset
router.post('/', requireAuth, requireAdmin, upload.single('image'), assetController.createAsset);

// PUT /assets/:id → [Admin] Update asset
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), assetController.updateAsset);

// DELETE /assets/:id → [Admin] Soft delete asset
router.delete('/:id', requireAuth, requireAdmin, assetController.deleteAsset);

// GET /assets/:id/qr → [Admin] Generate/get QR code (returns data URL)
router.get('/:id/qr', requireAuth, requireAdmin, assetController.getAssetQRCode);

// GET /assets/:id/qr/download → [Admin] Download QR code as PNG
router.get('/:id/qr/download', requireAuth, requireAdmin, assetController.downloadAssetQRCode);

module.exports = router;
