const jwt = require('jsonwebtoken');

const { getTenantConnection } = require('../database/connectionManager');
const { Tenant } = require('../core/models/main.models');
const { registerTenantModels } = require('../tenant/models/tenant.models');
const { getBearerToken } = require('./enterpriseAuth.middleware');

function jwtSecret() {
  return process.env.JWT_SECRET || process.env.SSO_JWT_SECRET || 'hrms_enterprise_dev_secret';
}

function getTenantSlugFromHost(req) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  const rootDomain = String(process.env.APP_ROOT_DOMAIN || '').toLowerCase();
  if (!host || !rootDomain || host === rootDomain || !host.endsWith(`.${rootDomain}`)) return null;
  return host.slice(0, -(rootDomain.length + 1));
}

async function findTenantForRequest(req, payload = {}) {
  const explicitId = req.headers['x-tenant-id'] || payload.tenantId;
  const slug = req.headers['x-tenant-slug'] || payload.tenantSlug || getTenantSlugFromHost(req);
  const domain = req.headers['x-tenant-domain'] || req.hostname;

  if (explicitId) return Tenant.findById(explicitId);
  if (slug) return Tenant.findOne({ slug: String(slug).toLowerCase() });
  if (domain) return Tenant.findOne({ domain: String(domain).toLowerCase() });
  return null;
}

async function tenantResolver(req, res, next) {
  try {
    let payload = null;
    const token = getBearerToken(req);
    if (token) {
      payload = jwt.verify(token, jwtSecret());
    }

    const tenant = await findTenantForRequest(req, payload || {});
    if (!tenant || tenant.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Tenant not found or inactive' });
    }

    if (payload?.scope === 'tenant' && String(payload.tenantId) !== String(tenant._id)) {
      return res.status(403).json({ success: false, message: 'JWT tenant mismatch' });
    }

    const tenantDB = getTenantConnection({ tenantId: tenant._id, databaseName: tenant.databaseName });
    registerTenantModels(tenantDB);

    req.tenant = tenant;
    req.tenantId = tenant._id.toString();
    req.tenantDB = tenantDB;
    req.user = payload || req.user || null;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Tenant validation failed' });
  }
}

module.exports = {
  tenantResolver
};
