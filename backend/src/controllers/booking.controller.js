const mongoose = require('mongoose');
const { z } = require('zod');
const Booking      = require('../models/booking.model');
const Asset        = require('../models/asset.model');
const Notification = require('../models/notification.model');
const User         = require('../models/user.model');
const { sendEmail, templates } = require('../utils/email');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

// ---------- Validation schemas ----------

const createBookingSchema = z.object({
  assetId:           z.string().min(1, 'Asset ID is required'),
  quantityRequested: z.number({ coerce: true }).int().min(1, 'Quantity must be at least 1'),
  purpose:           z.string().min(3, 'Purpose is required'),
  startDate:         z.string().or(z.date()).transform(v => new Date(v)),
  endDate:           z.string().or(z.date()).transform(v => new Date(v)),
});

const issueSchema = z.object({
  conditionAtIssue: z.string().optional(),
  dueDate:          z.string().or(z.date()).transform(v => new Date(v)).optional(),
});

const returnSchema = z.object({
  conditionAtReturn: z.string().optional(),
  damageNotes:       z.string().optional(),
});

// ---------- Helper ----------

async function createNotification(userId, title, message, type, bookingId) {
  try {
    await Notification.create({
      user:           userId,
      title,
      message,
      type,
      relatedBooking: bookingId,
    });
  } catch (err) {
    // Non-critical — log but don't crash the main flow
    console.error('Notification creation failed:', err.message);
  }
}

// Fetch user email and send — fully fire-and-forget
async function notifyUser(userId, inApp, emailTemplate) {
  // In-app always
  await createNotification(userId, inApp.title, inApp.message, inApp.type, inApp.bookingId);

  // Email — best-effort, never blocks
  try {
    const user = await User.findById(userId).select('name email');
    if (user?.email && emailTemplate) {
      const { subject, html } = emailTemplate(user.name);
      sendEmail({ to: user.email, subject, html });
    }
  } catch (err) {
    console.error('Email dispatch failed:', err.message);
  }
}

// ---------- GET /bookings  [Admin] ----------

