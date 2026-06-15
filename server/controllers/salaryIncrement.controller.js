const salaryIncrementService = require('../services/salaryIncrement.service');

/**
 * ============================================
 * SALARY INCREMENT CONTROLLER
 * ============================================
 * 
 * ENDPOINTS:
 * - POST /api/compensation/increment - Create new increment/revision
 * - GET /api/compensation/increment/history/:employeeId - Get increment history
 * - POST /api/compensation/increment/:id/cancel - Cancel scheduled increment
 * - GET /api/compensation/increment/preview - Preview increment changes
 * 
 * SAFETY RULES:
 * - Never modifies existing salary records
 * - Only creates new versions
 * - Full validation before save
 * - Complete audit trail
 */

/**
 * POST /api/compensation/increment
 * Create salary increment/revision
 * 
 * Body:
 * {
 *   employeeId: String (required),
 *   effectiveFrom: Date (required),
 *   totalCTC: Number (required),
 *   grossA: Number,
 *   grossB: Number,
 *   grossC: Number,
 *   components: Array,
 *   incrementType: 'INCREMENT' | 'REVISION' | 'PROMOTION',
 *   reason: String,
 *   notes: String
 * }
 */
exports.createIncrement = async (req, res) => {
    try {
        const {
            employeeId,
            effectiveFrom,
            totalCTC,
            grossA,
            grossB,
            grossC,
            components,
            incrementType,
            reason,
            notes
        } = req.body;

        // Validation
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        if (!effectiveFrom) {
            return res.status(400).json({
                success: false,
                message: 'Effective From date is required'
            });
        }

        if (!totalCTC || totalCTC <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid Total CTC is required'
            });
        }

        // Create increment
        const result = await salaryIncrementService.createIncrement(req.tenantDB, {
            employeeId,
            effectiveFrom,
            totalCTC,
            grossA,
            grossB,
            grossC,
            components,
            incrementType: incrementType || 'INCREMENT',
            reason,
            notes,
            createdBy: req.user.id || req.user._id,
            companyId: req.user.tenantId
        });

        res.json({
            success: true,
            message: `Salary ${result.status === 'ACTIVE' ? 'increment activated' : 'increment scheduled'} successfully`,
            data: {
                increment: result.increment,
                newVersion: {
                    version: result.newCtcVersion.version,
                    totalCTC: result.newCtcVersion.totalCTC,
                    effectiveFrom: result.newCtcVersion.effectiveFrom,
                    status: result.status
                },
                previousVersion: {
                    version: result.previousVersion.version,
                    totalCTC: result.previousVersion.totalCTC
                },
                change: result.change,
                status: result.status,
                message: result.status === 'ACTIVE'
                    ? 'Increment is now active and will be used for payroll'
                    : `Increment scheduled for ${new Date(effectiveFrom).toLocaleDateString()}`
            }
        });

    } catch (error) {
        console.error('Create Increment Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create increment'
        });
    }
};

/**
 * GET /api/compensation/increment/history/:employeeId
 * Get increment history for employee
 */
exports.getIncrementHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        const history = await salaryIncrementService.getIncrementHistory(
            req.tenantDB,
            employeeId
        );

        res.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('Get Increment History Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch increment history'
        });
    }
};

/**
 * POST /api/compensation/increment/:id/cancel
 * Cancel a scheduled increment
 * 
 * Body:
 * {
 *   reason: String (required)
 * }
 */
exports.cancelIncrement = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        const increment = await salaryIncrementService.cancelIncrement(
            req.tenantDB,
            id,
            req.user.id || req.user._id,
            reason
        );

        res.json({
            success: true,
            message: 'Increment cancelled successfully',
            data: increment
        });

    } catch (error) {
        console.error('Cancel Increment Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel increment'
        });
    }
};

/**
 * GET /api/compensation/increment/preview
 * Preview increment changes before saving
 * 
 * Query params:
 * - employeeId: String
 * - newCTC: Number
 */
exports.previewIncrement = async (req, res) => {
    try {
        const { employeeId, newCTC } = req.query;

        if (!employeeId || !newCTC) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID and new CTC are required'
            });
        }

        const currentSalary = await salaryIncrementService.getCurrentSalary(
            req.tenantDB,
            employeeId
        );

        if (!currentSalary) {
            return res.status(404).json({
                success: false,
                message: 'Employee has no existing salary'
            });
        }

        const newCTCNum = parseFloat(newCTC);
        const absoluteChange = newCTCNum - currentSalary.totalCTC;
        const percentageChange = ((absoluteChange / currentSalary.totalCTC) * 100).toFixed(2);

        res.json({
            success: true,
            data: {
                current: {
                    version: currentSalary.version,
                    totalCTC: currentSalary.totalCTC,
                    grossA: currentSalary.grossA,
                    grossB: currentSalary.grossB,
                    grossC: currentSalary.grossC,
                    effectiveFrom: currentSalary.effectiveFrom
                },
                proposed: {
                    totalCTC: newCTCNum,
                    absoluteChange,
                    percentageChange: parseFloat(percentageChange),
                    nextVersion: currentSalary.version + 1
                },
                recommendation: absoluteChange > 0
                    ? 'Increment recommended'
                    : absoluteChange < 0
                        ? 'Salary reduction - requires special approval'
                        : 'No change in CTC'
            }
        });

    } catch (error) {
        console.error('Preview Increment Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to preview increment'
        });
    }
};

/**
 * POST /api/compensation/increment/activate-scheduled
 * Manually trigger activation of scheduled increments
 * (Normally runs via cron, but can be triggered manually)
 */
exports.activateScheduled = async (req, res) => {
    try {
        const result = await salaryIncrementService.activateScheduledIncrements(
            req.tenantDB
        );

        res.json({
            success: true,
            message: `Activated ${result.activated} scheduled increment(s)`,
            data: result
        });

    } catch (error) {
        console.error('Activate Scheduled Increments Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to activate scheduled increments'
        });
    }
};

module.exports = exports;
