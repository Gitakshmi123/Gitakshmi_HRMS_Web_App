const cron = require('node-cron');
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const leaveManagementService = require('../services/leaveManagement.service');

function initializeYearlyLeaveResetCron() {
    cron.schedule('0 0 1 1 *', async () => {
        // console.log('[CRON][LEAVE_RESET] Starting yearly leave reset job');

        try {
            const Tenant = mongoose.model('Tenant');
            const tenants = await Tenant.find({ status: 'active' }).select('_id companyName code');
            const targetYear = new Date().getFullYear();

            for (const tenant of tenants) {
                try {
                    const tenantDB = await getTenantDB(tenant._id.toString());
                    const result = await leaveManagementService.resetYearlyLeaveBalancesForTenant({
                        tenantId: tenant._id,
                        tenantDB,
                        year: targetYear
                    });

                    // console.log(`[CRON][LEAVE_RESET] ${tenant.companyName} (${tenant.code}) reset ${result.resetCount} employees for ${targetYear}`);
                } catch (tenantError) {
                    console.error(`[CRON][LEAVE_RESET] Failed for tenant ${tenant.code}:`, tenantError.message);
                }
            }

            // console.log('[CRON][LEAVE_RESET] Yearly leave reset job completed');
        } catch (error) {
            console.error('[CRON][LEAVE_RESET] Global reset job failed:', error);
        }
    });

    // console.log('✅ Yearly Leave Reset Cron scheduled (January 1 at 00:00)');
}

module.exports = initializeYearlyLeaveResetCron;
