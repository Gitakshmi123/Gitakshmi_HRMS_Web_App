const mongoose = require('mongoose');

const DesignationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    code: { type: String, required: true, trim: true },
    designationCode: { type: String, trim: true, index: true },
    entityCode: { type: String, trim: true, index: true },
    
    mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

DesignationSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, divisionId: 1, departmentId: 1, name: 1 });

module.exports = DesignationSchema;
