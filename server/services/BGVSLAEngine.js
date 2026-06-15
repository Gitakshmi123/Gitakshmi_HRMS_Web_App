/**
 * BGV SLA Engine
 * Manages SLA tracking, auto-escalation, and reminder notifications
 * Enterprise-grade deadline management
 */

const { getBGVModels } = require('../utils/bgvModels');

class BGVSLAEngine {

    /**
     * SLA reminder thresholds (percentage of SLA elapsed)
     */
    static REMINDER_THRESHOLDS = [50, 80, 100];

    /**
     * Calculate SLA deadline from initiation date
     */
    static calculateSLADeadline(initiatedAt, slaDays) {
        const deadline = new Date(initiatedAt);
        deadline.setDate(deadline.getDate() + slaDays);
        return deadline;
    }

    /**
     * Calculate SLA percentage elapsed
     */
    static calculateSLAPercentage(initiatedAt, slaDeadline) {
        const now = new Date();
        const totalDuration = slaDeadline - initiatedAt;
        const elapsed = now - initiatedAt;

        const percentage = (elapsed / totalDuration) * 100;
        return Math.min(Math.max(percentage, 0), 100);
    }

    /**
     * Check if SLA is breached
     */
    static isSLABreached(slaDeadline) {
        const now = new Date();
        return now > slaDeadline;
    }

    /**
     * Get SLA status
     */
    static getSLAStatus(initiatedAt, slaDeadline) {
        const percentage = this.calculateSLAPercentage(initiatedAt, slaDeadline);
        const isBreached = this.isSLABreached(slaDeadline);

        if (isBreached) {
            return 'BREACHED';
        }

        if (percentage >= 80) {
            return 'CRITICAL';
        }

        if (percentage >= 50) {
            return 'WARNING';
        }

        return 'ON_TRACK';
    }

    /**
     * Get hours remaining until SLA breach
     */
    static getHoursRemaining(slaDeadline) {
        const now = new Date();
        const diffMs = slaDeadline - now;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        return Math.max(hours, 0);
    }

    /**
     * Check and update SLA for all active cases
     * Should be run as a cron job
     */
    static async checkAllSLAs(tenantId) {
        try {
            const getTenantDB = require('../utils/tenantDB');
            const db = await getTenantDB(tenantId);

            const BGVCase = db.model('BGVCase');
            const BGVTimeline = db.model('BGVTimeline');

            // Get all active cases
            const activeCases = await BGVCase.find({
                tenant: tenantId,
                overallStatus: { $nin: ['CLOSED', 'CANCELLED'] },
                isClosed: false
            });

            const results = {
                checked: 0,
                breached: 0,
                critical: 0,
                warning: 0,
                escalated: 0
            };

            for (const bgvCase of activeCases) {
                results.checked++;

                const slaStatus = this.getSLAStatus(bgvCase.initiatedAt, bgvCase.slaDeadline);
                const percentage = this.calculateSLAPercentage(bgvCase.initiatedAt, bgvCase.slaDeadline);

                // Update SLA fields
                bgvCase.slaStatus = slaStatus;
                bgvCase.slaPercentage = Math.round(percentage);

                if (slaStatus === 'BREACHED' && !bgvCase.slaBreached) {
                    bgvCase.slaBreached = true;
                    bgvCase.slaBreachedAt = new Date();
                    results.breached++;

                    // Create timeline entry
                    await this.createSLATimelineEntry(BGVTimeline, bgvCase._id, tenantId, 'SLA_BREACHED', {
                        message: 'SLA deadline has been breached',
                        hoursOverdue: this.getHoursRemaining(bgvCase.slaDeadline) * -1
                    });

                    // Auto-escalate if configured
                    if (bgvCase.autoEscalateOnSLABreach) {
                        await this.escalateCase(bgvCase, 'SLA_BREACH');
                        results.escalated++;
                    }
                }

                if (slaStatus === 'CRITICAL') {
                    results.critical++;
                }

                if (slaStatus === 'WARNING') {
                    results.warning++;
                }

                await bgvCase.save();
            }

            return results;
        } catch (error) {
            console.error('[SLA_ENGINE_ERROR]', error);
            throw error;
        }
    }

    /**
     * Check if reminder should be sent
     */
    static shouldSendReminder(initiatedAt, slaDeadline, remindersSent = []) {
        const percentage = this.calculateSLAPercentage(initiatedAt, slaDeadline);

        for (const threshold of this.REMINDER_THRESHOLDS) {
            if (percentage >= threshold && !remindersSent.includes(threshold)) {
                return threshold;
            }
        }

        return null;
    }

