const mongoose = require('mongoose');

const LeavePolicyCustomMappingSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  label: { type: String, trim: true, required: true },
  minLpa: { type: Number, required: true, min: 0 },
  maxLpa: { type: Number, required: true, min: 0 },
  band: { type: String, trim: true, required: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
  gradeName: { type: String, trim: true, default: '' },
  gradeCode: { type: String, trim: true, uppercase: true, default: '' },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

LeavePolicyCustomMappingSchema.index({ tenant: 1, minLpa: 1, maxLpa: 1 });

LeavePolicyCustomMappingSchema.pre('validate', function validateRange(next) {
  if (Number(this.maxLpa) < Number(this.minLpa)) {
    const error = new Error('Max LPA must be greater than or equal to Min LPA');
    error.name = 'ValidationError';
    return next(error);
  }
  return next();
});

module.exports = LeavePolicyCustomMappingSchema;
