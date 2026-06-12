const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  description: { type: String },
  totalQuantity: { type: Number, required: true, min: 1 },
  availableQuantity: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['available', 'low_stock', 'unavailable'], default: 'available' },
  imageUrl: { type: String },
  qrCode: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-update status based on availableQuantity
assetSchema.pre('save', function () {
  const ratio = this.availableQuantity / this.totalQuantity;
  if (ratio <= 0) this.status = 'unavailable';
  else if (ratio <= 0.2) this.status = 'low_stock';
  else this.status = 'available';
});

assetSchema.index({ category: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ name: 'text', description: 'text' });

const Asset = mongoose.model('Asset', assetSchema);

module.exports = Asset;
