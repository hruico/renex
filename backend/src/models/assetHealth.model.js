const mongoose = require('mongoose');

const assetHealthSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  condition: { type: String, enum: ['excellent', 'good', 'fair', 'damaged', 'under_maintenance'] },
  note: { type: String },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
}, { timestamps: true });

assetHealthSchema.index({ asset: 1, createdAt: -1 });  // per-asset history
assetHealthSchema.index({ condition: 1 });              // filter by condition

const AssetHealth = mongoose.model('AssetHealth', assetHealthSchema);

module.exports = AssetHealth;
