const mongoose = require('mongoose');

const DesignationGradeMapSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
  allowedBandIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Band' }],
  status: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

DesignationGradeMapSchema.index(
  { tenant: 1, designationId: 1, departmentId: 1 },
  { unique: true }
);

module.exports = DesignationGradeMapSchema;
