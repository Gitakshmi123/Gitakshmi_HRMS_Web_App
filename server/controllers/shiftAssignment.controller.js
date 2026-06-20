const ShiftAssignmentSchema = require('../models/ShiftAssignment');
const AuditLogSchema = require('../models/AuditLog');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        ShiftAssignment: db.model('ShiftAssignment', ShiftAssignmentSchema),
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

// 1. CREATE ASSIGNMENT
exports.createAssignment = async (req, res) => {
    try {
        const { ShiftAssignment, AuditLog } = getModels(req);
        const { shiftMasterId, entityType, entityId, effectiveFrom, effectiveTo } = req.body;

        const newAssignment = new ShiftAssignment({
            tenant: req.tenantId,
            shiftMasterId,
            entityType,
            entityId: entityType === 'Company' ? null : entityId,
            effectiveFrom,
            effectiveTo,
            assignedBy: req.user ? req.user.id : null
        });

        await newAssignment.save();

        if (req.user) {
            const auditLog = new AuditLog({
                tenant: req.tenantId,
                entity: 'ShiftAssignment',
                entityId: newAssignment._id,
                action: 'SHIFT_ASSIGNED',
                performedBy: req.user.id,
                meta: { entityType, entityId, shiftMasterId }
            });
            await auditLog.save();
        }

        res.status(201).json({ success: true, message: "Shift Assigned Successfully", data: newAssignment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. GET ALL ASSIGNMENTS
exports.getAssignments = async (req, res) => {
    try {
        const { ShiftAssignment } = getModels(req);
        const assignments = await ShiftAssignment.find({ tenant: req.tenantId, isActive: true })
            .populate('shiftMasterId', 'name code type coreTiming')
            .sort({ createdAt: -1 });

        // Note: For a fully fledged Enterprise app, we would also populate Employee/Department details here,
        // but it requires a dynamic populate based on entityType. We'll handle it on the frontend for Phase 2 MVP.

        res.json({ success: true, data: assignments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. DELETE ASSIGNMENT (Soft Delete / Deactivate)
exports.deleteAssignment = async (req, res) => {
    try {
        const { ShiftAssignment } = getModels(req);
        const { id } = req.params;

        const assignment = await ShiftAssignment.findOneAndUpdate(
            { _id: id, tenant: req.tenantId },
            { isActive: false },
            { new: true }
        );

        if (!assignment) {
            return res.status(404).json({ success: false, error: "Assignment not found" });
        }

        res.json({ success: true, message: "Assignment Removed", data: assignment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
