/**
 * BGV SLA Automation - Cron Job
 * Automatically checks SLAs, sends reminders, and escalates cases
 */

const cron = require('node-cron');
const BGVSLAEngine = require('../services/BGVSLAEngine');

class BGVSLACronJobs {

    /**
     * Initialize all SLA-related cron jobs
     */
    static initializeCronJobs() {
        // console.log('[SLA_CRON] Initializing BGV SLA automation...');

        // Job 1: Check SLAs every hour
        this.startSLAChecker();

        // Job 2: Send reminders every 6 hours
        this.startReminderSender();

        // console.log('[SLA_CRON] All SLA cron jobs initialized successfully');
    }

    /**
     * Cron Job 1: Check SLAs for all tenants every hour
     * Runs at: Every hour (0 * * * *)
     */
    static startSLAChecker() {
        cron.schedule('0 * * * *', async () => {
            // console.log('[SLA_CRON] Running hourly SLA check...');

            try {
                // Get all tenants
                const tenants = await this.getAllTenants();

                let totalResults = {
                    checked: 0,
                    breached: 0,
                    critical: 0,
                    warning: 0,
                    escalated: 0
                };

                // Check SLAs for each tenant
                for (const tenant of tenants) {
                    try {
                        const results = await BGVSLAEngine.checkAllSLAs(tenant._id);

                        totalResults.checked += results.checked;
                        totalResults.breached += results.breached;
                        totalResults.critical += results.critical;
                        totalResults.warning += results.warning;
                        totalResults.escalated += results.escalated;

                        // console.log(`[SLA_CRON] Tenant ${tenant.code}: Checked ${results.checked}, Breached ${results.breached}`);
                    } catch (tenantError) {
                        console.error(`[SLA_CRON_ERROR] Tenant ${tenant.code}:`, tenantError.message);
                    }
                }

                // console.log('[SLA_CRON] Hourly SLA check complete:', totalResults);

            } catch (error) {
                console.error('[SLA_CRON_ERROR] Failed to run SLA check:', error);
            }
        });

        // console.log('[SLA_CRON] ✅ Hourly SLA checker started (runs every hour)');
    }

    /**
     * Cron Job 2: Send SLA reminders every 6 hours
     * Runs at: Every 6 hours (0 * / 6 * * * - space added for comment safety)
     */
    static startReminderSender() {
        cron.schedule('0 */6 * * *', async () => {
            // console.log('[SLA_CRON] Running SLA reminder sender...');

            try {
                const tenants = await this.getAllTenants();
                let totalReminders = 0;

                for (const tenant of tenants) {
                    try {
                        const reminders = await this.sendRemindersForTenant(tenant._id);
                        totalReminders += reminders;

                        // console.log(`[SLA_CRON] Tenant ${tenant.code}: Sent ${reminders} reminders`);
                    } catch (tenantError) {
                        console.error(`[SLA_CRON_ERROR] Tenant ${tenant.code}:`, tenantError.message);
                    }
                }

                // console.log(`[SLA_CRON] Reminder sender complete: ${totalReminders} reminders sent`);

            } catch (error) {
                console.error('[SLA_CRON_ERROR] Failed to send reminders:', error);
            }
        });

        // console.log('[SLA_CRON] ✅ Reminder sender started (runs every 6 hours)');
    }

    /**
     * Send reminders for a specific tenant
     */
    static async sendRemindersForTenant(tenantId) {
        const getTenantDB = require('../utils/tenantDB');
        const db = await getTenantDB(tenantId);

        const BGVCase = db.model('BGVCase');

        // Get active cases
        const activeCases = await BGVCase.find({
            tenant: tenantId,
            isClosed: false,
            overallStatus: { $nin: ['CLOSED', 'CANCELLED'] }
        });

        let remindersSent = 0;

        for (const bgvCase of activeCases) {
            const threshold = BGVSLAEngine.shouldSendReminder(
                bgvCase.initiatedAt,
                bgvCase.slaDeadline,
                bgvCase.slaRemindersSent || []
            );

            if (threshold) {
                try {
                    await BGVSLAEngine.sendSLAReminder(tenantId, bgvCase._id, threshold);
                    remindersSent++;
                } catch (reminderError) {
                    console.error(`[SLA_REMINDER_ERROR] Case ${bgvCase.caseId}:`, reminderError.message);
                }
            }
        }

        return remindersSent;
    }

    /**
     * Get all active tenants
     */
    static async getAllTenants() {
        const mongoose = require('mongoose');
        const Tenant = mongoose.model('Tenant');

        return await Tenant.find({ status: 'active' });
    }

    /**
     * Manual trigger for SLA check (for testing)
     */
    static async manualSLACheck(tenantId) {
        console.log(`[SLA_MANUAL] Running manual SLA check for tenant: ${tenantId}`);

        try {
            const results = await BGVSLAEngine.checkAllSLAs(tenantId);
            console.log('[SLA_MANUAL] Results:', results);
            return results;
        } catch (error) {
            console.error('[SLA_MANUAL_ERROR]', error);
            throw error;
        }
    }

    /**
     * Manual trigger for sending reminders (for testing)
     */
    static async manualSendReminders(tenantId) {
        console.log(`[SLA_MANUAL] Sending reminders for tenant: ${tenantId}`);

        try {
            const count = await this.sendRemindersForTenant(tenantId);
            console.log(`[SLA_MANUAL] Sent ${count} reminders`);
            return count;
        } catch (error) {
            console.error('[SLA_MANUAL_ERROR]', error);
            throw error;
        }
    }
}

module.exports = BGVSLACronJobs;
