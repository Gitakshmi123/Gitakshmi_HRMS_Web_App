const mongoose = require('mongoose');

const PromotionHistorySchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  effectiveDate: { type: Date, required: true, default: Date.now },
  reason: { type: String, trim: true, maxlength: 500, default: '' },
  previous: {
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
    bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', default: null },
    salary: { type: Number, default: 0 },
    payrollTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate', default: null },
  },
  next: {
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
    bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', default: null },
    salary: { type: Number, default: 0 },
    payrollTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate', default: null },
  },
  override: {
    enabled: { type: Boolean, default: false },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
  },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

PromotionHistorySchema.index({ tenant: 1, employeeId: 1, effectiveDate: -1 });

module.exports = PromotionHistorySchema;
