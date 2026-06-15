const ActivityLog = require('../models/ActivityLog');

/**
 * Global Activity Logger for Super Admin actions
 */
const logActivity = async ({
    actionType,
    message,
    tenantId,
    companyName,
    performedBy,
    metadata
}) => {
    try {
        await ActivityLog.create({
            actionType,
            message,
            tenantId,
            companyName,
            performedBy,
            metadata
        });
    } catch (err) {
        console.error("[ActivityLogger] Error logging activity:", err.message);
        // We don't throw error to avoid breaking the main business flow
    }
};

module.exports = { logActivity };
