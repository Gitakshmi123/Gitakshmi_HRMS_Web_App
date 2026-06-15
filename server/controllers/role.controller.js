const mongoose = require('mongoose');
const cache     = require('../utils/permissionCache');
const { getDefaultPerms, DEFAULT_ROLE_PERMS, sanitizePermissions } = require('../utils/defaultRolePermissions');

/* ── Helpers ────────────────────────────────────────────────── */

/** Build a diff summary string for audit log */
function buildDiffSummary(before = [], after = []) {
  const bMap = {};
  (before || []).forEach(p => {
    const on = Object.entries(p.actions || {}).filter(([, v]) => v === true).map(([k]) => k);
    if (on.length) bMap[p.module] = new Set(on);
  });

  const changes = [];
  (after || []).forEach(p => {
    const on = Object.entries(p.actions || {}).filter(([, v]) => v === true).map(([k]) => k);
    const was = bMap[p.module] ? [...bMap[p.module]] : [];
    const enabled  = on.filter(a => !bMap[p.module]?.has(a));
    const disabled = was.filter(a => !on.includes(a));
    if (enabled.length)  changes.push(`+${p.module}[${enabled.join(',')}]`);
    if (disabled.length) changes.push(`-${p.module}[${disabled.join(',')}]`);
  });
  return changes.slice(0, 20).join(' | ') || 'No change';
}

