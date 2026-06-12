const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/v1/auth',          require('./routes/auth.routes'));
app.use('/api/v1/assets',        require('./routes/asset.routes'));
app.use('/api/v1/assets',        require('./routes/assetHealth.routes'));
app.use('/api/v1/bookings',      require('./routes/booking.routes'));
app.use('/api/v1/analytics',     require('./routes/analytics.routes'));
app.use('/api/v1/notifications', require('./routes/notification.routes'));
app.use('/api/v1/audit-logs',    require('./routes/auditLogs.routes'));
app.use('/api/v1/health',        require('./routes/assetHealth.routes'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const { startOverdueCron }     = require('./cron/overdue.cron');
const { startDueReminderCron } = require('./cron/dueReminder.cron');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/renex';

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renex backend running on port ${PORT}`));

module.exports = app;
