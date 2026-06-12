const AuditLog = require('../models/auditLog.model');

/**
 * createAuditLog — append-only, never throws.
 *
 * @param {string|ObjectId} performedBy  - User ID of the actor
 * @param {string}          action       - Constant e.g. BOOKING_APPROVED
 * @param {string}          entityType   - 'asset' | 'booking' | 'user'
 * @param {string|ObjectId} entityId     - ID of the affected document
 * @param {object}          [metadata]   - Free-form before/after snapshot
 */
async function createAuditLog(performedBy, action, entityType, entityId, metadata = {}) {
  try {
    await AuditLog.create({ performedBy, action, entityType, entityId, metadata });
  } catch (err) {
    // Audit logs are non-critical — log the error but never crash the caller
    console.error('[AuditLog] Failed to write log:', err.message);
  }
}

// ── Action constants ─────────────────────────────────────────────────────────
// Centralised so every call site uses the same string — avoids typos.

const ACTIONS = {
  // Asset
  ASSET_CREATED:  'ASSET_CREATED',
  ASSET_UPDATED:  'ASSET_UPDATED',
  ASSET_DELETED:  'ASSET_DELETED',

  // Booking lifecycle
  BOOKING_CREATED:  'BOOKING_CREATED',
  BOOKING_APPROVED: 'BOOKING_APPROVED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  ASSET_ISSUED:     'ASSET_ISSUED',
  ASSET_RETURNED:   'ASSET_RETURNED',
  BOOKING_OVERDUE:  'BOOKING_OVERDUE',

  // Asset health
  ASSET_HEALTH_REPORTED: 'ASSET_HEALTH_REPORTED',

  // User
  USER_REGISTERED: 'USER_REGISTERED',
  USER_UPDATED:    'USER_UPDATED',
};

module.exports = { createAuditLog, ACTIONS };
