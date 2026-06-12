const Asset = require('../models/asset.model');
const QRCode = require('qrcode');
const z = require('zod');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

// Zod schemas for validation
const createAssetSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  // totalQuantity comes in as a string when using multipart/form-data, so we transform it to a number
  totalQuantity: z.string().or(z.number()).transform(val => Number(val)).refine(val => val >= 1, "Total quantity must be at least 1"),
});

const updateAssetSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  totalQuantity: z.string().or(z.number()).transform(val => Number(val)).refine(val => val >= 1).optional(),
});

// GET /assets
exports.getAllAssets = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { isDeleted: false };
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    // Execute query with pagination
    const assets = await Asset.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Asset.countDocuments(query);

    return res.status(200).json({
      assets,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("Get All Assets Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /assets/:id
exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }
    
    return res.status(200).json({ asset });
  } catch (error) {
    console.error("Get Asset By ID Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /assets
exports.createAsset = async (req, res) => {
  try {
    const parsedData = createAssetSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation error", errors: parsedData.error.errors });
    }

    const assetData = parsedData.data;
    
    // Force availableQuantity to equal totalQuantity on creation
    assetData.availableQuantity = assetData.totalQuantity;
    assetData.createdBy = req.user.id;

    // Handle image upload if present
    if (req.file) {
      assetData.imageUrl = `/uploads/assets/${req.file.filename}`;
    }

    const newAsset = new Asset(assetData);
    await newAsset.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_CREATED, 'asset', newAsset._id, {
      name: newAsset.name, category: newAsset.category,
      totalQuantity: newAsset.totalQuantity,
    });

    return res.status(201).json({ message: "Asset created successfully", asset: newAsset });
  } catch (error) {
    console.error("Create Asset Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /assets/:id
exports.updateAsset = async (req, res) => {
  try {
    const parsedData = updateAssetSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation error", errors: parsedData.error.errors });
    }

    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    const updates = parsedData.data;

    // If totalQuantity is being updated, adjust availableQuantity accordingly
    if (updates.totalQuantity !== undefined && updates.totalQuantity !== asset.totalQuantity) {
      const difference = updates.totalQuantity - asset.totalQuantity;
      const newAvailable = asset.availableQuantity + difference;
      
      if (newAvailable < 0) {
        return res.status(400).json({ 
          message: "Cannot reduce total quantity below currently issued items." 
        });
      }
      
      asset.totalQuantity = updates.totalQuantity;
      asset.availableQuantity = newAvailable;
    }

    // Update other fields
    if (updates.name) asset.name = updates.name;
    if (updates.category) asset.category = updates.category;
    if (updates.description !== undefined) asset.description = updates.description;

    // Handle new image upload
    if (req.file) {
      asset.imageUrl = `/uploads/assets/${req.file.filename}`;
    }

    await asset.save(); // The pre-save hook will automatically recalculate the status!

    await createAuditLog(req.user.id, ACTIONS.ASSET_UPDATED, 'asset', asset._id, {
      changes: updates,
      ...(req.file ? { imageUpdated: true } : {}),
    });

    return res.status(200).json({ message: "Asset updated successfully", asset });
  } catch (error) {
    console.error("Update Asset Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /assets/:id
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    // Soft delete (keeps history intact for past bookings)
    asset.isDeleted = true;
    await asset.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_DELETED, 'asset', asset._id, {
      name: asset.name, category: asset.category,
    });

    return res.status(200).json({ message: "Asset deleted successfully" });
  } catch (error) {
    console.error("Delete Asset Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /assets/:id/qr
exports.getAssetQRCode = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const assetUrl = `${frontendBaseUrl}/assets/${asset._id}`;

    // Generate QR Code as data URL
    const qrDataUrl = await QRCode.toDataURL(assetUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // Persist to DB on first generation
    if (!asset.qrCode) {
      asset.qrCode = qrDataUrl;
      await asset.save();
    }

    return res.status(200).json({ qrCode: qrDataUrl });
  } catch (error) {
    console.error("QR Code Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /assets/:id/qr/download  — streams PNG so browser triggers Save As
exports.downloadAssetQRCode = async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const assetUrl = `${frontendBaseUrl}/assets/${asset._id}`;

    // Generate as raw PNG buffer
    const pngBuffer = await QRCode.toBuffer(assetUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    const safeName = asset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr_${safeName}.png"`);
    return res.send(pngBuffer);
  } catch (error) {
    console.error("QR Download Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
