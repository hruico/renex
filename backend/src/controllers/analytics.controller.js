const Booking = require('../models/booking.model');
const Asset   = require('../models/asset.model');

// Helper — builds a { $gte, $lte } date range from query params.
// Falls back to `defaultDays` if neither startDate nor endDate is provided.
function buildDateRange(query, defaultDays = 30) {
  if (query.startDate || query.endDate) {
    const range = {};
    if (query.startDate) range.$gte = new Date(query.startDate);
    if (query.endDate)   range.$lte = new Date(query.endDate);
    return range;
  }
  const since = new Date();
  since.setDate(since.getDate() - defaultDays);
  return { $gte: since };
}

// ---------- GET /analytics/summary ----------
// Summary cards: total assets, active bookings, available units, overdue count
exports.getSummary = async (req, res) => {
  try {
    const [
      totalAssets,
      activeBookings,
      overdueCount,
      availableAgg,
      pendingCount,
    ] = await Promise.all([
      Asset.countDocuments({ isDeleted: false }),
      Booking.countDocuments({ status: { $in: ['approved', 'issued'] } }),
      Booking.countDocuments({ status: 'overdue' }),
      Asset.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, total: { $sum: '$availableQuantity' } } },
      ]),
      Booking.countDocuments({ status: 'pending' }),
    ]);

    return res.json({
      totalAssets,
      activeBookings,
      overdueCount,
      pendingCount,
      totalAvailableUnits: availableAgg[0]?.total ?? 0,
    });
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /analytics/utilization ----------
// Line chart: booking volume per day over a date range
// Query params: startDate?, endDate?  (defaults to last 30 days)
exports.getUtilization = async (req, res) => {
  try {
    const createdAt = buildDateRange(req.query, 30);

    const data = await Booking.aggregate([
      { $match: { createdAt } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]);

    return res.json({ utilization: data });
  } catch (err) {
    console.error('getUtilization error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /analytics/popular ----------
// Bar chart: top 10 most booked assets
// Query params: startDate?, endDate?
exports.getPopularAssets = async (req, res) => {
  try {
    const matchStage = {};
    if (req.query.startDate || req.query.endDate) {
      matchStage.createdAt = buildDateRange(req.query);
    }

    const pipeline = [
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      { $group: { _id: '$asset', count: { $sum: 1 } } },
      { $sort:  { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from:         'assets',
          localField:   '_id',
          foreignField: '_id',
          as:           'asset',
        },
      },
      { $unwind: '$asset' },
      {
        $project: {
          _id:              0,
          count:            1,
          'asset._id':      1,
          'asset.name':     1,
          'asset.category': 1,
          'asset.imageUrl': 1,
        },
      },
    ];

    const data = await Booking.aggregate(pipeline);
    return res.json({ popular: data });
  } catch (err) {
    console.error('getPopularAssets error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /analytics/status-distribution ----------
// Pie chart: count of bookings grouped by status
// Query params: startDate?, endDate?
exports.getStatusDistribution = async (req, res) => {
  try {
    const matchStage = {};
    if (req.query.startDate || req.query.endDate) {
      matchStage.createdAt = buildDateRange(req.query);
    }

    const pipeline = [
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id:   '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ];

    const data = await Booking.aggregate(pipeline);
    return res.json({ distribution: data });
  } catch (err) {
    console.error('getStatusDistribution error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /analytics/category-utilization ----------
// Bar chart: utilization rate per asset category
// Utilization = (totalQuantity - availableQuantity) / totalQuantity * 100
// Query params: startDate?, endDate?
exports.getCategoryUtilization = async (req, res) => {
  try {
    // Build booking counts per category within optional date range
    const matchStage = {};
    if (req.query.startDate || req.query.endDate) {
      matchStage.createdAt = buildDateRange(req.query);
    }

    // Aggregate: join asset to get category, then count bookings per category
    const bookingsByCategory = await Booking.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $lookup: {
          from:         'assets',
          localField:   'asset',
          foreignField: '_id',
          as:           'assetDoc',
        },
      },
      { $unwind: '$assetDoc' },
      {
        $group: {
          _id:            '$assetDoc.category',
          bookingCount:   { $sum: 1 },
          totalRequested: { $sum: '$quantityRequested' },
        },
      },
      { $sort: { bookingCount: -1 } },
    ]);

    // Also get inventory totals per category for utilization rate
    const inventoryByCategory = await Asset.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id:            '$category',
          totalQuantity:  { $sum: '$totalQuantity' },
          totalAvailable: { $sum: '$availableQuantity' },
        },
      },
    ]);

    // Merge the two result sets by category
    const inventoryMap = {};
    for (const row of inventoryByCategory) {
      inventoryMap[row._id] = row;
    }

    const result = bookingsByCategory.map(row => {
      const inv = inventoryMap[row._id] || { totalQuantity: 0, totalAvailable: 0 };
      const issued    = inv.totalQuantity - inv.totalAvailable;
      const utilRate  = inv.totalQuantity > 0
        ? Math.round((issued / inv.totalQuantity) * 100)
        : 0;

      return {
        category:       row._id,
        bookingCount:   row.bookingCount,
        totalRequested: row.totalRequested,
        totalQuantity:  inv.totalQuantity,
        totalAvailable: inv.totalAvailable,
        utilizationRate: utilRate,   // percentage
      };
    });

    return res.json({ categoryUtilization: result });
  } catch (err) {
    console.error('getCategoryUtilization error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ---------- GET /analytics/overdue ----------
// Paginated list of currently overdue bookings
exports.getOverdueBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find({ status: 'overdue' })
        .populate('user',  'name email')
        .populate('asset', 'name category')
        .sort({ 'issueDetails.dueDate': 1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments({ status: 'overdue' }),
    ]);

    return res.json({
      bookings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getOverdueBookings error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
