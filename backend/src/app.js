const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---
const authRoutes        = require('./routes/auth.routes');
const assetRoutes       = require('./routes/asset.routes');
const bookingRoutes     = require('./routes/booking.routes');
const analyticsRoutes   = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');
const auditLogRoutes    = require('./routes/auditLogs.routes');
const assetHealthRoutes = require('./routes/assetHealth.routes');

app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/assets',        assetRoutes);
app.use('/api/v1/assets',        assetHealthRoutes);   // /assets/:id/health mounted here
app.use('/api/v1/bookings',      bookingRoutes);
app.use('/api/v1/analytics',     analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/audit-logs',    auditLogRoutes);
app.use('/api/v1/health',        assetHealthRoutes);   // /health snapshots dashboard

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/renex';
const { startOverdueCron }     = require('./cron/overdue.cron');
const { startDueReminderCron } = require('./cron/dueReminder.cron');

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    startOverdueCron();
    startDueReminderCron();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Renex backend running on port ${PORT}`);
});

module.exports = app;
