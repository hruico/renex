const cron = require('node-cron');
const Booking      = require('../models/booking.model');
const Notification = require('../models/notification.model');
const { sendEmail, templates } = require('../utils/email');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

// Runs every day at 9:00 AM
const startOverdueCron = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Running overdue check...');
    try {
      const overdueBookings = await Booking.find({
        status: 'issued',
        'issueDetails.dueDate': { $lt: new Date() },
      })
        .populate('user',  'name email')
        .populate('asset', 'name');

      for (const booking of overdueBookings) {
        booking.status = 'overdue';
        await booking.save();

        await createAuditLog(
          booking.user._id, ACTIONS.BOOKING_OVERDUE, 'booking', booking._id,
          { assetName, dueDate: booking.issueDetails.dueDate }
        );

        const userName  = booking.user?.name  || 'User';
        const userEmail = booking.user?.email;
        const assetName = booking.asset?.name || 'asset';

        await Notification.create({
          user:           booking.user._id,
          title:          'Asset Overdue',
          message:        `Your borrowed "${assetName}" is overdue. Please return it immediately.`,
          type:           'overdue',
          relatedBooking: booking._id,
        });

        if (userEmail) {
          const { subject, html } = templates.overdueEmail(userName, assetName);
          sendEmail({ to: userEmail, subject, html });
        }
      }

      console.log(`[Cron] Marked ${overdueBookings.length} booking(s) as overdue.`);
    } catch (err) {
      console.error('[Cron] Overdue check failed:', err.message);
    }
  });

  console.log('[Cron] Overdue check scheduled at 9:00 AM daily.');
};

module.exports = { startOverdueCron };