    /**
     * Send SLA reminder
     */
    static async sendSLAReminder(tenantId, caseId, threshold) {
        try {
            const getTenantDB = require('../utils/tenantDB');
            const db = await getTenantDB(tenantId);

            const BGVCase = db.model('BGVCase');
            const BGVEmailLog = db.model('BGVEmailLog');

            const bgvCase = await BGVCase.findById(caseId)
                .populate('candidateId')
                .populate('initiatedBy');

            if (!bgvCase) {
                return;
            }

            const hoursRemaining = this.getHoursRemaining(bgvCase.slaDeadline);

            // Prepare email data
            const emailData = {
                tenant: tenantId,
                caseId: bgvCase._id,
                emailType: 'SLA_REMINDER',
                recipientEmail: bgvCase.candidateId?.email || bgvCase.initiatedBy?.email,
                recipientName: bgvCase.candidateId?.name || bgvCase.initiatedBy?.name,
                subject: `BGV SLA Alert: ${threshold}% of deadline elapsed - ${bgvCase.caseId}`,
                templateData: {
                    caseId: bgvCase.caseId,
                    threshold,
                    hoursRemaining,
                    slaDeadline: bgvCase.slaDeadline,
                    candidateName: bgvCase.candidateId?.name
                },
                status: 'PENDING'
            };

            // Log email (actual sending would be done by email service)
            const emailLog = new BGVEmailLog(emailData);
            await emailLog.save();

            // Mark reminder as sent
            if (!bgvCase.slaRemindersSent) {
                bgvCase.slaRemindersSent = [];
            }
            bgvCase.slaRemindersSent.push(threshold);
            await bgvCase.save();

            console.log(`[SLA_REMINDER_SENT] Case: ${bgvCase.caseId}, Threshold: ${threshold}%`);

            return emailLog;
        } catch (error) {
            console.error('[SLA_REMINDER_ERROR]', error);
            throw error;
        }
    }

    /**
     * Escalate case due to SLA breach or other reasons
     */
    static async escalateCase(bgvCase, reason) {
        try {
            bgvCase.escalation = {
                isEscalated: true,
                escalatedAt: new Date(),
                escalationReason: reason,
                escalationLevel: (bgvCase.escalation?.escalationLevel || 0) + 1
            };

            // Change status to escalated if not already
            if (bgvCase.overallStatus !== 'ESCALATED') {
                bgvCase.overallStatus = 'ESCALATED';
            }

            await bgvCase.save();

            console.log(`[CASE_ESCALATED] Case: ${bgvCase.caseId}, Reason: ${reason}`);

            return bgvCase;
        } catch (error) {
            console.error('[ESCALATION_ERROR]', error);
            throw error;
        }
    }

    /**
     * Create SLA timeline entry
     */
    static async createSLATimelineEntry(BGVTimeline, caseId, tenantId, eventType, data) {
        const timelineEntry = new BGVTimeline({
            tenant: tenantId,
            caseId,
            eventType,
            title: this.getSLAEventTitle(eventType),
            description: data.message,
            metadata: data,
            visibleTo: ['ALL'],
            timestamp: new Date()
        });

        await timelineEntry.save();
        return timelineEntry;
    }

    /**
     * Get SLA event title
     */
    static getSLAEventTitle(eventType) {
        const titles = {
            'SLA_50_PERCENT': 'SLA Alert: 50% Elapsed',
            'SLA_80_PERCENT': 'SLA Warning: 80% Elapsed',
            'SLA_100_PERCENT': 'SLA Critical: 100% Elapsed',
            'SLA_BREACHED': 'SLA Breached',
            'SLA_ESCALATED': 'Case Escalated'
        };

        return titles[eventType] || 'SLA Event';
    }

    /**
     * Get SLA summary for dashboard
     */
    static async getSLASummary(tenantId) {
        try {
            const getTenantDB = require('../utils/tenantDB');
            const db = await getTenantDB(tenantId);

            const BGVCase = db.model('BGVCase');

            const summary = await BGVCase.aggregate([
                {
                    $match: {
                        tenant: tenantId,
                        isClosed: false
                    }
                },
                {
                    $group: {
                        _id: '$slaStatus',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const result = {
                ON_TRACK: 0,
                WARNING: 0,
                CRITICAL: 0,
                BREACHED: 0
            };

            summary.forEach(item => {
                if (item._id) {
                    result[item._id] = item.count;
                }
            });

            return result;
        } catch (error) {
            console.error('[SLA_SUMMARY_ERROR]', error);
            throw error;
        }
    }
}

module.exports = BGVSLAEngine;
