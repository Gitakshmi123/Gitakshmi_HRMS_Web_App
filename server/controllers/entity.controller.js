const { checkEntityAccess } = require('../utils/accessControl');

exports.getEntityDetails = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { tenantDB } = req;

        // Validation
        const hasAccess = await checkEntityAccess(req, entityType, entityId);
        if (!hasAccess) {
            return res.status(403).json({ error: "Access denied to this entity." });
        }

        // Get the model
        let Model;
        try {
            Model = tenantDB.model(entityType);
        } catch (e) {
            // Normalize entityType and handle common aliases (e.g., Application vs Applicant)
            let normalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    
            // Explicit Alias Mapping
            if (normalizedType === 'Application') normalizedType = 'Applicant';

            try {
                Model = tenantDB.model(normalizedType);
            } catch (err) {
                return res.status(404).json({ error: `Model ${entityType} not found` });
            }
        }

        const entity = await Model.findById(entityId);

        if (!entity) {
            return res.status(404).json({ error: "Entity not found" });
        }

        // Dynamically populate if fields exist in schema
        if (Model.schema.paths.employee) {
            await entity.populate({ path: 'employee', select: 'firstName lastName email profilePic' });
        }
        if (Model.schema.paths.user) {
            await entity.populate({ path: 'user', select: 'name email' });
        }
        if (Model.schema.paths.approver) {
            await entity.populate({ path: 'approver', select: 'firstName lastName email profilePic' });
        }

        res.json(entity);
    } catch (error) {
        console.error(`[getEntityDetails] Error:`, error);
        res.status(500).json({ error: error.message });
    }
};

exports.checkAccess = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const hasAccess = await checkEntityAccess(req, entityType, entityId);
        if (!hasAccess) return res.status(403).json({ hasAccess: false });
        res.json({ hasAccess: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
