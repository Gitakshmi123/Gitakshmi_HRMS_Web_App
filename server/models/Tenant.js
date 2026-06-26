const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  companyEmail: { type: String, required: true, unique: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  password: { type: String, required: true }, // Should be hashed in controller
  logo: { type: String, default: null },
  adminEmail: { type: String, trim: true },
  adminName: { type: String, trim: true },
  adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  parentCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  subCompanyLimit: { type: Number, default: 0, min: 0 },
  userLimit: { type: Number, default: 0, min: 0 },

  // Multi-tenant Identifiers
  tenantId: { type: String, required: true, unique: true, index: true },
  apiKey: { type: String, required: true, unique: true },

  name: { type: String, trim: true }, // Keep for compatibility if needed
  code: { type: String, trim: true, index: true, unique: true, sparse: true },
  emailDomain: { type: String, default: null },
  plan: { type: String, default: 'free' },
  status: { type: String, enum: ['pending', 'active', 'suspended', 'deleted'], default: 'active' },
  enabledModules: {
    hr: { type: Boolean, default: false },
    payroll: { type: Boolean, default: false },
    attendance: { type: Boolean, default: false },
    leave: { type: Boolean, default: false },
    recruitment: { type: Boolean, default: false },
    backgroundVerification: { type: Boolean, default: false },
    documentManagement: { type: Boolean, default: false },
    socialMediaIntegration: { type: Boolean, default: false },
    onboarding: { type: Boolean, default: false },
    employeePortal: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    policy: { type: Boolean, default: false },
    customStudio: { type: Boolean, default: false },
    accessControl: { type: Boolean, default: false }
  },
  organizationId: { type: String, trim: true },
  databaseName: { type: String, trim: true },
  companyCode: { type: String, trim: true },
  dmsTenantCode: { type: String, trim: true, default: null }, // Mapping code for DMS Integration
  dmsCompanyId: { type: String, trim: true, default: null },  // DMS Company _id linked to this HRMS tenant

  modules: { type: [String], default: [] },
  productEmployeeLimits: { type: mongoose.Schema.Types.Mixed, default: {} },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  smtpConfig: {
    host: { type: String, trim: true },
    port: { type: Number },
    secure: { type: Boolean, default: false },
    user: { type: String, trim: true },
    pass: { type: String },
    fromEmail: { type: String, trim: true },
    fromName: { type: String, trim: true }
  }
}, { timestamps: true, collection: 'companies' });

module.exports = mongoose.model('Tenant', TenantSchema);
