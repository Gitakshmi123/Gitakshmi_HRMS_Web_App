'use strict';

/**
 * dmsEmployeeSync.service.js
 * ══════════════════════════════════════════════════════════════════════
 * HRMS ➜ DMS Employee Sync Service
 *
 * Pushes HRMS employee profiles to the DMS application so that DMS
 * can display and manage employees synced from HRMS.
 *
 * Environment variables (GT_HRMS/server/.env):
 *   DMS_URL             – DMS base URL        (e.g. http://localhost:5000)
 *   DMS_SECURE_TOKEN    – Shared secret token
 *   DMS_TIMEOUT_MS      – Request timeout ms  (default: 30000)
 * ══════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');

/* ══════════════════════════════════════════════════════════════════════
   INTERNAL HELPERS
   ══════════════════════════════════════════════════════════════════════ */

/** Resolve DMS base config from env */
function getDmsConfig() {
  const dmsUrl  = (process.env.DMS_URL || 'http://localhost:5000').trim();
  const token   = (process.env.DMS_SECURE_TOKEN || '').trim();
  const timeout = parseInt(process.env.DMS_TIMEOUT_MS || '30000', 10);

  if (!token) {
    console.warn('[DMS-SYNC] ⚠️  DMS_SECURE_TOKEN is not set. Requests will be rejected by DMS.');
  }

  return {
    syncEmployeeUrl     : `${dmsUrl}/api/v1/hrms/sync-employee`,
    bulkSyncEmployeeUrl : `${dmsUrl}/api/v1/hrms/sync-employees/bulk`, // Updated to match prompt
    deleteEmployeeUrl   : `${dmsUrl}/api/v1/hrms/employees`,
    token,
    timeout,
  };
}

/**
 * Resolve the multi-tenant Employee model from the connection.
 * HRMS exports only the Schema, so we build the model on demand.
 */
function getEmployeeModel(tenantConnection) {
  if (!tenantConnection) throw new Error('[DMS-SYNC] tenantConnection is required.');
  const EmployeeSchema = require('../models/Employee');
  return tenantConnection.models.Employee ||
    tenantConnection.model('Employee', EmployeeSchema);
}

/**
 * Map an HRMS Employee document/lean object to the payload shape
 * expected by DMS POST /api/v1/hrms/sync-employee.
 */
function buildDmsPayload(emp) {
  const firstName = (emp.firstName || '').trim();
  const lastName  = (emp.lastName  || '').trim();
  const fullName  = [firstName, emp.middleName, lastName].filter(Boolean).join(' ').trim()
                    || emp.email?.split('@')[0] || 'Unknown';

  // Map HRMS status → DMS status enum (Active | Inactive | Pending | Deleted)
  const rawStatus = String(emp.status || 'active').toLowerCase();
  let dmsStatus = 'Active';
  if (['inactive', 'resigned', 'terminated'].includes(rawStatus))  dmsStatus = 'Inactive';
  if (['draft'].includes(rawStatus))                                dmsStatus = 'Pending';
  if (['deleted'].includes(rawStatus))                              dmsStatus = 'Deleted';

  return {
    hrmsEmployeeId : String(emp.employeeId || emp._id),
    name           : fullName,
    empCode        : emp.employeeCode || emp.employeeId || String(emp._id),
    email          : (emp.email || '').toLowerCase().trim(),
    mobileNumber   : emp.contactNo || '',
    department     : emp.department || '',
    designation    : emp.designation || '',
    status         : dmsStatus,
    joiningDate    : emp.joiningDate || null,
    profilePic     : emp.profilePic  || '',
    companyName    : emp.companyName  || '',
    hrmsRef        : String(emp._id),
  };
}

/**
 * Normalise axios / network errors into a human-readable message.
 */
function parseAxiosError(err, url) {
  if (err.code === 'ECONNREFUSED')
    return `DMS server is offline (connection refused to ${url})`;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')
    return `DMS request timed out`;
  if (err.response)
    return `DMS responded HTTP ${err.response.status}: ${
      err.response.data?.error || err.response.data?.message || JSON.stringify(err.response.data)
    }`;
  return err.message;
}

/* ══════════════════════════════════════════════════════════════════════
   STORE DMS EMPLOYEE ID BACK IN HRMS
   ══════════════════════════════════════════════════════════════════════ */

/**
 * After a successful DMS sync, write the DMS-assigned _id back into
 * the HRMS employee's `meta.dmsEmployeeId` field (non-blocking safe).
 */
