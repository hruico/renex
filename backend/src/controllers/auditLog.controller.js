const AuditLog = require('../models/auditLog.model');

// GET /audit-logs
exports.getAuditLogs = async (req, res) => {
  try {
    const { entityType, entityId, performedBy, page = 1, limit = 20 } = req.query;

    const query = {};
    if (entityType)  query.entityType  = entityType;
    if (entityId)    query.entityId    = entityId;
    if (performedBy) query.performedBy = performedBy;

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('performedBy', 'name email')
        .sort({ performedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);

    return res.json({
      logs,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
