/**
 * joiningLetterExpiryCron.js
 *
 * Cron Job: Auto-expiry of Joining Letters
 * Runs every hour and marks all pending joining letters as 'expired'
 * if currentDate > joiningLetterExpiryDate
 *
 * Multi-tenant safe: scans all tenant databases
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const { getTenantDB } = require('../config/dbManager');

async function runJoiningLetterExpiry() {
    // console.log('[CRON][JOINING EXPIRY] Starting joining letter auto-expiry check...');
    try {
        const now = new Date();

        // Get all tenants from global DB
        const Tenant = mongoose.model('Tenant');
        const tenants = await Tenant.find({ status: 'active' }).lean();

        let totalExpired = 0;

        for (const tenant of tenants) {
            const tenantId = tenant._id.toString();
            try {
                const db = getTenantDB(tenantId);
                const GeneratedLetter = db.model('GeneratedLetter');

                const result = await GeneratedLetter.updateMany(
                    {
                        tenant: tenantId,
                        letterType: 'joining',
                        joiningLetterStatus: 'pending',
                        joiningLetterExpiryDate: { $exists: true, $ne: null, $lt: now }
                    },
                    {
                        $set: { joiningLetterStatus: 'expired', status: 'expired' }
                    }
                );

                if (result.modifiedCount > 0) {
                    totalExpired += result.modifiedCount;
                    // console.log(`[CRON][JOINING EXPIRY] Expired ${result.modifiedCount} letters for tenant: ${tenant.code || tenantId}`);
                }
            } catch (tenantErr) {
                console.error(`[CRON][JOINING EXPIRY] Failed for tenant ${tenantId}:`, tenantErr.message);
            }
        }

        // console.log(`[CRON][JOINING EXPIRY] Done. Total expired: ${totalExpired}`);
    } catch (err) {
        console.error('[CRON][JOINING EXPIRY] Fatal error:', err.message);
    }
}

function startJoiningLetterExpiryCron() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        await runJoiningLetterExpiry();
    });

    // console.log('[CRON] Joining Letter Expiry Job scheduled (every hour).');

    // Also run immediately on startup to catch any missed expirations
    runJoiningLetterExpiry().catch(err => {
        console.warn('[CRON][JOINING EXPIRY] Startup run failed (non-fatal):', err.message);
    });
}

module.exports = startJoiningLetterExpiryCron;
