const mongoose = require('mongoose');
const { z } = require('zod');
const Booking  = require('../models/booking.model');
const Asset    = require('../models/asset.model');
const Notification = require('../models/notification.model');
const User     = require('../models/user.model');
const { sendEmail, templates } = require('../utils/email');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

const createBookingSchema = z.object({
  assetId:           z.string().min(1),
  quantityRequested: z.number({ coerce: true }).int().min(1),
  purpose:           z.string().min(3),
  startDate:         z.union([z.string(), z.date()]).transform(v => new Date(v)),
  endDate:           z.union([z.string(), z.date()]).transform(v => new Date(v)),
});

async function createNotification(userId, title, message, type, bookingId) {
  try {
    await Notification.create({ user: userId, title, message, type, relatedBooking: bookingId });
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
}

async function notifyUser(userId, inApp, emailTemplate) {
  await createNotification(userId, inApp.title, inApp.message, inApp.type, inApp.bookingId);
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

exports.getAllBookings = async (req, res) => {
  try {
    const { status, category, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const baseMatch = {};
    if (status) baseMatch.status = status;
    if (userId) baseMatch.user   = new mongoose.Types.ObjectId(userId);
    if (startDate || endDate) {
      baseMatch.startDate = {};
      if (startDate) baseMatch.startDate.$gte = new Date(startDate);
      if (endDate)   baseMatch.startDate.$lte = new Date(endDate);
    }

    const matchStage = { ...baseMatch };
    if (category) matchStage['asset.category'] = category;

    const pipeline = [
      { $lookup: { from: 'assets', localField: 'asset', foreignField: '_id', as: 'asset' } },
      { $unwind: '$asset' },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          bookings: [
            { $skip: skip },
            { $limit: Number(limit) },
            { $project: {
              status: 1, quantityRequested: 1, purpose: 1,
              startDate: 1, endDate: 1, adminNote: 1, createdAt: 1,
              'user._id': 1, 'user.name': 1, 'user.email': 1,
              'asset._id': 1, 'asset.name': 1, 'asset.category': 1, 'asset.imageUrl': 1,
            }},
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Booking.aggregate(pipeline);
    const total    = result.totalCount[0]?.count ?? 0;

    return res.json({ bookings: result.bookings, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    console.error('getAllBookings error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { user: req.user.id };
    if (status) query.status = status;
    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query).populate('asset', 'name category imageUrl').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Booking.countDocuments(query),
    ]);

    return res.json({ bookings, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    console.error('getMyBookings error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user',       'name email')
      .populate('asset',      'name category imageUrl')
      .populate('approvedBy', 'name email')
      .populate('issueDetails.issuedBy',    'name email')
      .populate('returnDetails.receivedBy', 'name email');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (req.user.role !== 'admin' && booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({ booking });
  } catch (err) {
    console.error('getBookingById error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createBooking = async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });

  const { assetId, quantityRequested, purpose, startDate, endDate } = parsed.data;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (startDate < now) return res.status(400).json({ message: 'Start date must be today or in the future' });
  if (endDate <= startDate) return res.status(400).json({ message: 'End date must be after start date' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const asset = await Asset.findOne({ _id: assetId, isDeleted: false }).session(session);
    if (!asset) { await session.abortTransaction(); return res.status(404).json({ message: 'Asset not found' }); }

    if (asset.availableQuantity < quantityRequested) {
      await session.abortTransaction();
      return res.status(400).json({ message: `Insufficient quantity. Only ${asset.availableQuantity} unit(s) available.` });
    }

    const [booking] = await Booking.create([{ user: req.user.id, asset: assetId, quantityRequested, purpose, startDate, endDate, status: 'pending' }], { session });

    asset.availableQuantity -= quantityRequested;
    await asset.save({ session });
    await session.commitTransaction();

    await createAuditLog(req.user.id, ACTIONS.BOOKING_CREATED, 'booking', booking._id, { assetId, quantityRequested, purpose, startDate, endDate });
    await notifyUser(req.user.id,
      { title: 'Booking Request Submitted', message: `Your request for "${asset.name}" (x${quantityRequested}) has been submitted and is pending approval.`, type: 'approval', bookingId: booking._id },
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

exports.approveBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('asset', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'pending') return res.status(400).json({ message: `Cannot approve a booking with status "${booking.status}"` });

    const adminNote = req.body?.adminNote;
    booking.status = 'approved'; booking.approvedBy = req.user.id;
    if (adminNote) booking.adminNote = adminNote;
    await booking.save();

    await createAuditLog(req.user.id, ACTIONS.BOOKING_APPROVED, 'booking', booking._id, { assetName: booking.asset.name, adminNote });
    await notifyUser(booking.user,
      { title: 'Booking Approved', message: `Your request for "${booking.asset.name}" has been approved.`, type: 'approval', bookingId: booking._id },
      (userName) => templates.bookingApprovedEmail(userName, booking.asset.name)
    );

    return res.json({ message: 'Booking approved', booking });
  } catch (err) {
    console.error('approveBooking error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.rejectBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session).populate('asset', 'name');
    if (!booking) { await session.abortTransaction(); return res.status(404).json({ message: 'Booking not found' }); }
    if (booking.status !== 'pending') { await session.abortTransaction(); return res.status(400).json({ message: `Cannot reject a booking with status "${booking.status}"` }); }

    const asset = await Asset.findById(booking.asset._id).session(session);
    if (asset) { asset.availableQuantity += booking.quantityRequested; await asset.save({ session }); }

    const adminNote = req.body?.adminNote;
    booking.status = 'rejected';
    if (adminNote) booking.adminNote = adminNote;
    await booking.save({ session });
    await session.commitTransaction();

    await createAuditLog(req.user.id, ACTIONS.BOOKING_REJECTED, 'booking', booking._id, { assetName: booking.asset.name, adminNote });
    await notifyUser(booking.user,
      { title: 'Booking Rejected', message: `Your request for "${booking.asset.name}" was rejected.${adminNote ? ' Note: ' + adminNote : ''}`, type: 'rejection', bookingId: booking._id },
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

exports.issueAsset = async (req, res) => {
  try {
    const { conditionAtIssue, dueDate } = req.body ?? {};
    const booking = await Booking.findById(req.params.id).populate('asset', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'approved') return res.status(400).json({ message: 'Asset can only be issued for approved bookings' });

    booking.status       = 'issued';
    booking.issueDetails = { issuedBy: req.user.id, issuedAt: new Date(), dueDate: dueDate ? new Date(dueDate) : booking.endDate, conditionAtIssue: conditionAtIssue || 'good' };
    await booking.save();

    await createAuditLog(req.user.id, ACTIONS.ASSET_ISSUED, 'booking', booking._id, { assetName: booking.asset.name, dueDate: booking.issueDetails.dueDate });
    await notifyUser(booking.user,
      { title: 'Asset Issued', message: `"${booking.asset.name}" has been issued to you. Please return by ${booking.issueDetails.dueDate.toDateString()}.`, type: 'issued', bookingId: booking._id },
      (userName) => templates.assetIssuedEmail(userName, booking.asset.name, booking.issueDetails.dueDate)
    );

    return res.json({ message: 'Asset issued successfully', booking });
  } catch (err) {
    console.error('issueAsset error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.recordReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { conditionAtReturn, damageNotes } = req.body ?? {};
    const booking = await Booking.findById(req.params.id).session(session).populate('asset', 'name');
    if (!booking) { await session.abortTransaction(); return res.status(404).json({ message: 'Booking not found' }); }
    if (!['issued', 'overdue'].includes(booking.status)) { await session.abortTransaction(); return res.status(400).json({ message: 'Return can only be recorded for issued or overdue bookings' }); }

    const asset = await Asset.findById(booking.asset._id).session(session);
    if (asset) { asset.availableQuantity += booking.quantityRequested; await asset.save({ session }); }

    booking.status        = 'returned';
    booking.returnDetails = { receivedBy: req.user.id, returnedAt: new Date(), conditionAtReturn: conditionAtReturn || 'good', damageNotes };
    await booking.save({ session });
    await session.commitTransaction();

    await createAuditLog(req.user.id, ACTIONS.ASSET_RETURNED, 'booking', booking._id, { assetName: booking.asset.name, conditionAtReturn, damageNotes });
    await notifyUser(booking.user,
      { title: 'Asset Returned', message: `"${booking.asset.name}" has been successfully returned. Thank you!`, type: 'returned', bookingId: booking._id },
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

exports.bulkApprove = async (req, res) => {
  const { bookingIds, adminNote } = req.body;
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) return res.status(400).json({ message: 'bookingIds must be a non-empty array' });

  try {
    const result = await Booking.updateMany(
      { _id: { $in: bookingIds }, status: 'pending' },
      { $set: { status: 'approved', approvedBy: req.user.id, ...(adminNote ? { adminNote } : {}) } }
    );

    const approved = await Booking.find({ _id: { $in: bookingIds }, status: 'approved' }).populate('asset', 'name');
    await Promise.allSettled(approved.map(b =>
      notifyUser(b.user,
        { title: 'Booking Approved', message: `Your request for "${b.asset?.name}" has been approved.`, type: 'approval', bookingId: b._id },
        (userName) => templates.bookingApprovedEmail(userName, b.asset?.name)
      )
    ));

    return res.json({ message: `${result.modifiedCount} booking(s) approved.`, modified: result.modifiedCount });
  } catch (err) {
    console.error('bulkApprove error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.bulkReject = async (req, res) => {
  const { bookingIds, adminNote } = req.body;
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) return res.status(400).json({ message: 'bookingIds must be a non-empty array' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const toReject = await Booking.find({ _id: { $in: bookingIds }, status: 'pending' }).session(session);
    if (toReject.length === 0) { await session.abortTransaction(); return res.status(400).json({ message: 'No pending bookings found' }); }

    const quantityByAsset = {};
    for (const b of toReject) {
      const key = b.asset.toString();
      quantityByAsset[key] = (quantityByAsset[key] || 0) + b.quantityRequested;
    }

    await Promise.all(Object.entries(quantityByAsset).map(([assetId, qty]) =>
      Asset.findByIdAndUpdate(assetId, { $inc: { availableQuantity: qty } }, { session, new: true })
        .then(async a => { if (a) await a.save({ session }); })
    ));

    await Booking.updateMany(
      { _id: { $in: toReject.map(b => b._id) } },
      { $set: { status: 'rejected', ...(adminNote ? { adminNote } : {}) } },
      { session }
    );
    await session.commitTransaction();

    const rejected = await Booking.find({ _id: { $in: toReject.map(b => b._id) } }).populate('asset', 'name');
    await Promise.allSettled(rejected.map(b =>
      notifyUser(b.user,
        { title: 'Booking Rejected', message: `Your request for "${b.asset?.name}" was rejected.${adminNote ? ' Note: ' + adminNote : ''}`, type: 'rejection', bookingId: b._id },
        (userName) => templates.bookingRejectedEmail(userName, b.asset?.name, adminNote)
      )
    ));

    return res.json({ message: `${toReject.length} booking(s) rejected.`, modified: toReject.length });
  } catch (err) {
    await session.abortTransaction();
    console.error('bulkReject error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};
