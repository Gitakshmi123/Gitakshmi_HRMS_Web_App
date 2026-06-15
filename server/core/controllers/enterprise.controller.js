const bcrypt = require('bcryptjs');

const { getCacheStats } = require('../../database/connectionManager');
const { asyncHandler } = require('../../shared/enterprise.errors');
const { SystemAdmin, Tenant } = require('../models/main.models');
const { loginSystemAdmin, signTenantToken } = require('../../middleware/enterpriseAuth.middleware');
const { provisionCompany } = require('../services/tenantProvisioning.service');
const { writeMainAudit } = require('../services/audit.service');

exports.bootstrapSystemAdmin = asyncHandler(async (req, res) => {
  const count = await SystemAdmin.countDocuments();
  if (count > 0) {
    return res.status(409).json({ success: false, message: 'System admin already exists' });
  }

  const password = String(req.body.password || '');
  if (!req.body.email || !password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'email and password with 8+ characters are required' });
  }

  const admin = await SystemAdmin.create({
    name: req.body.name || 'Super Admin',
    email: String(req.body.email).toLowerCase(),
    password: await bcrypt.hash(password, 12),
    role: 'super_admin'
  });

  res.status(201).json({ success: true, admin: { id: admin._id, email: admin.email, role: admin.role } });
});

exports.loginSystemAdmin = asyncHandler(async (req, res) => {
  const result = await loginSystemAdmin({ email: req.body.email, password: req.body.password });
  if (!result) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  res.json({
    success: true,
    token: result.token,
    admin: { id: result.admin._id, email: result.admin.email, role: result.admin.role }
  });
});

exports.createCompany = asyncHandler(async (req, res) => {
  const result = await provisionCompany({ payload: req.body, createdBy: req.user?.id });
  await writeMainAudit({
    req,
    tenantId: result.tenant._id,
    action: 'tenant.created',
    resource: 'tenant',
    resourceId: result.tenant._id.toString(),
    metadata: { databaseName: result.databaseName }
  });

  res.status(201).json({
    success: true,
    tenant: result.tenant,
    defaultAdmin: {
      id: result.adminUser._id,
      email: result.adminUser.email,
      roleCode: result.adminUser.roleCode
    },
    database: {
      name: result.databaseName,
      isolated: true
    },
    initialApiKey: result.initialApiKey
  });
});

exports.listTenants = asyncHandler(async (_req, res) => {
  const tenants = await Tenant.find({ status: { $ne: 'deleted' } }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, tenants });
});

exports.loginTenant = asyncHandler(async (req, res) => {
  const User = req.tenantDB.model('TenantUser');
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() }).select('+password');
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const ok = await bcrypt.compare(String(req.body.password || ''), user.password);
  if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    success: true,
    token: signTenantToken({ tenant: req.tenant, user }),
    user: { id: user._id, email: user.email, roleCode: user.roleCode },
    tenant: { id: req.tenant._id, slug: req.tenant.slug, databaseName: req.tenant.databaseName }
  });
});

exports.connectionStats = asyncHandler(async (_req, res) => {
  res.json({ success: true, cache: getCacheStats() });
});
