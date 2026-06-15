const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  code: { type: String, trim: true, uppercase: true, required: true },
  departmentCode: { type: String, trim: true, index: true },
  entityCode: { type: String, trim: true, index: true },
  
  mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null, index: true },
  
  budgetedHeadcount: { type: Number, default: 0 },
  currentHeadcount: { type: Number, default: 0 },
  
  headEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  departmentHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  
  description: { type: String, trim: true, maxlength: 250 },
  isDefault: { type: Boolean, default: false },
  meta: { type: Object, default: {} },
}, { timestamps: true });

DepartmentSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, divisionId: 1, name: 1 });
DepartmentSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, divisionId: 1, code: 1 });

module.exports = DepartmentSchema;

