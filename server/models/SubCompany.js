const mongoose = require('mongoose');

const SubCompanySchema = new mongoose.Schema(
  {
    subCompanyCode: { type: String, required: true, unique: true, trim: true },
    entityCode: { type: String, trim: true, index: true },
    mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    
    adminEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    subCompanyAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    logo: { type: String, default: null },
    
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

SubCompanySchema.index({ mainCompanyId: 1, companyName: 1 });

module.exports = SubCompanySchema;
