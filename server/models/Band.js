const mongoose = require('mongoose');

const BandSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  minSalary: { type: Number, required: true, min: 0 },
  maxSalary: { type: Number, required: true, min: 0 },
  payrollTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate', default: null, index: true },
  bonusPercentage: { type: Number, min: 0, max: 100, default: 0 },
  country: { type: String, trim: true, uppercase: true, default: 'IN', index: true },
  currency: { type: String, trim: true, uppercase: true, default: 'INR' },
  status: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

BandSchema.index({ tenant: 1, code: 1 }, { unique: true });
BandSchema.index({ tenant: 1, minSalary: 1, maxSalary: 1, status: 1 });

BandSchema.pre('validate', function validateBand(next) {
  if (this.code) this.code = String(this.code).trim().toUpperCase();
  if (this.name) this.name = String(this.name).trim();
  if (Number(this.maxSalary) < Number(this.minSalary)) {
    return next(new Error('Band maxSalary cannot be less than minSalary'));
  }
  next();
});

module.exports = BandSchema;
