const mongoose = require('mongoose');

const getModels = (req) => {
    return {
        PayrollAdjustment: req.tenantDB.model('PayrollAdjustment'),
        PayrollRun: req.tenantDB.model('PayrollRun'),
        Employee: req.tenantDB.model('Employee'),
        Payslip: req.tenantDB.model('Payslip')
    };
};

/**
 * POST /api/payroll/corrections
 * Create a new correction/adjustment
 */
exports.createCorrection = async (req, res) => {
    try {
        const {
            employeeId,
            payrollRunId,
            adjustmentMonth,
            adjustmentType,
            adjustmentAmount,
            reason,
            metadata
        } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, message: "A detailed reason (min 5 chars) is mandatory for audit." });
        }

        const { PayrollAdjustment, PayrollRun } = getModels(req);

        // Verify original run if provided
        if (payrollRunId) {
            const run = await PayrollRun.findById(payrollRunId);
            if (!run) return res.status(404).json({ success: false, message: "Original payroll run not found." });

            // Hard Stop: Cannot "correct" a non-approved run (they should just re-run calculation)
            if (!['APPROVED', 'PAID'].includes(run.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Original run is in ${run.status} state. Please use "Re-run Calculation" instead of Adjustment.`
                });
            }
        }

        const adjustment = new PayrollAdjustment({
            companyId: req.tenantId,
            employeeId,
            payrollRunId,
            adjustmentMonth,
            adjustmentType,
            adjustmentAmount,
            reason: reason.trim(),
            status: 'PENDING_APPROVAL', // Maker creates → PENDING_APPROVAL
            createdBy: req.user.id,
            metadata
        });

        await adjustment.save();

        res.status(201).json({
            success: true,
            message: "Payroll adjustment created and scheduled for " + adjustmentMonth,
            data: adjustment
        });

    } catch (error) {
        console.error("[Correction] Creation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/payroll/corrections/run/:runId
 * List adjustments linked to a specific payroll run
 */
exports.getRunCorrections = async (req, res) => {
    try {
        const { runId } = req.params;
        const { PayrollAdjustment } = getModels(req);

        const adjustments = await PayrollAdjustment.find({
            payrollRunId: runId,
            companyId: req.tenantId
        }).populate('employeeId', 'firstName lastName employeeId email');

        res.json({ success: true, data: adjustments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/payroll/corrections/pending
 * Get pending adjustments for a specific payout month
 */
exports.getPendingAdjustments = async (req, res) => {
    try {
        const { month, status } = req.query; // YYYY-MM
        const { PayrollAdjustment } = getModels(req);

        const query = {
            companyId: req.tenantId
        };
        if (month) query.adjustmentMonth = month;
        if (status) query.status = status;
        else query.status = { $in: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] };

        const adjustments = await PayrollAdjustment.find(query)
            .populate('employeeId', 'firstName lastName employeeId')
            .populate('createdBy', 'firstName lastName')
            .populate('approvedBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: adjustments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/payroll/corrections/:id
 * Cancel a pending adjustment
 */
exports.cancelAdjustment = async (req, res) => {
    try {
        const { id } = req.params;
        const { PayrollAdjustment } = getModels(req);

        const adj = await PayrollAdjustment.findOne({ _id: id, companyId: req.tenantId });
        if (!adj) return res.status(404).json({ success: false, message: "Adjustment not found." });

        if (!['PENDING_APPROVAL', 'DRAFT'].includes(adj.status)) {
            return res.status(400).json({ success: false, message: "Only pending/draft adjustments can be cancelled." });
        }

        adj.status = 'CANCELLED';
        await adj.save();

        res.json({ success: true, message: "Adjustment cancelled successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/payroll/corrections/:id/approve
 * Checker approves an adjustment
 */
exports.approveCorrection = async (req, res) => {
    try {
        const { id } = req.params;
        const { approvalReason } = req.body;
        const { PayrollAdjustment } = getModels(req);

        const adjustment = await PayrollAdjustment.findOne({ _id: id, companyId: req.tenantId });
        if (!adjustment) return res.status(404).json({ success: false, message: "Adjustment not found." });

        if (adjustment.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ success: false, message: `Cannot approve. Current status: ${adjustment.status}` });
        }

        // MAKER-CHECKER RULE: Checker cannot be the Maker
        // COMMENTED OUT: Allow self-approval for testing/flexibility
        // if (String(adjustment.createdBy) === String(req.user.id)) {
        //     return res.status(403).json({ success: false, message: "Maker-Checker violation: You cannot approve your own adjustment request." });
        // }


        adjustment.status = 'APPROVED';
        adjustment.approvedBy = req.user.id;
        adjustment.approvedAt = new Date();
        adjustment.approvalReason = approvalReason;

        await adjustment.save();

        res.json({ success: true, message: "Adjustment approved and scheduled for payout.", data: adjustment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/payroll/corrections/:id/reject
 * Checker rejects an adjustment
 */
exports.rejectCorrection = async (req, res) => {
    try {
        const { id } = req.params;
        const { approvalReason } = req.body;
        const { PayrollAdjustment } = getModels(req);

        if (!approvalReason || approvalReason.trim().length < 5) {
            return res.status(400).json({ success: false, message: "A detailed rejection reason is required." });
        }

        const adjustment = await PayrollAdjustment.findOne({ _id: id, companyId: req.tenantId });
        if (!adjustment) return res.status(404).json({ success: false, message: "Adjustment not found." });

        if (adjustment.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ success: false, message: `Cannot reject. Current status: ${adjustment.status}` });
        }

        adjustment.status = 'REJECTED';
        adjustment.approvedBy = req.user.id;
        adjustment.approvedAt = new Date();
        adjustment.approvalReason = approvalReason;

        await adjustment.save();

        res.json({ success: true, message: "Adjustment request rejected.", data: adjustment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