async function storeDmsRefInHrms(hrmsEmployeeId, dmsEmployeeId, tenantConnection) {
  try {
    const Employee = getEmployeeModel(tenantConnection);
    await Employee.findOneAndUpdate(
      { employeeId: hrmsEmployeeId },
      {
        $set: {
          'meta.dmsEmployeeId'   : String(dmsEmployeeId),
          'meta.dmsSyncStatus'   : 'synced',
          'meta.dmsSyncedAt'     : new Date(),
        },
      },
      { strict: false }
    );
    console.info(
      `[DMS-SYNC] 🔗 Stored dmsEmployeeId=${dmsEmployeeId} on HRMS employee ${hrmsEmployeeId}`
    );
  } catch (dbErr) {
    console.error(
      `[DMS-SYNC] ❌ Failed to store DMS ref in HRMS for employee ${hrmsEmployeeId}: ${dbErr.message}`
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════
   EXPORTED SERVICE FUNCTIONS
   ══════════════════════════════════════════════════════════════════════ */

/**
 * syncEmployeeToDMS
 * ─────────────────────────────────────────────────────────────────────
 * Syncs a single HRMS employee to DMS.
 *
 * @param {object} employeeData        – Mongoose document or lean object
 * @param {object} tenantConnection    – Tenant-specific Mongoose connection
 * @returns {Promise<{ success, dmsEmployeeId }>}
 */
async function syncEmployeeToDMS(employeeData, tenantConnection) {
  const cfg     = getDmsConfig();
  const payload = buildDmsPayload(employeeData);
  const hrmsId  = payload.hrmsEmployeeId;

  console.info(`[DMS-SYNC] ⬆️  Syncing employee ${hrmsId} (${payload.name}) to DMS...`);

  try {
    let dmsTenantCode = '';
    if (tenantConnection && tenantConnection.name) {
      const Tenant = require('../models/Tenant');
      const tenantConfig = await Tenant.findOne({ databaseName: tenantConnection.name }).lean();
      dmsTenantCode = tenantConfig?.dmsTenantCode || tenantConfig?.companyCode || tenantConfig?.companyName || '';
    }

    const headers = {
      'X-HRMS-SECURE-TOKEN': cfg.token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (dmsTenantCode) {
      headers['x-dms-tenant-code'] = dmsTenantCode;
    }

    const { data } = await axios.post(cfg.syncEmployeeUrl, payload, {
      headers,
      timeout: cfg.timeout,
    });

    if (!data?.success) {
      throw new Error(`DMS returned success=false: ${data?.error || JSON.stringify(data)}`);
    }

    const dmsEmployeeId = data?.data?._id || data?.data?.id || null;
    console.info(
      `[DMS-SYNC] ✅ Employee ${hrmsId} synced. DMS _id=${dmsEmployeeId}`
    );

    // Store the DMS id back in HRMS asynchronously (non-blocking)
    if (dmsEmployeeId && tenantConnection) {
      setImmediate(() =>
        storeDmsRefInHrms(hrmsId, dmsEmployeeId, tenantConnection).catch(() => {})
      );
    }

    return { success: true, dmsEmployeeId };

  } catch (err) {
    const reason = parseAxiosError(err, cfg.syncEmployeeUrl);
    console.error(`[DMS-SYNC] ❌ Failed to sync employee ${hrmsId}: ${reason}`);

    // Mark sync as failed in HRMS (best-effort)
    if (tenantConnection) {
      try {
        const Employee = getEmployeeModel(tenantConnection);
        await Employee.findOneAndUpdate(
          { employeeId: hrmsId },
          { $set: { 'meta.dmsSyncStatus': 'failed', 'meta.dmsSyncError': reason } },
          { strict: false }
        );
      } catch (_) { /* ignore secondary failure */ }
    }

    return { success: false, error: reason };
  }
}

/**
 * bulkSyncAllEmployeesToDMS
 * ─────────────────────────────────────────────────────────────────────
 * Fetches all (or only unsynced) employees from HRMS and pushes them
 * to DMS in batches.
 *
 * @param {object} tenantConnection
 * @param {object} options
 * @param {number} [options.batchSize=50]       – Employees per request
 * @param {boolean} [options.onlyUnsynced=false] – Skip already-synced ones
 * @param {boolean} [options.onlyModifiedSince]  – Only employees updated after this Date
 * @returns {Promise<{ total, synced, failed, errors }>}
 */
async function bulkSyncAllEmployeesToDMS(tenantConnection, options = {}) {
  const {
    batchSize        = 50,
    onlyUnsynced     = false,
    onlyModifiedSince = null,
  } = options;

  const cfg      = getDmsConfig();
  const Employee = getEmployeeModel(tenantConnection);

  // Build query filter
  const filter = { isDeleted: { $ne: true } };
  if (onlyUnsynced)       filter['meta.dmsSyncStatus'] = { $ne: 'synced' };
  if (onlyModifiedSince)  filter.updatedAt = { $gte: onlyModifiedSince };

  console.info(`[DMS-SYNC] 🔄 Starting bulk sync. Filter: ${JSON.stringify(filter)}`);

  const total      = await Employee.countDocuments(filter);
  const totalBatches = Math.ceil(total / batchSize);

  let synced = 0;
  let failed = 0;
  const errors = [];

  console.info(`[DMS-SYNC] Total employees to sync: ${total} in ${totalBatches} batch(es)`);

  let dmsTenantCode = '';
  if (tenantConnection && tenantConnection.name) {
    const Tenant = require('../models/Tenant');
    const tenantConfig = await Tenant.findOne({ databaseName: tenantConnection.name }).lean();
    dmsTenantCode = tenantConfig?.dmsTenantCode || tenantConfig?.companyCode || tenantConfig?.companyName || '';
  }

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const employees = await Employee.find(filter)
      .skip(batchNum * batchSize)
      .limit(batchSize)
      .lean();

    console.info(
      `[DMS-SYNC] 📦 Processing batch ${batchNum + 1}/${totalBatches} (${employees.length} employees)...`
    );

    const batch = employees.map(buildDmsPayload);

    try {
      const headers = {
        'X-HRMS-SECURE-TOKEN': cfg.token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (dmsTenantCode) {
        headers['x-dms-tenant-code'] = dmsTenantCode;
      }

      const { data } = await axios.post(cfg.bulkSyncEmployeeUrl, { employees: batch }, {
        headers,
        timeout: cfg.timeout,
      });

      const batchSynced = data?.synced  ?? 0;
      const batchFailed = data?.failed  ?? 0;
      const batchErrors = data?.errors  ?? [];

      synced += batchSynced;
      failed += batchFailed;
      errors.push(...batchErrors);

      console.info(
        `[DMS-SYNC] Batch ${batchNum + 1}: ✅ ${batchSynced} synced, ❌ ${batchFailed} failed`
      );

    } catch (err) {
      const reason = parseAxiosError(err, cfg.bulkSyncEmployeeUrl);
      console.error(`[DMS-SYNC] ❌ Batch ${batchNum + 1} failed entirely: ${reason}`);
      failed += employees.length;
      employees.forEach(emp =>
        errors.push({ hrmsEmployeeId: emp.employeeId, error: reason })
      );
    }

    // Small pause between batches to avoid overwhelming DMS
    if (batchNum < totalBatches - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const result = { total, synced, failed, errors };
  console.info(
    `[DMS-SYNC] 🏁 Bulk sync complete. Total=${total} Synced=${synced} Failed=${failed}`
  );
  return result;
}

/**
 * syncEmployeeToDMSBackground
 * ─────────────────────────────────────────────────────────────────────
 * Fire-and-forget wrapper around syncEmployeeToDMS.
 * Logs result but never throws — safe to call from any controller hook.
 */
function syncEmployeeToDMSBackground(employeeData, tenantConnection) {
  setImmediate(async () => {
    try {
      await syncEmployeeToDMS(employeeData, tenantConnection);
    } catch (err) {
      console.error(`[DMS-SYNC-BG] ❌ Unhandled error: ${err.message}`);
    }
  });
}

/**
 * notifyDMSEmployeeDeleted
 * ─────────────────────────────────────────────────────────────────────
 * Calls DELETE ${DMS_URL}/api/v1/hrms/employees/:hrmsEmployeeId
 * Used when an employee is deactivated/deleted in HRMS.
 */
async function notifyDMSEmployeeDeleted(hrmsEmployeeId) {
  const cfg = getDmsConfig();
  const url = `${cfg.deleteEmployeeUrl}/${hrmsEmployeeId}`;
  
  console.info(`[DMS-SYNC] 🗑️  Notifying DMS of deleted employee: ${hrmsEmployeeId}`);
  
  try {
    const { data } = await axios.delete(url, {
      headers: {
        'X-HRMS-SECURE-TOKEN' : cfg.token,
        'Accept'              : 'application/json',
      },
      timeout: cfg.timeout,
    });
    
    console.info(`[DMS-SYNC] ✅ Successfully notified DMS to delete employee: ${hrmsEmployeeId}`);
    return { success: true, data };
  } catch (err) {
    const reason = parseAxiosError(err, url);
    console.error(`[DMS-SYNC] ❌ Failed to notify DMS of deletion for ${hrmsEmployeeId}: ${reason}`);
    return { success: false, error: reason };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════════════════════════════════ */
module.exports = {
  syncEmployeeToDMS,
  syncEmployeeToDMSBackground,
  bulkSyncAllEmployeesToDMS,
  notifyDMSEmployeeDeleted,
};
