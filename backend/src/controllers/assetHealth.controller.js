const mongoose = require('mongoose');
const { z } = require('zod');
const AssetHealth = require('../models/assetHealth.model');
const Asset       = require('../models/asset.model');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

const reportSchema = z.object({
  condition: z.enum(['excellent', 'good', 'fair', 'damaged', 'under_maintenance']),
  note:      z.string().optional(),
  bookingId: z.string().optional(),  // optional link to the causing booking
});

// ---------- GET /assets/:id/health  — full condition history for an asset ----------

exports.getAssetHealth = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const [records, total] = await Promise.all([
      AssetHealth.find({ asset: req.params.id })
        .populate('reportedBy', 'name email')
        .populate('booking',    'status startDate endDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AssetHealth.countDocuments({ asset: req.params.id }),
    ]);

    return res.json({
      asset: { _id: asset._id, name: asset.name, status: asset.status },
      records,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getAssetHealth error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- POST /assets/:id/health  [Admin] — log a new condition report ----------

exports.reportAssetHealth = async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });
  }

  const { condition, note, bookingId } = parsed.data;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false }).session(session);
    if (!asset) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Asset not found' });
    }

    const previousCondition = asset.status;

    // If under_maintenance: lock entire inventory
    // If recovering from under_maintenance to a healthy condition: restore it
    if (condition === 'under_maintenance') {
      asset.availableQuantity = 0;
      // status will be forced to 'unavailable' by the pre-save hook (ratio = 0)
    } else if (previousCondition === 'unavailable' && ['excellent', 'good', 'fair'].includes(condition)) {
      // Asset is being cleared from maintenance — restore full quantity
      asset.availableQuantity = asset.totalQuantity;
      // pre-save hook will recalculate status from ratio
    }
    // 'damaged' does not auto-zero inventory; admin decides separately

    await asset.save({ session });

    const record = await AssetHealth.create(
      [{
        asset:      asset._id,
        condition,
        note,
        reportedBy: req.user.id,
        ...(bookingId ? { booking: bookingId } : {}),
      }],
      { session }
    );

    await session.commitTransaction();

    await createAuditLog(
      req.user.id, ACTIONS.ASSET_HEALTH_REPORTED, 'asset', asset._id,
      { healthReport: condition, note, previousStatus: previousCondition, newStatus: asset.status }
    );

    return res.status(201).json({
      message: 'Health report logged successfully',
      record:  record[0],
      asset:   { _id: asset._id, name: asset.name, status: asset.status, availableQuantity: asset.availableQuantity },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('reportAssetHealth error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

// ---------- GET /health  [Admin] — latest condition snapshot across all assets ----------

exports.getAllHealthSnapshots = async (req, res) => {
  try {
    const { condition, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Get the most recent health record per asset using aggregation
    const pipeline = [
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:          '$asset',
          latestRecord: { $first: '$$ROOT' },
        },
      },
      ...(condition ? [{ $match: { 'latestRecord.condition': condition } }] : []),
      {
        $lookup: {
          from:         'assets',
          localField:   '_id',
          foreignField: '_id',
          as:           'asset',
        },
      },
      { $unwind: '$asset' },
      { $match: { 'asset.isDeleted': false } },
      {
        $lookup: {
          from:         'users',
          localField:   'latestRecord.reportedBy',
          foreignField: '_id',
          as:           'reportedBy',
        },
      },
      {
        $project: {
          _id:                        0,
          'asset._id':                1,
          'asset.name':               1,
          'asset.category':           1,
          'asset.status':             1,
          'asset.availableQuantity':  1,
          'asset.totalQuantity':      1,
          'latestRecord.condition':   1,
          'latestRecord.note':        1,
          'latestRecord.createdAt':   1,
          'reportedBy.name':          1,
          'reportedBy.email':         1,
        },
      },
      { $sort: { 'latestRecord.createdAt': -1 } },
      {
        $facet: {
          snapshots:  [{ $skip: skip }, { $limit: Number(limit) }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await AssetHealth.aggregate(pipeline);
    const total    = result.totalCount[0]?.count ?? 0;

    return res.json({
      snapshots: result.snapshots,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getAllHealthSnapshots error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
