const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { SystemAdmin } = require('../core/models/main.models');

function jwtSecret() {
  return process.env.JWT_SECRET || process.env.SSO_JWT_SECRET || 'hrms_enterprise_dev_secret';
}

function signSystemToken(admin) {
  return jwt.sign({
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role,
    scope: 'system'
  }, jwtSecret(), { expiresIn: process.env.SYSTEM_JWT_TTL || '8h' });
}

function signTenantToken({ tenant, user }) {
  return jwt.sign({
    id: user._id.toString(),
    email: user.email,
    roleCode: user.roleCode,
    tenantId: tenant._id.toString(),
    tenantSlug: tenant.slug,
    databaseName: tenant.databaseName,
    scope: 'tenant'
  }, jwtSecret(), { expiresIn: process.env.TENANT_JWT_TTL || '8h' });
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = String(header).split(' ');
  return /^Bearer$/i.test(scheme) ? token : null;
}

function requireSystemAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Missing bearer token' });
    const payload = jwt.verify(token, jwtSecret());
    if (payload.scope !== 'system' || payload.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin token required' });
    }
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

async function loginSystemAdmin({ email, password }) {
  const admin = await SystemAdmin.findOne({ email: String(email || '').toLowerCase(), active: true }).select('+password');
  if (!admin) return null;

  const ok = await bcrypt.compare(String(password || ''), admin.password);
  if (!ok) return null;

  admin.lastLoginAt = new Date();
  await admin.save();
  return {
    admin,
    token: signSystemToken(admin)
  };
}

module.exports = {
  getBearerToken,
  loginSystemAdmin,
  requireSystemAuth,
  signSystemToken,
  signTenantToken
};
