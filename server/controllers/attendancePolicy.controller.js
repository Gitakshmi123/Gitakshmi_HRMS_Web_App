const mongoose = require('mongoose');
const AttendanceSettingsSchema = require('../models/AttendanceSettings');
const AuditLogSchema = require('../models/AuditLog');

// Local getModels helper (mirrors attendance.controller pattern but scoped)
const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        AttendanceSettings: db.model('AttendanceSettings', AttendanceSettingsSchema),
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

/**
 * PUT /attendance-policy/update
 *
 * Non-breaking endpoint to update advanced attendance policy configuration.
 * - Persists into the same AttendanceSettings document used by /attendance/settings
 * - Only touches the advancedPolicy subtree + optionally weeklyOffDays
 * - Leaves existing basic settings intact for backward compatibility
 */
exports.updateAttendancePolicy = async (req, res) => {
    try {
        const { AttendanceSettings, AuditLog } = getModels(req);

        const tenantId = req.tenantId || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: 'tenant_missing', message: 'Tenant ID is required' });
        }

        const existing = await AttendanceSettings.findOne({ tenant: tenantId });
        const before = existing ? existing.toObject() : null;

        const payload = req.body || {};

        const update = {};

        if (payload.advancedPolicy) {
            update.advancedPolicy = payload.advancedPolicy;
        }

        // Optional: allow safe update of weeklyOffDays from policy UI
        if (Array.isArray(payload.weeklyOffDays)) {
            update.weeklyOffDays = payload.weeklyOffDays;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ error: 'no_fields', message: 'No policy fields supplied for update' });
        }

        update.updatedBy = req.user?.id || null;

        const settings = await AttendanceSettings.findOneAndUpdate(
            { tenant: tenantId },
            { $set: update },
            { new: true, upsert: true }
        );

        const auditLog = new AuditLog({
            tenant: tenantId,
            entity: 'AttendanceSettings',
            entityId: settings._id,
            action: 'ATTENDANCE_POLICY_UPDATED',
            performedBy: req.user?.id || null,
            changes: {
                before,
                after: settings.toObject()
            },
            meta: { via: 'attendance-policy/update' }
        });
        await auditLog.save();

        res.json({ message: 'Attendance policy updated', data: settings });
    } catch (error) {
        console.error('[ATTENDANCE_POLICY][UPDATE] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to update attendance policy' });
    }
};

