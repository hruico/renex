const nodemailer = require('nodemailer');

// Lazy-initialised transporter — created once on first use
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // If SMTP credentials are not configured, fall back to Ethereal (dev preview)
  // Ethereal credentials are generated per-run; no real email is sent.
  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Email] SMTP not configured. Emails will be silently skipped in production. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
    }
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

/**
 * Send an email fire-and-forget style — never throws, never blocks.
 * @param {object} opts  - { to, subject, html, text? }
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) return; // silently skip if not configured

  const from = process.env.SMTP_FROM || `"Renex" <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({ from, to, subject, text, html });
  } catch (err) {
    // Email is non-critical — log but never crash the main flow
    console.error('[Email] Failed to send to', to, '—', err.message);
  }
}

// ── Pre-built email templates ─────────────────────────────────────────────────

function bookingSubmittedEmail(userName, assetName, quantity) {
  return {
    subject: 'Booking Request Submitted — Renex',
    html: `<p>Hi ${userName},</p>
           <p>Your booking request for <strong>${assetName}</strong> (×${quantity}) has been submitted and is pending admin approval.</p>
           <p>You will be notified once a decision is made.</p>
           <p>— Renex Team</p>`,
  };
}

function bookingApprovedEmail(userName, assetName) {
  return {
    subject: 'Booking Approved — Renex',
    html: `<p>Hi ${userName},</p>
           <p>Your booking request for <strong>${assetName}</strong> has been <strong style="color:green">approved</strong>.</p>
           <p>Please collect the asset at the designated location.</p>
           <p>— Renex Team</p>`,
  };
}

function bookingRejectedEmail(userName, assetName, adminNote) {
  return {
    subject: 'Booking Rejected — Renex',
    html: `<p>Hi ${userName},</p>
           <p>Your booking request for <strong>${assetName}</strong> has been <strong style="color:red">rejected</strong>.</p>
           ${adminNote ? `<p>Reason: ${adminNote}</p>` : ''}
           <p>— Renex Team</p>`,
  };
}

function assetIssuedEmail(userName, assetName, dueDate) {
  return {
    subject: 'Asset Issued — Renex',
    html: `<p>Hi ${userName},</p>
           <p><strong>${assetName}</strong> has been issued to you.</p>
           <p>Please return it by <strong>${new Date(dueDate).toDateString()}</strong>.</p>
           <p>— Renex Team</p>`,
  };
}

function assetReturnedEmail(userName, assetName) {
  return {
    subject: 'Asset Returned — Renex',
    html: `<p>Hi ${userName},</p>
           <p>We have recorded the return of <strong>${assetName}</strong>. Thank you!</p>
           <p>— Renex Team</p>`,
  };
}

function dueReminderEmail(userName, assetName, dueDate) {
  return {
    subject: 'Return Reminder — Renex',
    html: `<p>Hi ${userName},</p>
           <p>This is a reminder that <strong>${assetName}</strong> is due for return tomorrow (<strong>${new Date(dueDate).toDateString()}</strong>).</p>
           <p>Please return it on time to avoid being marked overdue.</p>
           <p>— Renex Team</p>`,
  };
}

function overdueEmail(userName, assetName) {
  return {
    subject: 'Asset Overdue — Renex',
    html: `<p>Hi ${userName},</p>
           <p><strong style="color:red">Your borrowed asset <em>${assetName}</em> is overdue.</strong></p>
           <p>Please return it immediately.</p>
           <p>— Renex Team</p>`,
  };
}

module.exports = {
  sendEmail,
  templates: {
    bookingSubmittedEmail,
    bookingApprovedEmail,
    bookingRejectedEmail,
    assetIssuedEmail,
    assetReturnedEmail,
    dueReminderEmail,
    overdueEmail,
  },
};