/** Find User by ID or by employee-email fallback */
async function resolveUser(userId, tenantId, tenantDB) {
  const User = mongoose.model('User');

  if (mongoose.Types.ObjectId.isValid(userId)) {
    const u = await User.findById(userId).lean();
    if (u) return u;
  }

  // Employee ID fallback: look up email in tenant DB → find User by email
  if (tenantDB && mongoose.Types.ObjectId.isValid(userId)) {
    try {
      const Employee = tenantDB.model('Employee');
      const emp = await Employee.findById(userId).select('email').lean();
      if (emp?.email) {
        const emailQ = emp.email.toLowerCase().trim();
        return await User.findOne({
          email:  { $regex: new RegExp(`^${emailQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          mainCompanyId: tenantId
        }).lean();
      }
    } catch (_) {}
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   GET /roles/user/:userId — Fetch user's current permissions
═══════════════════════════════════════════════════════════════ */
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId }  = req.params;
    const tenantId    = req.user?.tenantId || req.tenantId;

    if (!tenantId) {
      console.warn('[RBAC] getUserPermissions: No tenantId found in request.');
      return res.status(400).json({ success: false, message: 'Tenant context missing.' });
    }

    // Try cache first (keyed by tenantId:userId)
    const cached = cache.get(tenantId, userId);
    if (cached) {
      return res.json({ success: true, ...cached, cached: true });
    }

    const User = mongoose.model('User');
    let user = null;

    // 1. Primary lookup by User ID
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).select('_id name email role permissions permVersion permUpdatedAt').lean();
    }

    // 2. Secondary lookup (Employee ID fallback)
    if (!user) {
      const tenantDB = req.tenantDB;
      if (tenantDB) {
        try {
          const Employee = tenantDB.model('Employee');
          // If userId is valid ObjectId, search as _id; otherwise try employeeCode or employeeId string
          let emp = null;
          if (mongoose.Types.ObjectId.isValid(userId)) {
            emp = await Employee.findById(userId).select('email name firstName lastName').lean();
          } else {
            // Fallback for custom string IDs
            emp = await Employee.findOne({ 
              $or: [{ employeeId: userId }, { employeeCode: userId }] 
            }).select('email name firstName lastName').lean();
          }

          if (emp?.email) {
            const searchEmail = emp.email.toLowerCase().trim();
            user = await User.findOne({
              email:  { $regex: new RegExp(`^${searchEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
              $or: [{ mainCompanyId: tenantId }, { tenant: tenantId }]
            }).select('_id name email role permissions permVersion permUpdatedAt').lean();

            // Fallback: If still not found, try global search by email if it's an employee
            if (!user) {
                user = await User.findOne({
                    email: { $regex: new RegExp(`^${searchEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                }).select('_id name email role permissions permVersion permUpdatedAt').lean();
            }

            if (!user) {
              // Return skeleton for employees that haven't been granted access yet
              return res.json({
                success: true,
                exists: false,
                data: {
                  userId:      emp._id,
                  name:        emp.firstName ? `${emp.firstName} ${emp.lastName}` : emp.name,
                  email:       emp.email,
                  role:        'employee',
                  permissions: [],
                  permVersion: 0,
                }
              });
            }
          }
        } catch (dbErr) {
          console.error('[RBAC] Employee lookup failed:', dbErr.message);
        }
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User or employee record not found.' });
    }

    const payload = {
      exists:  true,
      data: {
        userId:      user._id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        permissions: user.permissions || [],
        permVersion: user.permVersion || 0,
        permUpdatedAt: user.permUpdatedAt,
      }
    };

    // Store in cache
    cache.set(tenantId, String(user._id), payload);
    cache.set(tenantId, userId, payload);

    return res.json({ success: true, ...payload });
  } catch (error) {
    console.error('[RBAC] getUserPermissions crash:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error', 
      error: error.message,
      path: req.originalUrl 
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /roles/user/:userId — Save permissions (+ audit + cache invalidate)
═══════════════════════════════════════════════════════════════ */
exports.updateUserPermissions = async (req, res) => {
  try {
    const { userId }     = req.params;
    const { permissions, role } = req.body;
    const tenantId       = req.user?.tenantId || req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant identification failed.' });
    }

    const adminId        = req.user?.id || req.user?._id;
    const adminEmail     = req.user?.email || 'System';
    const adminRole      = req.user?.role || 'admin';

    const User = mongoose.model('User');
    const tenantDB = req.tenantDB;
    const Employee = tenantDB?.model('Employee');
    
    let user = null;
    let employeeCacheKey = null;

    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }

    // ── EMPLOYEE-ID FALLBACK ──
    if (!user && tenantDB && Employee && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const emp = await Employee.findById(userId).select('email firstName lastName name').lean();
        if (emp?.email) {
          employeeCacheKey = String(emp._id);
          const searchEmail = emp.email.toLowerCase().trim();
          user = await User.findOne({
            email:  { $regex: new RegExp(`^${searchEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            $or: [{ mainCompanyId: tenantId }, { tenant: tenantId }]
          });

          // Fallback: Global search by email to ensure permissions stick
          if (!user) {
              user = await User.findOne({
                email: { $regex: new RegExp(`^${searchEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
              });
          }
        }
      } catch (empErr) {
        console.warn('[RBAC] Employee lookup failed during PUT:', empErr.message);
      }
    }

    const isNew = !user;
    const finalPerms = sanitizePermissions(permissions);

    // ── AUTO-CREATE USER IF MISSING ──
    if (!user) {
      if (!Employee) {
        return res.status(400).json({ success: false, message: 'Employee model not found in tenant database.' });
      }
      const emp = await Employee.findById(userId);
      if (!emp?.email) {
        return res.status(400).json({
          success: false,
          message: 'Cannot enable access: Employee must have a valid email.'
        });
      }
      employeeCacheKey = String(emp._id);

      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const defaultPassword = await bcrypt.hash('Employee@123', salt);

      user = new User({
        name:        emp.firstName ? `${emp.firstName} ${emp.lastName}` : emp.name || 'Employee',
        email:       emp.email.toLowerCase().trim(),
        password:    defaultPassword,
        role:        role || 'employee',
        mainCompanyId: tenantId,
        permissions: finalPerms,
        permVersion: 1,
        permUpdatedAt: new Date(),
      });
      await user.save();
    } else {
      // ── UPDATE EXISTING ──
      const permsBefore = JSON.parse(JSON.stringify(user.permissions || []));

      user.permissions   = finalPerms;
      if (role) user.role = role;
      user.permVersion   = (user.permVersion || 0) + 1;
      user.permUpdatedAt = new Date();
      await user.save();

      // ── AUDIT LOG ──
      try {
        let PermissionAudit;
        try {
          PermissionAudit = mongoose.model('PermissionAudit');
        } catch (_) {
          const schema = require('../models/PermissionAudit');
          PermissionAudit = mongoose.model('PermissionAudit', schema);
        }

        const summary = buildDiffSummary(permsBefore, finalPerms);
        await PermissionAudit.create({
          targetUserId:   user._id,
          targetEmail:    user.email,
          targetRole:     user.role,
          changedBy:      (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : undefined,
          changedByEmail: adminEmail,
          changedByRole:  adminRole,
          tenantId:       tenantId,
          action:         isNew ? 'USER_CREATED_WITH_PERMISSIONS' : 'PERMISSIONS_UPDATED',
          permsBefore,
          permsAfter:     finalPerms,
          permVersion:    user.permVersion,
          summary,
        });

        // console.log(`[RBAC Audit] ${adminEmail} updated permissions for ${user.email}: ${summary}`);
      } catch (auditErr) {
        console.warn('[RBAC Audit] Failed to write audit log:', auditErr.message);
        // Don't fail the request just because audit log failed
      }
    }

    if (!employeeCacheKey && user?.email && Employee) {
      try {
        const emp = await Employee.findOne({
          email: { $regex: new RegExp(`^${String(user.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        }).select('_id').lean();
        if (emp?._id) employeeCacheKey = String(emp._id);
      } catch (lookupErr) {
        console.warn('[RBAC] Employee cache lookup failed during invalidation:', lookupErr.message);
      }
    }

    // ── INVALIDATE CACHE ── so next request fetches fresh data
    cache.invalidate(tenantId, String(user._id));
    cache.invalidate(tenantId, userId);
    if (employeeCacheKey) cache.invalidate(tenantId, employeeCacheKey);
    // console.log(`[RBAC Cache] Invalidated for user=${user._id} in tenant=${tenantId}`);

    return res.json({
      success:     true,
      message:     'Access permissions saved successfully.',
      userId:      user._id,
      permVersion: user.permVersion,
      permissions: finalPerms,
    });
  } catch (error) {
    console.error('[RBAC] updateUserPermissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error:   error.message,
      stack:   error.stack
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE /roles/user/:userId — Reset (clear) permissions
═══════════════════════════════════════════════════════════════ */
exports.resetUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId   = req.user.tenantId || req.tenantId;
    const User       = mongoose.model('User');

    const user = await User.findByIdAndUpdate(
      userId,
      { permissions: [], permVersion: 0, permUpdatedAt: new Date() },
      { new: true }
    );

    if (user) {
      cache.invalidate(tenantId, userId);
      cache.invalidate(tenantId, String(user._id));
    }

    return res.json({ success: true, message: 'User permissions cleared.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /roles — All roles
═══════════════════════════════════════════════════════════════ */
exports.getRoles = async (req, res) => {
  try {
    const Role = mongoose.model('Role');
    const roles = await Role.find({ isDefault: true, isActive: true }).select('name description').lean();
    return res.json({
      success: true,
      data: roles.map(r => ({ _id: r._id, title: r.name, description: r.description }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /roles/defaults — Default permission templates per role
   Frontend uses this to populate "apply defaults" buttons
═══════════════════════════════════════════════════════════════ */
exports.getDefaultPermissions = async (req, res) => {
  try {
    const { role } = req.query;  // optional filter: ?role=employee
    if (role) {
      return res.json({ success: true, role, permissions: getDefaultPerms(role) });
    }
    return res.json({ success: true, roles: Object.keys(DEFAULT_ROLE_PERMS), defaults: DEFAULT_ROLE_PERMS });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /roles/audit — Permission audit log for a tenant
═══════════════════════════════════════════════════════════════ */
exports.getPermissionAuditLog = async (req, res) => {
  try {
    const tenantId  = req.user.tenantId || req.tenantId;
    const { userId, limit = 50, page = 1 } = req.query;

    let PermissionAudit;
    try {
      PermissionAudit = mongoose.model('PermissionAudit');
    } catch (_) {
      const schema = require('../models/PermissionAudit');
      PermissionAudit = mongoose.model('PermissionAudit', schema);
    }

    const filter = { tenantId };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.targetUserId = userId;
    }

    const [logs, total] = await Promise.all([
      PermissionAudit
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select('targetEmail changedByEmail action summary permVersion createdAt')
        .lean(),
      PermissionAudit.countDocuments(filter)
    ]);

    return res.json({ success: true, data: logs, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /roles/cache-stats — Cache diagnostics (admin only)
═══════════════════════════════════════════════════════════════ */
exports.getCacheStats = async (req, res) => {
  return res.json({ success: true, cache: cache.stats() });
};
