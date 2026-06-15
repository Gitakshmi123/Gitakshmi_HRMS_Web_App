/**
 * Global account status validation middleware.
 * Blocks all actions when the authenticated user's employee record is not ACTIVE.
 * Use on employee self-service write routes (leave apply, attendance punch, profile edit, etc.).
 *
 * Returns 403 with: "Your account has been deactivated. Please contact HR for assistance."
 * Does not run for routes that don't have req.user.id (e.g. public routes).
 */

const DEACTIVATED_MESSAGE = 'Your account has been deactivated. Please contact HR for assistance.';
const ACTIVE_STATUSES = ['ACTIVE', 'Active', 'active'];
const DEBUG_ACTIVE_EMPLOYEE = String(process.env.DEBUG_ACTIVE_EMPLOYEE || '').toLowerCase() === 'true';

async function findEmployeeByEmailInTenant(tenantId, email) {
  const scopedTenantId = String(tenantId || '').trim();
  if (!scopedTenantId) return null;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    const getTenantDB = require('../utils/tenantDB');
    const safeEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const tenantDB = await getTenantDB(scopedTenantId);
    const Employee = tenantDB.model('Employee');
    const employee = await Employee.findOne({
      email: { $regex: new RegExp(`^${safeEmail}$`, 'i') }
    }).select('status attendanceLocked email').lean();

    if (employee) {
      return {
        employee,
        tenantId: scopedTenantId,
        tenantDB,
      };
    }
  } catch (_err) {
    // Ignore recovery failures and let the standard guard respond.
  }

  return null;
}

function attachTenantContext(req, tenantId, tenantDB) {
  if (!tenantDB) return;
  const resolvedTenantId = tenantDB.tenantId || tenantId;
  req.tenantDB = tenantDB;
  if (resolvedTenantId) {
    req.tenantId = String(resolvedTenantId);
    if (req.user) {
      req.user.tenantId = req.tenantId;
      req.user.companyId = req.user.companyId || req.tenantId;
    }
  }
}

async function requireActiveEmployee(req, res, next) {
  const role = (req.user?.role || '').toLowerCase();
  const BYPASS_ROLES = ['admin', 'psa', 'super_admin', 'hr', 'company_admin', 'company_super_admin', 'hr_manager', 'hr_admin'];

  if (DEBUG_ACTIVE_EMPLOYEE) {
    console.log(`[requireActiveEmployee] Path: ${req.path}, Role: ${role}`);
  }
  
  // 1. Bypass for internal admin roles - They should always have access to settings
  if (BYPASS_ROLES.includes(role)) {
    if (DEBUG_ACTIVE_EMPLOYEE) {
      console.log(`[requireActiveEmployee] Bypassing for admin role: ${role}`);
    }
    return next();
  }

  const isBypass = String(process.env.AUTHZ_BYPASS || '').toLowerCase() === 'true';
  if (isBypass) {
    if (DEBUG_ACTIVE_EMPLOYEE) {
      console.log(`[requireActiveEmployee] Bypassing via AUTHZ_BYPASS`);
    }
    return next();
  }

  try {
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.tenantId || req.user?.tenantId || req.user?.tenant;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'account_deactivated',
        message: DEACTIVATED_MESSAGE
      });
    }

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'account_deactivated',
        message: DEACTIVATED_MESSAGE
      });
    }

    const getTenantDB = require('../utils/tenantDB');
    const db = await getTenantDB(tenantId);
    attachTenantContext(req, tenantId, db);
    const Employee = db.model('Employee');
    let employee = await Employee.findOne({
      $or: [
        { _id: userId },
        { email: req.user?.email }
      ]
    }).select('status attendanceLocked email').lean();

    if (!employee) {
      const recovered = await findEmployeeByEmailInTenant(tenantId, req.user?.email);
      if (recovered?.employee) {
        employee = recovered.employee;
        attachTenantContext(req, recovered.tenantId, recovered.tenantDB);
        if (DEBUG_ACTIVE_EMPLOYEE) {
          console.warn(`[requireActiveEmployee] Recovered employee record using tenant-scoped email fallback. tenant=${tenantId}`);
        }
      } else {
        if (DEBUG_ACTIVE_EMPLOYEE) {
          console.log(`[requireActiveEmployee] Employee NOT FOUND in DB. ID: ${userId}, Tenant: ${tenantId}`);
        }
        return res.status(403).json({
          success: false,
          error: 'account_deactivated',
          message: DEACTIVATED_MESSAGE
        });
      }
    }

    const status = (employee.status || '').trim().toUpperCase();

    if (status === 'SUBMITTED' || status === 'PENDING') {
      return res.status(403).json({
        success: false,
        error: 'pending_approval',
        message: 'Your profile has been submitted and is waiting for HR approval.'
      });
    }

    if (status === 'DRAFT' || status === 'NOT_STARTED') {
      return res.status(403).json({
        success: false,
        error: 'onboarding_required',
        message: 'Please complete your onboarding profile to activate your account.'
      });
    }

    const isActive = ACTIVE_STATUSES.includes(status) && employee.attendanceLocked !== true;

    if (!isActive) {
      if (DEBUG_ACTIVE_EMPLOYEE) {
        console.log(`[requireActiveEmployee] Employee INACTIVE / LOCKED. ID: ${userId}, Status: ${status}, Locked: ${employee.attendanceLocked}`);
      }
      return res.status(403).json({
        success: false,
        error: 'account_deactivated',
        message: DEACTIVATED_MESSAGE
      });
    }

    next();
  } catch (err) {
    console.error('[requireActiveEmployee]', err.message);
    return res.status(500).json({
      success: false,
      error: 'account_deactivated',
      message: DEACTIVATED_MESSAGE
    });
  }
}

requireActiveEmployee.DEACTIVATED_MESSAGE = DEACTIVATED_MESSAGE;
requireActiveEmployee.ACCOUNT_DEACTIVATED_ERROR = 'account_deactivated';
module.exports = requireActiveEmployee;