exports.getAllBookings = async (req, res) => {
  try {
    const { status, category, userId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build base match for fields that live directly on the booking document
    const baseMatch = {};
    if (status) baseMatch.status = status;
    if (userId) baseMatch.user   = new mongoose.Types.ObjectId(userId);

    // Date range filters on startDate / endDate fields of the booking
    if (startDate || endDate) {
      baseMatch.startDate = {};
      if (startDate) baseMatch.startDate.$gte = new Date(startDate);
      if (endDate)   baseMatch.startDate.$lte = new Date(endDate);
    }

    // When filtering by category we must join with assets — use aggregation for both paths
    // so the response shape stays consistent.
    const matchStage = { ...baseMatch };
    if (category) matchStage['asset.category'] = category;

    const pipeline = [
      // Join asset so we can filter by category and project fields
      { $lookup: { from: 'assets', localField: 'asset', foreignField: '_id', as: 'asset' } },
      { $unwind: '$asset' },
      // Join user for display fields
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      // Run count and paginated results in parallel via $facet
      {
        $facet: {
          bookings: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                status: 1, quantityRequested: 1, purpose: 1,
                startDate: 1, endDate: 1, adminNote: 1, createdAt: 1,
                'user._id': 1, 'user.name': 1, 'user.email': 1,
                'asset._id': 1, 'asset.name': 1, 'asset.category': 1, 'asset.imageUrl': 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Booking.aggregate(pipeline);
    const total    = result.totalCount[0]?.count ?? 0;

    return res.json({
      bookings: result.bookings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getAllBookings error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /bookings/mine  [User] ----------

exports.getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { user: req.user.id };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('asset', 'name category imageUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(query),
    ]);

    return res.json({
      bookings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getMyBookings error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /bookings/:id ----------

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user',       'name email')
      .populate('asset',      'name category imageUrl')
      .populate('approvedBy', 'name email')
      .populate('issueDetails.issuedBy',   'name email')
      .populate('returnDetails.receivedBy', 'name email');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Users can only see their own bookings; admins can see all
    if (req.user.role !== 'admin' && booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({ booking });
  } catch (err) {
    console.error('getBookingById error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- POST /bookings  [User] — transaction-safe ----------

exports.createBooking = async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });
  }

  const { assetId, quantityRequested, purpose, startDate, endDate } = parsed.data;

  // Date validation
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (startDate < now) {
    return res.status(400).json({ message: 'Start date must be today or in the future' });
  }
  if (endDate <= startDate) {
    return res.status(400).json({ message: 'End date must be after start date' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const asset = await Asset.findOne({ _id: assetId, isDeleted: false }).session(session);
    if (!asset) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (asset.availableQuantity < quantityRequested) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Insufficient quantity. Only ${asset.availableQuantity} unit(s) available.`,
      });
    }

    const [booking] = await Booking.create(
      [{
        user:              req.user.id,
        asset:             assetId,
        quantityRequested,
        purpose,
        startDate,
        endDate,
        status:            'pending',
      }],
      { session }
    );

    // Decrement available quantity immediately to hold the stock
    asset.availableQuantity -= quantityRequested;
    await asset.save({ session });

    await session.commitTransaction();

    // Fire-and-forget: audit log + notification (outside transaction)
    await createAuditLog(req.user.id, ACTIONS.BOOKING_CREATED, 'booking', booking._id, {
      assetId, quantityRequested, purpose, startDate, endDate,
    });

    await notifyUser(
      req.user.id,
      {
        title:     'Booking Request Submitted',
        message:   `Your request for "${asset.name}" (x${quantityRequested}) has been submitted and is pending approval.`,
        type:      'approval',
        bookingId: booking._id,
      },
      (userName) => templates.bookingSubmittedEmail(userName, asset.name, quantityRequested)
    );

    return res.status(201).json({ message: 'Booking request created successfully', booking });
  } catch (err) {
    await session.abortTransaction();
    console.error('createBooking error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

// ---------- PUT /bookings/:id/approve  [Admin] ----------

exports.approveBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('asset', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `Cannot approve a booking with status "${booking.status}"` });
    }

    const adminNote = req.body?.adminNote;

    booking.status     = 'approved';
    booking.approvedBy = req.user.id;
    if (adminNote) booking.adminNote = adminNote;
    await booking.save();

    await createAuditLog(req.user.id, ACTIONS.BOOKING_APPROVED, 'booking', booking._id, {
      assetId: booking.asset._id, assetName: booking.asset.name,
      bookingUserId: booking.user, adminNote,
    });

    await notifyUser(
      booking.user,
      {
        title:     'Booking Approved',
        message:   `Your request for "${booking.asset.name}" has been approved.`,
        type:      'approval',
        bookingId: booking._id,
      },
      (userName) => templates.bookingApprovedEmail(userName, booking.asset.name)
    );

    return res.json({ message: 'Booking approved', booking });
  } catch (err) {
    console.error('approveBooking error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- PUT /bookings/:id/reject  [Admin] ----------

exports.rejectBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(req.params.id).session(session).populate('asset', 'name');
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: `Cannot reject a booking with status "${booking.status}"` });
    }

    // Restore the held quantity
    const asset = await Asset.findById(booking.asset._id).session(session);
    if (asset) {
      asset.availableQuantity += booking.quantityRequested;
      await asset.save({ session });
    }

    booking.status = 'rejected';
    const adminNote = req.body?.adminNote;
    if (adminNote) booking.adminNote = adminNote;
    await booking.save({ session });

    await session.commitTransaction();

    await createAuditLog(req.user.id, ACTIONS.BOOKING_REJECTED, 'booking', booking._id, {
      assetId: booking.asset._id, assetName: booking.asset.name,
      bookingUserId: booking.user, adminNote,
    });

    await notifyUser(
      booking.user,
      {
        title:     'Booking Rejected',
        message:   `Your request for "${booking.asset.name}" was rejected.${adminNote ? ' Note: ' + adminNote : ''}`,
        type:      'rejection',
        bookingId: booking._id,
      },
      (userName) => templates.bookingRejectedEmail(userName, booking.asset.name, adminNote)
    );

    return res.json({ message: 'Booking rejected', booking });
  } catch (err) {
    await session.abortTransaction();
    console.error('rejectBooking error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

// ---------- PUT /bookings/:id/issue  [Admin] ----------

exports.issueAsset = async (req, res) => {
  try {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });
    }

    const booking = await Booking.findById(req.params.id).populate('asset', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status !== 'approved') {
      return res.status(400).json({ message: 'Asset can only be issued for approved bookings' });
    }

    booking.status = 'issued';
    booking.issueDetails = {
      issuedBy:         req.user.id,
      issuedAt:         new Date(),
      dueDate:          parsed.data.dueDate || booking.endDate,
      conditionAtIssue: parsed.data.conditionAtIssue || 'good',
    };
    await booking.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_ISSUED, 'booking', booking._id, {
      assetId: booking.asset._id, assetName: booking.asset.name,
      dueDate: booking.issueDetails.dueDate,
      conditionAtIssue: booking.issueDetails.conditionAtIssue,
    });

    await notifyUser(
      booking.user,
      {
        title:     'Asset Issued',
        message:   `"${booking.asset.name}" has been issued to you. Please return by ${booking.issueDetails.dueDate.toDateString()}.`,
        type:      'issued',
        bookingId: booking._id,
      },
      (userName) => templates.assetIssuedEmail(userName, booking.asset.name, booking.issueDetails.dueDate)
    );

    return res.json({ message: 'Asset issued successfully', booking });
  } catch (err) {
    console.error('issueAsset error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- PUT /bookings/:id/return  [Admin] ----------

exports.recordReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parsed = returnSchema.safeParse(req.body);
    if (!parsed.success) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });
    }

    const booking = await Booking.findById(req.params.id).session(session).populate('asset', 'name');
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!['issued', 'overdue'].includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Return can only be recorded for issued or overdue bookings' });
    }

    // Restore quantity
    const asset = await Asset.findById(booking.asset._id).session(session);
    if (asset) {
      asset.availableQuantity += booking.quantityRequested;
      await asset.save({ session });
    }

    booking.status = 'returned';
    booking.returnDetails = {
      receivedBy:        req.user.id,
      returnedAt:        new Date(),
      conditionAtReturn: parsed.data.conditionAtReturn || 'good',
      damageNotes:       parsed.data.damageNotes,
    };
    await booking.save({ session });

    await session.commitTransaction();

    await createAuditLog(req.user.id, ACTIONS.ASSET_RETURNED, 'booking', booking._id, {
      assetId: booking.asset._id, assetName: booking.asset.name,
      conditionAtReturn: booking.returnDetails.conditionAtReturn,
      damageNotes: booking.returnDetails.damageNotes,
    });

    await notifyUser(
      booking.user,
      {
        title:     'Asset Returned',
        message:   `"${booking.asset.name}" has been successfully returned. Thank you!`,
        type:      'returned',
        bookingId: booking._id,
      },
      (userName) => templates.assetReturnedEmail(userName, booking.asset.name)
    );

    return res.json({ message: 'Return recorded successfully', booking });
  } catch (err) {
    await session.abortTransaction();
    console.error('recordReturn error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

// ---------- POST /bookings/bulk-approve  [Admin] ----------
// Body: { bookingIds: [...], adminNote?: string }

exports.bulkApprove = async (req, res) => {
  const { bookingIds, adminNote } = req.body;

  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return res.status(400).json({ message: 'bookingIds must be a non-empty array' });
  }

  try {
    // Only approve bookings that are currently pending
    const result = await Booking.updateMany(
      { _id: { $in: bookingIds }, status: 'pending' },
      {
        $set: {
          status:     'approved',
          approvedBy: req.user.id,
          ...(adminNote ? { adminNote } : {}),
        },
      }
    );

    // Fetch updated bookings to send notifications
    const approved = await Booking.find({
      _id:    { $in: bookingIds },
      status: 'approved',
    }).populate('asset', 'name');

    // Fire notifications in parallel — non-blocking
    await Promise.allSettled(
      approved.map(b =>
        notifyUser(
          b.user,
          {
            title:     'Booking Approved',
            message:   `Your request for "${b.asset?.name || 'asset'}" has been approved.`,
            type:      'approval',
            bookingId: b._id,
          },
          (userName) => templates.bookingApprovedEmail(userName, b.asset?.name || 'asset')
        )
      )
    );

    return res.json({
      message:  `${result.modifiedCount} booking(s) approved.`,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error('bulkApprove error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- POST /bookings/bulk-reject  [Admin] ----------
// Body: { bookingIds: [...], adminNote?: string }

exports.bulkReject = async (req, res) => {
  const { bookingIds, adminNote } = req.body;

  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return res.status(400).json({ message: 'bookingIds must be a non-empty array' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch all pending bookings to be rejected (need quantity info)
    const toReject = await Booking.find({
      _id:    { $in: bookingIds },
      status: 'pending',
    }).session(session);

    if (toReject.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No pending bookings found for the provided IDs' });
    }

    // Group by asset to restore quantities efficiently
    const quantityByAsset = {};
    for (const b of toReject) {
      const key = b.asset.toString();
      quantityByAsset[key] = (quantityByAsset[key] || 0) + b.quantityRequested;
    }

    // Restore available quantities in bulk
    await Promise.all(
      Object.entries(quantityByAsset).map(([assetId, qty]) =>
        Asset.findByIdAndUpdate(
          assetId,
          { $inc: { availableQuantity: qty } },
          { session, new: true }
        ).then(async asset => {
          // Trigger pre-save hook by saving — needed to sync status field
          if (asset) await asset.save({ session });
        })
      )
    );

    // Bulk update status
    await Booking.updateMany(
      { _id: { $in: toReject.map(b => b._id) } },
      {
        $set: {
          status: 'rejected',
          ...(adminNote ? { adminNote } : {}),
        },
      },
      { session }
    );

    await session.commitTransaction();

    // Fetch with asset name for notifications
    const rejected = await Booking.find({
      _id: { $in: toReject.map(b => b._id) },
    }).populate('asset', 'name');

    await Promise.allSettled(
      rejected.map(b =>
        notifyUser(
          b.user,
          {
            title:     'Booking Rejected',
            message:   `Your request for "${b.asset?.name || 'asset'}" was rejected.${adminNote ? ' Note: ' + adminNote : ''}`,
            type:      'rejection',
            bookingId: b._id,
          },
          (userName) => templates.bookingRejectedEmail(userName, b.asset?.name || 'asset', adminNote)
        )
      )
    );

    return res.json({
      message:  `${toReject.length} booking(s) rejected.`,
      modified: toReject.length,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('bulkReject error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};
