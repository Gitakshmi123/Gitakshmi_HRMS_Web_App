const mongoose = require('mongoose');

const { Schema } = mongoose;

const tenantSchema = new Schema({
  companyName: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  legalName: { type: String, trim: true },
  domain: { type: String, trim: true, lowercase: true, sparse: true, index: true },
  databaseName: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['provisioning', 'active', 'suspended', 'deleted'], default: 'provisioning', index: true },
  planCode: { type: String, default: 'enterprise' },
  adminEmail: { type: String, required: true, trim: true, lowercase: true },
  modules: [{ type: String, trim: true }],
  security: {
    requireMfa: { type: Boolean, default: false },
    allowedOrigins: [{ type: String, trim: true }],
    allowedIpCidrs: [{ type: String, trim: true }]
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'EnterpriseSystemAdmin' }
}, { timestamps: true, collection: 'tenants' });

const planSchema = new Schema({
  code: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  modules: [{ type: String }],
  limits: {
    employees: { type: Number, default: 0 },
    storageGb: { type: Number, default: 0 },
    admins: { type: Number, default: 0 }
  },
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: 'plans' });

const subscriptionSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'EnterpriseTenant', required: true, index: true },
  planCode: { type: String, required: true },
  status: { type: String, enum: ['trialing', 'active', 'past_due', 'cancelled'], default: 'trialing' },
  startsAt: { type: Date, default: Date.now },
  renewsAt: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, collection: 'subscriptions' });

const moduleSchema = new Schema({
  key: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  enabledByDefault: { type: Boolean, default: true }
}, { timestamps: true, collection: 'modules' });

const licenseSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'EnterpriseTenant', required: true, index: true },
  seats: { type: Number, default: 0 },
  usedSeats: { type: Number, default: 0 },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date },
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' }
}, { timestamps: true, collection: 'licenses' });

const auditLogSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'EnterpriseTenant', index: true },
  actorId: { type: Schema.Types.ObjectId },
  actorEmail: { type: String, trim: true, lowercase: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, expires: Number(process.env.AUDIT_LOG_RETENTION_SECONDS || 31536000) }
}, { collection: 'audit_logs' });

const systemAdminSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'support_admin', 'billing_admin'], default: 'super_admin' },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date }
}, { timestamps: true, collection: 'system_admins' });

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

module.exports = {
  AuditLog: model('EnterpriseAuditLog', auditLogSchema),
  License: model('EnterpriseLicense', licenseSchema),
  Module: model('EnterpriseModule', moduleSchema),
  Plan: model('EnterprisePlan', planSchema),
  Subscription: model('EnterpriseSubscription', subscriptionSchema),
  SystemAdmin: model('EnterpriseSystemAdmin', systemAdminSchema),
  Tenant: model('EnterpriseTenant', tenantSchema)
};
