const mongoose = require('mongoose');

const DivisionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    divisionCode: { type: String, trim: true, index: true },
    entityCode: { type: String, trim: true, index: true },
    
    mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    
    headEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    divisionHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

DivisionSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, name: 1 });

module.exports = DivisionSchema;
