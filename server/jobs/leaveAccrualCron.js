const cron = require('node-cron');
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const accrualService = require('../services/leaveAccrual.service');

/**
 * Automates HR Leave Accrual - Runs on the 1st of every month at 00:01 AM
 */
function initializeLeaveAccrualCron() {
    // 01 00 1 * * -> 1st day of month, 00:01
    cron.schedule('1 0 1 * *', async () => {
        // console.log('[CRON] Starting Monthly Leave Accrual Job...');
        
        try {
            const Tenant = mongoose.model('Tenant');
            const tenants = await Tenant.find({ status: 'active' });
            
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // 1-12
            
            for (const tenant of tenants) {
                try {
                    const tenantDB = await getTenantDB(tenant._id.toString());
                    
                    // The service itself handles idempotency via LeaveAccrualLog
                    const result = await accrualService.runMonthlyAccrual(
                        tenantDB, 
                        tenant._id, 
                        year, 
                        month
                    );
                    
                    // console.log(`[CRON][ACCRUAL] Tenant ${tenant.companyName} (${tenant.code}):`, result.message);
                } catch (tenantErr) {
                    console.error(`[CRON][ACCRUAL] Failed for tenant ${tenant.code}:`, tenantErr.message);
                }
            }
            
            // console.log('[CRON] Monthly Leave Accrual Job Completed.');
        } catch (err) {
            console.error('[CRON][ACCRUAL] Global Accrual Job Error:', err);
        }
    });

    // console.log('✅ Leave Accrual Cron Scheduled (Monthly on 1st)');
}

module.exports = initializeLeaveAccrualCron;
