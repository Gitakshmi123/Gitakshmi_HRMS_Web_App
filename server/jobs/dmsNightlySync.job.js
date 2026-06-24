'use strict';

/**
 * dmsNightlySync.job.js
 * ══════════════════════════════════════════════════════════════════════
 * Nightly HRMS → DMS Employee Sync Cron Job
 *
 * Runs every day at 2:00 AM and syncs all employees that were
 * modified in the last 24 hours to the DMS system.
 *
 * This is a safety net to catch any employees that were missed by
 * the real-time hooks (e.g. during DMS downtime).
 *
 * Schedule: '0 2 * * *'  (2:00 AM daily)
 * ══════════════════════════════════════════════════════════════════════
 */

let cron;
try {
  cron = require('node-cron');
} catch (_) {
  console.warn('[DMS-CRON] ⚠️  node-cron is not installed. Nightly DMS sync will not run.');
  cron = null;
}

const { bulkSyncAllEmployeesToDMS } = require('../services/dmsEmployeeSync.service');

// ── Attempt to get all active tenant connections ──────────────────────
// HRMS uses a dbManager to handle multiple tenant connections.
// We try to import it; if the pattern differs in your codebase,
// adjust the import to match your actual dbManager / TenantManager.
let dbManager = null;
try {
  dbManager = require('../config/dbManager');
} catch (_) {
  console.warn('[DMS-CRON] ⚠️  Could not load dbManager. Nightly sync will be skipped.');
}

/**
 * Run the sync for every active tenant.
 * Falls back to a single default connection if no dbManager is available.
 */
async function runNightlySync() {
  console.info('[DMS-CRON] 🌙 Nightly DMS employee sync started at', new Date().toISOString());

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours

  let tenantConnections = [];

  // Try to get all tenant connections from dbManager
  if (dbManager) {
    try {
      // dbManager may expose getAllConnections(), getAll(), or a Map
      if (typeof dbManager.getAllConnections === 'function') {
        const allConns = dbManager.getAllConnections();
        tenantConnections = Array.isArray(allConns) ? allConns : Object.values(allConns || {});
      } else if (typeof dbManager.getAll === 'function') {
        tenantConnections = Object.values(dbManager.getAll() || {});
      } else if (dbManager.connections instanceof Map) {
        tenantConnections = [...dbManager.connections.values()];
      }
    } catch (e) {
      console.warn('[DMS-CRON] Could not enumerate tenant connections:', e.message);
    }
  }

  // Fallback: use the default mongoose connection
  if (tenantConnections.length === 0) {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      tenantConnections = [mongoose.connection];
      console.info('[DMS-CRON] Using default mongoose connection for sync.');
    } else {
      console.warn('[DMS-CRON] ⚠️  No active DB connections found. Skipping nightly sync.');
      return;
    }
  }

  console.info(`[DMS-CRON] Found ${tenantConnections.length} tenant connection(s).`);

  for (const conn of tenantConnections) {
    const tenantId = conn.name || conn.id || 'unknown';
    try {
      console.info(`[DMS-CRON] Syncing tenant: ${tenantId}`);
      const result = await bulkSyncAllEmployeesToDMS(conn, {
        batchSize        : 50,
        onlyUnsynced     : false,       // sync ALL modified in last 24h, even if previously synced
        onlyModifiedSince: since,
      });
      console.info(
        `[DMS-CRON] ✅ Tenant ${tenantId}: Total=${result.total} Synced=${result.synced} Failed=${result.failed}`
      );
    } catch (err) {
      console.error(`[DMS-CRON] ❌ Tenant ${tenantId} sync failed: ${err.message}`);
    }
  }

  console.info('[DMS-CRON] 🏁 Nightly sync complete at', new Date().toISOString());
}

/**
 * initDmsNightlySyncJob
 * ─────────────────────────────────────────────────────────────────────
 * Registers the cron schedule. Call this once from server.js startup.
 */
function initDmsNightlySyncJob() {
  if (!cron) {
    console.warn('[DMS-CRON] Skipping registration: node-cron is not available.');
    return;
  }

  // '0 2 * * *' = every day at 2:00 AM
  cron.schedule('0 2 * * *', () => {
    runNightlySync().catch(err =>
      console.error('[DMS-CRON] ❌ Unhandled error in nightly sync:', err.message)
    );
  }, {
    timezone: 'Asia/Kolkata',   // IST — change to your server timezone if needed
  });

  console.info('[DMS-CRON] ✅ Nightly DMS employee sync scheduled at 2:00 AM IST daily.');
}

module.exports = { initDmsNightlySyncJob, runNightlySync };
