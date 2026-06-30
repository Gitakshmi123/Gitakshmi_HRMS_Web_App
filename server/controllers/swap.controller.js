const ShiftSwapRequestSchema = require('../models/ShiftSwapRequest');
const EmployeeRosterSchema = require('../models/EmployeeRoster');
const AuditLogSchema = require('../models/AuditLog');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        ShiftSwapRequest: db.model('ShiftSwapRequest', ShiftSwapRequestSchema),
        EmployeeRoster: db.model('EmployeeRoster', EmployeeRosterSchema),
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

/**
 * Get all pending shift swaps
 * GET /api/swaps/pending
 */
exports.getPendingSwaps = async (req, res) => {
    try {
        const { ShiftSwapRequest } = getModels(req);
        const tenantId = req.headers['x-tenant-id'];

        const swaps = await ShiftSwapRequest.find({ tenant: tenantId, status: 'Pending' })
            .populate('requesterId', 'firstName lastName employeeId profilePic')
            .populate('targetEmployeeId', 'firstName lastName employeeId profilePic')
            .lean();

        res.status(200).json({ success: true, data: swaps });
    } catch (error) {
        console.error('[GET_PENDING_SWAPS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * Approve or Reject a Shift Swap
 * POST /api/swaps/:id/action
 * Body: { action: 'Approved' | 'Rejected' }
 */
exports.actionSwap = async (req, res) => {
    try {
        const { ShiftSwapRequest, EmployeeRoster, AuditLog } = getModels(req);
        const tenantId = req.headers['x-tenant-id'];
        const { id } = req.params;
        const { action } = req.body;

        if (!['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const swap = await ShiftSwapRequest.findOne({ _id: id, tenant: tenantId });
        if (!swap) return res.status(404).json({ success: false, message: 'Swap request not found' });
        if (swap.status !== 'Pending') return res.status(400).json({ success: false, message: 'Swap is already processed' });

        swap.status = action;
        swap.approvedBy = req.user?.id;
        await swap.save();

        if (action === 'Approved') {
            // Swap the shifts in the roster
            const rosterA = await EmployeeRoster.findById(swap.originalRosterId);
            const rosterB = await EmployeeRoster.findById(swap.targetRosterId);

            if (rosterA && rosterB) {
                const shiftA = rosterA.shiftMasterId;
                const shiftB = rosterB.shiftMasterId;

                rosterA.shiftMasterId = shiftB;
                rosterA.generatedBy = 'Swap_Engine';
                rosterA.swapRequestId = swap._id;

                rosterB.shiftMasterId = shiftA;
                rosterB.generatedBy = 'Swap_Engine';
                rosterB.swapRequestId = swap._id;

                await rosterA.save();
                await rosterB.save();

                // Audit Log
                if (req.user) {
                    await new AuditLog({
                        tenant: req.tenantId,
                        entity: 'EmployeeRoster',
                        entityId: rosterA._id,
                        action: 'SHIFT_SWAPPED',
                        performedBy: req.user.id,
                        meta: { swapRequestId: swap._id, targetRosterId: rosterB._id }
                    }).save();
                }
            }
        }

        res.status(200).json({ success: true, message: `Swap request ${action.toLowerCase()} successfully`, data: swap });
    } catch (error) {
        console.error('[ACTION_SWAP_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
