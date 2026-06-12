const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  quantityRequested: { type: Number, required: true, min: 1 },
  purpose: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'issued', 'returned', 'overdue'],
    default: 'pending'
  },
  adminNote: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Embedded issue record — populated when admin issues the asset
  issueDetails: {
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issuedAt: { type: Date },
    dueDate: { type: Date },
    conditionAtIssue: { type: String }
  },

  // Embedded return record — populated when asset is returned
  returnDetails: {
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    returnedAt: { type: Date },
    conditionAtReturn: { type: String },
    damageNotes: { type: String }
  }
}, { timestamps: true });

bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ asset: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ createdAt: 1 });                      // analytics date-range scans
bookingSchema.index({ 'issueDetails.dueDate': 1, status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
