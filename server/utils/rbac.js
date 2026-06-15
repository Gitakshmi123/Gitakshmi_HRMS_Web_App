const mongoose = require('mongoose');
const cache = require('./permissionCache');
const { sanitizePermissions } = require('./defaultRolePermissions');

function normalizeRole(role) {
  const normalizeAlias = (r) => {
    const compact = String(r || '').replace(/[\s-]+/g, '_');
    const aliases = {
      superadmin: 'super_admin',
      super_admin: 'super_admin',
      companyadmin: 'company_admin',
      company_admin: 'company_admin',
      companysuperadmin: 'company_super_admin',
      company_superadmin: 'company_super_admin',
      company_super_admin: 'company_super_admin',
      companyadminsuper: 'company_super_admin',
      hradmin: 'hr_admin',
      hr_admin: 'hr_admin',
      hrmanager: 'hr_manager',
      hr_manager: 'hr_manager'
    };
    return aliases[compact] || compact;
  };
  if (role && typeof role === 'object') {
    return normalizeAlias(String(role.name || '').trim().toLowerCase());
  }
  return normalizeAlias(String(role || '').trim().toLowerCase());
}

function buildCachePayload({ permissions = [], role = '', permVersion = 0 } = {}) {
  return {
    exists: true,
    data: {
      permissions: sanitizePermissions(permissions),
      role: normalizeRole(role),
      permVersion: Number(permVersion || 0),
    },
  };
}

async function resolveUserPermissionBundle({ userId, tenantId, tenantDB, email = null }) {
  if (!tenantId) return null;

  const cacheKey = String(userId || email || 'anonymous');
  const cached = cache.get(tenantId, cacheKey);
  if (cached?.data) {
    return {
      permissions: sanitizePermissions(cached.data.permissions || []),
      role: normalizeRole(cached.data.role),
      permVersion: Number(cached.data.permVersion || 0),
      fromCache: true,
      userDoc: cached.data.userDoc,
    };
  }

  const { getDefaultPerms } = require('./defaultRolePermissions');
  const User = mongoose.model('User');
  let userDoc = null;

  // 1. Try lookup by ID
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    userDoc = await User.findById(userId)
      .select('_id permissions role email permVersion')
      .lean();
  }

  // 2. Try lookup by email (very common for SSO handshakes where IDs differ)
  if (!userDoc && email) {
    const safeEmail = String(email).trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    userDoc = await User.findOne({
      email: { $regex: new RegExp(`^${safeEmail}$`, 'i') },
      mainCompanyId: tenantId,
    })
      .select('_id permissions role email permVersion')
      .lean();
  }

  // 3. Try lookup in tenant-specific Employee collection if still not found
  if (!userDoc && tenantDB && (userId || email)) {
    try {
      const Employee = tenantDB.model('Employee');
      let employee = null;
      
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        employee = await Employee.findById(userId).select('email role').lean();
      }
      
      if (!employee && email) {
        const safeEmail = String(email).trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        employee = await Employee.findOne({
          email: { $regex: new RegExp(`^${safeEmail}$`, 'i') }
        }).select('email role').lean();
      }

      if (employee?.email) {
        const safeEmail = employee.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        userDoc = await User.findOne({
          email: { $regex: new RegExp(`^${safeEmail}$`, 'i') },
          mainCompanyId: tenantId,
        })
          .select('_id permissions role email permVersion')
          .lean();
        
        if (!userDoc) { 
          userDoc = { role: employee.role || 'employee', permissions: [] }; 
        }
      }
    } catch (_) { /* ignore */ }
  }

  const rawRole = userDoc?.role || 'employee';
  const role = normalizeRole(rawRole);
  const hasExplicitPermissions = Array.isArray(userDoc?.permissions) && userDoc.permissions.length > 0;
  const rawPermissions = hasExplicitPermissions
    ? [...userDoc.permissions]
    : getDefaultPerms(role);

  const bundle = {
    permissions: sanitizePermissions(rawPermissions),
    role: role,
    permVersion: Math.max(Number(userDoc?.permVersion || 0), 20),
    userDoc: userDoc,
    fromCache: false,
  };

  if (userDoc && userDoc._id) {
    const payload = buildCachePayload(bundle);
    payload.data.userDoc = userDoc;
    cache.set(tenantId, String(userId), payload);
    cache.set(tenantId, String(userDoc._id), payload);
    if (userDoc.email) cache.set(tenantId, userDoc.email.toLowerCase(), payload);
  }

  return bundle;
}


module.exports = {
  normalizeRole,
  buildCachePayload,
  resolveUserPermissionBundle,
};
