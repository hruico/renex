const cron = require('node-cron');
const Booking      = require('../models/booking.model');
const Notification = require('../models/notification.model');
const { sendEmail, templates } = require('../utils/email');

// Runs every day at 8:00 AM — one hour before the overdue cron
const startDueReminderCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Running due-tomorrow reminder check...');
    try {
      // Build a window for "tomorrow" — midnight to midnight
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const dueTomorrow = await Booking.find({
        status: 'issued',
        'issueDetails.dueDate': { $gte: tomorrow, $lt: dayAfter },
      })
        .populate('user',  'name email')
        .populate('asset', 'name');

      for (const booking of dueTomorrow) {
        const userName  = booking.user?.name  || 'User';
        const userEmail = booking.user?.email;
        const assetName = booking.asset?.name || 'asset';
        const dueDate   = booking.issueDetails.dueDate;

        // In-app notification
        await Notification.create({
          user:           booking.user._id,
          title:          'Return Reminder',
          message:        `"${assetName}" is due for return tomorrow (${new Date(dueDate).toDateString()}).`,
          type:           'due_reminder',
          relatedBooking: booking._id,
        });

        // Email notification (fire-and-forget)
        if (userEmail) {
          const { subject, html } = templates.dueReminderEmail(userName, assetName, dueDate);
          sendEmail({ to: userEmail, subject, html });
        }
      }

      console.log(`[Cron] Sent due reminders for ${dueTomorrow.length} booking(s).`);
    } catch (err) {
      console.error('[Cron] Due reminder check failed:', err.message);
    }
  });

  console.log('[Cron] Due reminder scheduled at 8:00 AM daily.');
};

module.exports = { startDueReminderCron };
