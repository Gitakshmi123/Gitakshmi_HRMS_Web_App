'use strict';

/**
 * dmsSync.controller.js
 * ══════════════════════════════════════════════════════════════════════
 * HTTP controllers for the HRMS → DMS Employee Sync endpoints.
 *
 * Endpoints (mounted at /api/dms-sync):
 *   POST /trigger-bulk            – Bulk sync all employees
 *   POST /sync-employee/:id       – Sync a single employee by employeeId
 *   GET  /status                  – Report sync statistics
 *
 * NOTE: Uses req.tenantDB — the standard HRMS tenant connection field.
 * ══════════════════════════════════════════════════════════════════════
 */

const {
  syncEmployeeToDMS,
  bulkSyncAllEmployeesToDMS,
} = require('../services/dmsEmployeeSync.service');

/* ─── helper: resolve Employee model from tenant connection ─────────── */
function getEmployeeModel(tenantDB) {
  const EmployeeSchema = require('../models/Employee');
  return tenantDB.models.Employee ||
    tenantDB.model('Employee', EmployeeSchema);
}

/* ─── helper: get and validate tenantDB ─────────────────────────────── */
function resolveTenantDB(req, res) {
  // HRMS injects the tenant connection as req.tenantDB
  const tenantDB = req.tenantDB || req.tenantConnection;
  if (!tenantDB) {
    res.status(400).json({
      success : false,
      message : 'Tenant database connection not available. Ensure you are authenticated with a valid tenant.',
    });
    return null;
  }
  return tenantDB;
}

/* ══════════════════════════════════════════════════════════════════════
   POST /api/dms-sync/trigger-bulk
   ══════════════════════════════════════════════════════════════════════ */
exports.syncAllEmployees = async (req, res) => {
  try {
    const tenantDB = resolveTenantDB(req, res);
    if (!tenantDB) return;

    const { onlyUnsynced = false, batchSize = 50 } = req.body;

    console.info('[DMS-SYNC] 📣 Bulk sync triggered by:', req.user?.email || 'unknown');

    const result = await bulkSyncAllEmployeesToDMS(tenantDB, {
      batchSize    : Math.min(parseInt(batchSize, 10) || 50, 200),
      onlyUnsynced : Boolean(onlyUnsynced),
    });

    return res.status(200).json({
      success : true,
      message : `Sync complete. ${result.synced} synced, ${result.failed} failed.`,
      data    : result,
    });

  } catch (err) {
    console.error('[DMS-SYNC] ❌ syncAllEmployees error:', err.message);
    return res.status(500).json({
      success : false,
      message : 'Internal server error during DMS sync.',
      error   : err.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   POST /api/dms-sync/sync-employee/:employeeId
   ══════════════════════════════════════════════════════════════════════ */
exports.syncOneEmployee = async (req, res) => {
  try {
    const tenantDB = resolveTenantDB(req, res);
    if (!tenantDB) return;

    const { employeeId } = req.params;

    const Employee = getEmployeeModel(tenantDB);
    const employee = await Employee.findOne({ employeeId }).lean();

    if (!employee) {
      return res.status(404).json({
        success : false,
        message : `Employee with employeeId "${employeeId}" not found.`,
      });
    }

    const result = await syncEmployeeToDMS(employee, tenantDB);

    if (result.success) {
      return res.status(200).json({
        success       : true,
        message       : `Employee ${employeeId} synced to DMS successfully.`,
        dmsEmployeeId : result.dmsEmployeeId,
      });
    } else {
      return res.status(502).json({
        success : false,
        message : `Failed to sync employee ${employeeId} to DMS.`,
        error   : result.error,
      });
    }

  } catch (err) {
    console.error('[DMS-SYNC] ❌ syncOneEmployee error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   GET /api/dms-sync/status
   ══════════════════════════════════════════════════════════════════════ */
exports.getSyncStatus = async (req, res) => {
  try {
    const tenantDB = resolveTenantDB(req, res);
    if (!tenantDB) return;

    const Employee = getEmployeeModel(tenantDB);

    const [total, synced, failed, pending] = await Promise.all([
      Employee.countDocuments({ isDeleted: { $ne: true } }),
      Employee.countDocuments({ 'meta.dmsSyncStatus': 'synced' }),
      Employee.countDocuments({ 'meta.dmsSyncStatus': 'failed' }),
      Employee.countDocuments({
        isDeleted: { $ne: true },
        'meta.dmsSyncStatus': { $nin: ['synced', 'failed'] },
      }),
    ]);

    return res.status(200).json({
      success : true,
      data    : { total, synced, failed, pending },
    });

  } catch (err) {
    console.error('[DMS-SYNC] ❌ getSyncStatus error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
