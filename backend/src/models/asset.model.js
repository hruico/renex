const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name:              { type: String, required: true, trim: true },
  category:          { type: String, required: true },
  description:       { type: String },
  totalQuantity:     { type: Number, required: true, min: 1 },
  availableQuantity: { type: Number, required: true, min: 0 },
  status:            { type: String, enum: ['available', 'low_stock', 'unavailable'], default: 'available' },
  imageUrl:          { type: String },
  qrCode:            { type: String },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted:         { type: Boolean, default: false },
}, { timestamps: true });

assetSchema.pre('save', function () {
  const ratio = this.availableQuantity / this.totalQuantity;
  if (ratio <= 0)        this.status = 'unavailable';
  else if (ratio <= 0.2) this.status = 'low_stock';
  else                   this.status = 'available';
});

assetSchema.index({ name: 'text', category: 'text', description: 'text' });
assetSchema.index({ category: 1, status: 1 });
assetSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Asset', assetSchema);
