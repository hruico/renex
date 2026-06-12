const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    // e.g. ASSET_CREATED, BOOKING_APPROVED, ASSET_RETURNED
    entityType: { type: String, required: true },
    // 'asset' | 'booking' | 'user'
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    // Snapshot of before/after values as a plain object
    performedAt: { type: Date, default: Date.now }
});

auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;