const AuditLogSchema = require('../models/AuditLog');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

/**
 * Get Audit Logs for Shift Management Module
 * GET /api/audit-logs/shift
 */
exports.getShiftAuditLogs = async (req, res) => {
    try {
        const { AuditLog } = getModels(req);
        const tenantId = req.headers['x-tenant-id'];

        const logs = await AuditLog.find({ 
            tenant: tenantId,
            entity: { $in: ['ShiftMaster', 'EmployeeRoster'] }
        })
        .populate('performedBy', 'firstName lastName employeeId profilePic')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error('[GET_SHIFT_AUDIT_LOGS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
