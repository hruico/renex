const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['approval', 'rejection', 'due_reminder', 'overdue', 'issued', 'returned'] },
  isRead: { type: Boolean, default: false },
  relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
