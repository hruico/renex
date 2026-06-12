const Asset = require('../models/asset.model');
const QRCode = require('qrcode');
const { z } = require('zod');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

const createAssetSchema = z.object({
  name:          z.string().min(2).max(255),
  category:      z.string().min(1),
  description:   z.string().optional(),
  totalQuantity: z.union([z.string(), z.number()]).transform(Number).refine(v => v >= 1),
});

const updateAssetSchema = z.object({
  name:          z.string().min(2).max(255).optional(),
  category:      z.string().min(1).optional(),
  description:   z.string().optional(),
  totalQuantity: z.union([z.string(), z.number()]).transform(Number).refine(v => v >= 1).optional(),
});

exports.getAllAssets = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 20 } = req.query;
    const query = { isDeleted: false };
    if (search)   query.$text     = { $search: search };
    if (category) query.category  = category;
    if (status)   query.status    = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [assets, total] = await Promise.all([
      Asset.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Asset.countDocuments(query),
    ]);

    return res.status(200).json({ assets, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    console.error('getAllAssets error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    return res.status(200).json({ asset });
  } catch (err) {
    console.error('getAssetById error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });

    const data = { ...parsed.data, availableQuantity: parsed.data.totalQuantity, createdBy: req.user.id };
    if (req.file) data.imageUrl = `/uploads/assets/${req.file.filename}`;

    const asset = new Asset(data);
    await asset.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_CREATED, 'asset', asset._id, {
      name: asset.name, category: asset.category, totalQuantity: asset.totalQuantity,
    });

    return res.status(201).json({ message: 'Asset created successfully', asset });
  } catch (err) {
    console.error('createAsset error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const parsed = updateAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });

    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const updates = parsed.data;

    if (updates.totalQuantity !== undefined && updates.totalQuantity !== asset.totalQuantity) {
      const newAvailable = asset.availableQuantity + (updates.totalQuantity - asset.totalQuantity);
      if (newAvailable < 0) return res.status(400).json({ message: 'Cannot reduce total quantity below currently issued items.' });
      asset.totalQuantity    = updates.totalQuantity;
      asset.availableQuantity = newAvailable;
    }

    if (updates.name)                    asset.name        = updates.name;
    if (updates.category)                asset.category    = updates.category;
    if (updates.description !== undefined) asset.description = updates.description;
    if (req.file)                        asset.imageUrl    = `/uploads/assets/${req.file.filename}`;

    await asset.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_UPDATED, 'asset', asset._id, {
      changes: updates, ...(req.file ? { imageUpdated: true } : {}),
    });

    return res.status(200).json({ message: 'Asset updated successfully', asset });
  } catch (err) {
    console.error('updateAsset error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    asset.isDeleted = true;
    await asset.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_DELETED, 'asset', asset._id, {
      name: asset.name, category: asset.category,
    });

    return res.status(200).json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error('deleteAsset error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAssetQRCode = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const assetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/assets/${asset._id}`;
    const qrDataUrl = await QRCode.toDataURL(assetUrl, { width: 300, margin: 2 });

    if (!asset.qrCode) {
      asset.qrCode = qrDataUrl;
      await asset.save();
    }

    return res.status(200).json({ qrCode: qrDataUrl });
  } catch (err) {
    console.error('getAssetQRCode error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.downloadAssetQRCode = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const assetUrl   = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/assets/${asset._id}`;
    const pngBuffer  = await QRCode.toBuffer(assetUrl, { width: 400, margin: 2 });
    const safeName   = asset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr_${safeName}.png"`);
    return res.send(pngBuffer);
  } catch (err) {
    console.error('downloadAssetQRCode error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
