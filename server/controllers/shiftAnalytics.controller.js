const ShiftMasterSchema = require('../models/ShiftMaster');
const ShiftAssignmentSchema = require('../models/ShiftAssignment');
const ShiftSwapRequestSchema = require('../models/ShiftSwapRequest');
const EmployeeRosterSchema = require('../models/EmployeeRoster');
const dayjs = require('dayjs');
const mongoose = require('mongoose');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        ShiftMaster: db.model('ShiftMaster', ShiftMasterSchema),
        ShiftAssignment: db.model('ShiftAssignment', ShiftAssignmentSchema),
        ShiftSwapRequest: db.model('ShiftSwapRequest', ShiftSwapRequestSchema),
        EmployeeRoster: db.model('EmployeeRoster', EmployeeRosterSchema)
    };
};

/**
 * Get aggregated dashboard statistics
 * GET /api/shift-analytics/dashboard
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const { ShiftMaster, ShiftAssignment, ShiftSwapRequest, EmployeeRoster } = getModels(req);
        const tenantId = req.headers['x-tenant-id'];

        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

        // 1. Shift Type Distribution
        const shiftDistribution = await ShiftMaster.aggregate([
            { $match: { tenant: tenantObjectId, status: 'Active' } },
            { $group: { _id: "$type", count: { $sum: 1 } } }
        ]);
        const shiftDistributionData = shiftDistribution.map(item => ({
            name: item._id,
            value: item.count
        }));

        // 2. Active Shift Assignments Count
        const totalAssignments = await ShiftAssignment.countDocuments({ tenant: tenantId, isActive: true });

        // 3. Swap Requests Analytics
        const swaps = await ShiftSwapRequest.aggregate([
            { $match: { tenant: tenantId } }, // Tenant in ShiftSwapRequest was defined as String
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const swapData = swaps.map(item => ({
            name: item._id,
            count: item.count
        }));

        const pendingSwaps = swapData.find(s => s.name === 'Pending')?.count || 0;

        // 4. Rosters for Current Month
        const startOfMonth = dayjs().startOf('month').toDate();
        const endOfMonth = dayjs().endOf('month').toDate();
        const currentMonthRosters = await EmployeeRoster.countDocuments({
            tenant: tenantId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        res.status(200).json({
            success: true,
            data: {
                totalActiveAssignments: totalAssignments,
                totalPendingSwaps: pendingSwaps,
                currentMonthRostersGenerated: currentMonthRosters,
                shiftDistribution: shiftDistributionData,
                swapAnalytics: swapData
            }
        });

    } catch (error) {
        console.error('[GET_DASHBOARD_STATS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
