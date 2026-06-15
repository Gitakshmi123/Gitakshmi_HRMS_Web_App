const mongoose = require('mongoose');

/**
 * Checks if the user has access to a specific entity based on their role and relations.
 * This is a generic role-safe check for enterprise HRMS.
 */
const checkEntityAccess = async (req, ent ,ityType, entityId) => {
    const { user, tenantDB } = req;
    const { id: userId, role, tenantId } = user;

    // 1. Super Admin / PSA Access
    if (role === 'psa') return true;

    // 2. HR / Admin Access
    if (role === 'hr' || role === 'admin') return true;

    // Get the model for the entity
    let Model;
    try {
        Model = tenantDB.model(entityType);
    } catch (e) {
        const normalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
        try {
            Model = tenantDB.model(normalizedType);
        } catch (err) {
            return false;
        }
    }

    try {
        const entity = await Model.findOne({ _id: entityId, tenant: tenantId });
        if (!entity) return false;

        // 3. Ownership Check (Employee's own entities)
        const ownerId = entity.employee || entity.user || entity.receiverId;
        if (ownerId && ownerId.toString() === userId.toString()) return true;

        // 4. Manager Check (Can see direct reports' entities)
        if (ownerId) {
            const EmployeeModel = tenantDB.model('Employee');
            const ownerEmployee = await EmployeeModel.findById(ownerId).select('manager');

            if (ownerEmployee && ownerEmployee.manager && ownerEmployee.manager.toString() === userId.toString()) {
                return true;
            }
        }
    } catch (err) {
        console.error(`[checkEntityAccess] Database error:`, err);
        throw err;
    }

    return false;
};

module.exports = { checkEntityAccess };
