const payrollService = require('../services/payroll.service');
const payrollPhase2 = require('../services/payrollPhase2.service');

/**
 * Get models from tenant database
 */
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error('Tenant database connection not available');
    }
    try {
        return {
            PayrollRun: req.tenantDB.model('PayrollRun'),
            Payslip: req.tenantDB.model('Payslip'),
            PayrollRunItem: req.tenantDB.model('PayrollRunItem'),
            Employee: req.tenantDB.model('Employee')
        };
    } catch (err) {
        console.error('[getModels] Error retrieving models in payrollRun.controller:', err.message);
        throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
    }
}

function getUserId(req) {
    return req.user?.id || req.user?._id || null;
}

function respondWithPayrollError(res, scope, error) {
    console.error(`[${scope}] Error:`, error);
    const statusCode = typeof payrollPhase2.getHttpStatusForError === 'function'
        ? payrollPhase2.getHttpStatusForError(error)
        : 500;
    const response = {
        success: false,
        error: error?.message || 'Internal server error'
    };
    if (statusCode < 500 && error?.code) {
        response.code = error.code;
    }
    if (statusCode < 500 && error?.details) {
        response.details = error.details;
    }
    return res.status(statusCode).json(response);
}

/**
 * Initiate a new payroll run
 * POST /api/payroll/runs
 */
exports.initiatePayrollRun = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const {
            month,
            year,
            isFiltered,
            filters,
            runType = 'FULL',
            selectedEmployeeIds = [],
            executionMode,
            payDate = null,
            inputBatchIds = [],
            attendancePolicy = 'STRICT',
            offCycleReason = '',
            offCycleLabel = '',
            amendmentOfRunId = null,
            approvalWorkflow = [],
            sequenceNo = null
        } = req.body;

        // Validate input
        if (!month || !year) {
            return res.status(400).json({ success: false, error: "Missing required fields: month and year are required" });
        }

        if (month < 1 || month > 12) {
            return res.status(400).json({ success: false, error: "Invalid month. Must be between 1 and 12" });
        }

        if (year < 2000 || year > 2100) {
            return res.status(400).json({ success: false, error: "Invalid year" });
        }

        const { PayrollRun, Employee } = getModels(req);

        const normalizedSelectedEmployeeIds = (Array.isArray(selectedEmployeeIds) ? selectedEmployeeIds : [selectedEmployeeIds]).filter(Boolean);
        const resolvedSequenceNo = sequenceNo || (runType === 'FULL' ? 1 : await payrollPhase2.getNextPayrollRunSequence(req.tenantDB, tenantId, month, year));

        // Check if payroll run already exists
        let payrollRun = await PayrollRun.findOne({ tenantId, month, year, sequenceNo: resolvedSequenceNo });

        if (payrollRun && ['APPROVED', 'PAID'].includes(payrollRun.status) && (payrollRun.processedEmployees || 0) > 0) {
            return res.status(400).json({
                success: false,
                error: "Payroll run finalized",
                message: `Payroll for ${month}/${year} is already ${payrollRun.status} and cannot be re-initiated.`
            });
        }

        const totalTenantEmployees = await Employee.countDocuments({ tenant: tenantId, status: 'Active' });

        if (!payrollRun) {
            // Create new payroll run
            payrollRun = new PayrollRun({
                tenantId,
                month,
                year,
                status: 'INITIATED',
                lifecycleState: 'DRAFT',
                initiatedBy: req.user.id || req.user._id,
                isFiltered: isFiltered || false,
                filters: filters || {},
                periodKey: payrollPhase2.formatPeriodKey(year, month),
                sequenceNo: resolvedSequenceNo,
                runCode: payrollPhase2.buildRunCode(year, month, resolvedSequenceNo, runType),
                runType,
                executionMode: executionMode || (runType === 'OFF_CYCLE' ? 'OFF_CYCLE' : runType === 'AMENDMENT' ? 'AMENDMENT' : 'MONTHLY'),
                selectedEmployeeIds: normalizedSelectedEmployeeIds,
                inputBatchIds: inputBatchIds || [],
                attendancePolicy,
                payDate,
                offCycleReason,
                offCycleLabel,
                amendmentOfRunId,
                approvalWorkflow: payrollPhase2.ensureApprovalWorkflow([], approvalWorkflow || [], executionMode || (runType === 'OFF_CYCLE' ? 'OFF_CYCLE' : runType === 'AMENDMENT' ? 'AMENDMENT' : 'MONTHLY')),
                totalTenantEmployees
            });
        } else {
            // Reset existing run to re-initiate
            payrollRun.status = 'INITIATED';
            payrollRun.lifecycleState = 'DRAFT';
            payrollRun.isFiltered = isFiltered || false;
            payrollRun.filters = filters || {};
            payrollRun.periodKey = payrollPhase2.formatPeriodKey(year, month);
            payrollRun.sequenceNo = resolvedSequenceNo;
            payrollRun.runCode = payrollPhase2.buildRunCode(year, month, resolvedSequenceNo, runType);
            payrollRun.runType = runType;
            payrollRun.executionMode = executionMode || (runType === 'OFF_CYCLE' ? 'OFF_CYCLE' : runType === 'AMENDMENT' ? 'AMENDMENT' : 'MONTHLY');
            payrollRun.selectedEmployeeIds = normalizedSelectedEmployeeIds;
            payrollRun.inputBatchIds = inputBatchIds || [];
            payrollRun.attendancePolicy = attendancePolicy;
            payrollRun.payDate = payDate;
            payrollRun.offCycleReason = offCycleReason || '';
            payrollRun.offCycleLabel = offCycleLabel || '';
            payrollRun.amendmentOfRunId = amendmentOfRunId || null;
            payrollRun.approvalWorkflow = payrollPhase2.ensureApprovalWorkflow(
                payrollRun.approvalWorkflow || [],
                approvalWorkflow || [],
                payrollRun.executionMode
            );
            payrollRun.totalTenantEmployees = totalTenantEmployees;
            payrollRun.initiatedAt = new Date();
            payrollRun.initiatedBy = req.user.id || req.user._id;
            // Clear stats
            payrollRun.totalGross = 0;
            payrollRun.totalNetPay = 0;
            payrollRun.totalDeductions = 0;
            payrollRun.processedEmployees = 0;
            payrollRun.totalEmployees = 0;
            payrollRun.failedEmployees = 0;
            payrollRun.executionErrors = [];
            payrollRun.approvalStatus = 'NOT_SUBMITTED';
            payrollRun.exportArtifactIds = [];
        }

        await payrollRun.save();

        res.status(201).json({
            success: true,
            data: payrollRun,
            message: isFiltered ? 'Filtered payroll run initiated successfully' : 'Payroll run initiated successfully'
        });

    } catch (error) {
        return respondWithPayrollError(res, 'initiatePayrollRun', error);
    }
};

/**
 * Calculate payroll (process all employees)
 * POST /api/payroll/runs/:id/calculate
 */
exports.calculatePayroll = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { id } = req.params;

        const { PayrollRun } = getModels(req);

        // Get payroll run
        const payrollRun = await PayrollRun.findOne({ _id: id, tenantId });
        if (!payrollRun) {
            return res.status(404).json({ success: false, error: "Payroll run not found" });
        }

        const canRecalculateRejectedRun =
            ['CALCULATED', 'CALCULATED_WITH_ERRORS'].includes(payrollRun.status)
            && payrollRun.approvalStatus === 'REJECTED';
        const canRecalculateErroredRun = payrollRun.status === 'CALCULATED_WITH_ERRORS';
        if (payrollRun.status !== 'INITIATED' && !canRecalculateRejectedRun && !canRecalculateErroredRun) {
            return res.status(400).json({
                success: false,
                error: "Invalid status",
                message: `Payroll run is already ${payrollRun.status}. Cannot calculate again until re-initiated or explicitly recalculated from an error/rejected state.`
            });
        }

        const preflight = await payrollService.preflightPayrollRun(
            req.tenantDB,
            tenantId,
            payrollRun.month,
            payrollRun.year,
            payrollRun._id,
            {
                selectedEmployeeIds: payrollRun.selectedEmployeeIds || [],
                runType: payrollRun.runType || 'FULL',
                executionMode: payrollRun.executionMode || 'MONTHLY',
                attendancePolicy: payrollRun.attendancePolicy || 'STRICT',
                inputBatchIds: payrollRun.inputBatchIds || []
            }
        );

        if (!preflight.canCalculate) {
            return res.status(400).json({
                success: false,
                error: "Payroll preflight failed",
                message: `Payroll cannot be calculated until ${preflight.blockers.length} blocker(s) are fixed.`,
                data: preflight
            });
        }

        // Run payroll calculation
        const result = await payrollService.runPayroll(
            req.tenantDB,
            tenantId,
            payrollRun.month,
            payrollRun.year,
            getUserId(req),
            {
                payrollRunId: payrollRun._id,
                runType: payrollRun.runType || 'FULL',
                executionMode: payrollRun.executionMode || 'MONTHLY',
                attendancePolicy: payrollRun.attendancePolicy || 'STRICT',
                selectedEmployeeIds: payrollRun.selectedEmployeeIds || [],
                inputBatchIds: payrollRun.inputBatchIds || [],
                payDate: payrollRun.payDate || null,
                offCycleReason: payrollRun.offCycleReason || '',
                offCycleLabel: payrollRun.offCycleLabel || '',
                approvalWorkflow: payrollRun.approvalWorkflow || [],
                sequenceNo: payrollRun.sequenceNo || 1,
                amendmentOfRunId: payrollRun.amendmentOfRunId || null
            }
        );

        res.json({
            success: true,
            data: result,
            message: `Payroll calculated successfully. Processed: ${result.processedEmployees}/${result.totalEmployees} employees.`
        });

    } catch (error) {
        return respondWithPayrollError(res, 'calculatePayroll', error);
    }
};

/**
 * Preflight payroll run
 * POST /api/payroll/runs/:id/preflight
 */
exports.preflightPayroll = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { id } = req.params;
        const { PayrollRun } = getModels(req);

        const payrollRun = await PayrollRun.findOne({ _id: id, tenantId });
        if (!payrollRun) {
            return res.status(404).json({ success: false, error: "Payroll run not found" });
        }

        const preflight = await payrollService.preflightPayrollRun(
            req.tenantDB,
            tenantId,
            payrollRun.month,
            payrollRun.year,
            payrollRun._id,
            {
                selectedEmployeeIds: payrollRun.selectedEmployeeIds || [],
                runType: payrollRun.runType || 'FULL',
                executionMode: payrollRun.executionMode || 'MONTHLY',
                attendancePolicy: payrollRun.attendancePolicy || 'STRICT',
                inputBatchIds: payrollRun.inputBatchIds || []
            }
        );

        res.json({
            success: true,
            data: preflight,
            message: preflight.canCalculate
                ? 'Payroll preflight passed'
                : `Payroll preflight found ${preflight.blockers.length} blocker(s)`
        });
    } catch (error) {
        return respondWithPayrollError(res, 'preflightPayroll', error);
    }
};

/**
 * Approve payroll run
 * POST /api/payroll/runs/:id/approve
 */
exports.approvePayroll = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { id } = req.params;
        const approvedBy = getUserId(req);

        const approvedRun = await payrollPhase2.forceApprovePayrollRun(
            req.tenantDB,
            tenantId,
            id,
            approvedBy,
            req.body?.comment || ''
        );

        res.json({
            success: true,
            data: approvedRun,
            message: 'Payroll approved successfully'
        });

    } catch (error) {
        return respondWithPayrollError(res, 'approvePayroll', error);
    }
};

/**
 * Mark payroll as paid
 * POST /api/payroll/runs/:id/mark-paid
 */
exports.markPayrollPaid = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { id } = req.params;

        const { PayrollRun, Payslip, PayrollRunItem } = getModels(req);
        const paidBy = getUserId(req);

        // Get payroll run
        const payrollRun = await PayrollRun.findOne({ _id: id, tenantId });
        if (!payrollRun) {
            return res.status(404).json({ success: false, error: "Payroll run not found" });
        }

        if (payrollRun.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: "Invalid status",
                message: `Payroll run status must be APPROVED. Current status: ${payrollRun.status}`
            });
        }

        // Update status
        payrollRun.status = 'PAID';
        payrollRun.lifecycleState = 'PAID';
        payrollRun.paidBy = paidBy;
        payrollRun.paidAt = new Date();
        await payrollRun.save();

        await Promise.all([
            Payslip.updateMany(
                { tenantId, payrollRunId: payrollRun._id, status: { $in: ['APPROVED', 'LOCKED'] } },
                {
                    $set: {
                        status: 'PAID',
                        paidAt: payrollRun.paidAt
                    }
                }
            ),
            PayrollRunItem.updateMany(
                { tenantId, payrollRunId: payrollRun._id, status: { $in: ['GENERATED', 'LOCKED'] } },
                { $set: { status: 'PAID' } }
            )
        ]);

        res.json({
            success: true,
            data: payrollRun,
            message: 'Payroll marked as paid successfully'
        });

    } catch (error) {
        return respondWithPayrollError(res, 'markPayrollPaid', error);
    }
};

/**
 * Get all payroll runs
 * GET /api/payroll/runs
 */
exports.getPayrollRuns = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { status, year } = req.query;

        const { PayrollRun } = getModels(req);

        const filter = { tenantId };
        if (status) filter.status = status;
        if (year) filter.year = parseInt(year);

        const payrollRuns = await PayrollRun.find(filter)
            .populate('initiatedBy', 'firstName lastName employeeId')
            .populate('calculatedBy', 'firstName lastName employeeId')
            .populate('approvedBy', 'firstName lastName employeeId')
            .populate('paidBy', 'firstName lastName employeeId')
            .sort({ year: -1, month: -1, sequenceNo: -1 });

        res.json({
            success: true,
            data: payrollRuns
        });

    } catch (error) {
        return respondWithPayrollError(res, 'getPayrollRuns', error);
    }
};

/**
 * Get payroll run by ID
 * GET /api/payroll/runs/:id
 */
exports.getPayrollRunById = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { id } = req.params;

        const { PayrollRun, Payslip, PayrollRunItem } = getModels(req);

        // Get payroll run
        const payrollRun = await PayrollRun.findOne({ _id: id, tenantId })
            .populate('initiatedBy', 'firstName lastName employeeId')
            .populate('calculatedBy', 'firstName lastName employeeId')
            .populate('approvedBy', 'firstName lastName employeeId')
            .populate('paidBy', 'firstName lastName employeeId');

        if (!payrollRun) {
            return res.status(404).json({ success: false, error: "Payroll run not found" });
        }

        // Get payslips for this run
        const payslips = await Payslip.find({ tenantId, payrollRunId: id })
            .populate('employeeId', 'firstName lastName employeeId')
            .sort({ 'employeeInfo.employeeId': 1 });
        const runItems = await PayrollRunItem.find({ tenantId, payrollRunId: id })
            .populate('employeeId', 'firstName lastName employeeId')
            .sort({ createdAt: 1 });
        const exportArtifacts = await payrollPhase2.listRunExportArtifacts(req.tenantDB, tenantId, id);

        res.json({
            success: true,
            data: {
                payrollRun,
                payslips,
                runItems,
                exportArtifacts
            }
        });

    } catch (error) {
        return respondWithPayrollError(res, 'getPayrollRunById', error);
    }
};

/**
 * Cancel payroll run
 * POST /api/payroll/runs/:id/cancel
 */
exports.cancelPayrollRun = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { id } = req.params;

        const { PayrollRun, Payslip, PayrollRunItem } = getModels(req);

        // Get payroll run
        const payrollRun = await PayrollRun.findOne({ _id: id, tenantId });
        if (!payrollRun) {
            return res.status(404).json({ success: false, error: "Payroll run not found" });
        }

        if (['APPROVED', 'PAID'].includes(payrollRun.status)) {
            return res.status(400).json({
                success: false,
                error: "Payroll already finalized",
                message: "Approved or paid payroll runs cannot be cancelled. Create a payroll adjustment/amendment instead."
            });
        }

        if (['CALCULATED', 'CALCULATED_WITH_ERRORS', 'INITIATED', 'PROCESSING'].includes(payrollRun.status)) {
            await Promise.all([
                Payslip.deleteMany({ tenantId, payrollRunId: id, status: 'DRAFT' }),
                PayrollRunItem.deleteMany({ tenantId, payrollRunId: id })
            ]);
        }
        await payrollPhase2.releaseInputBatchReservations(req.tenantDB, tenantId, payrollRun._id);

        // Update status
        payrollRun.status = 'CANCELLED';
        payrollRun.lifecycleState = 'CANCELLED';
        await payrollRun.save();

        res.json({
            success: true,
            data: payrollRun,
            message: 'Payroll run cancelled successfully'
        });

    } catch (error) {
        return respondWithPayrollError(res, 'cancelPayrollRun', error);
    }
};

/**
 * GET /api/payroll/filteredEmployees
 * Fetch employees matching filters for payroll run
 */
exports.getFilteredEmployees = async (req, res) => {
    try {
        const { month, year, department, designation, employeeType, workMode } = req.query;

        if (!month || !year) {
            return res.status(400).json({ success: false, message: "Month and Year are required" });
        }

        const { Employee } = getModels(req);
        const tenantId = req.user.tenantId;

        const filter = { tenant: tenantId, status: { $in: ['Active', 'active', 'ACTIVE'] } };

        if (department && department !== 'All Departments') {
            filter.department = department;
        }

        if (designation && designation !== 'All Designations') {
            filter.designation = designation;
        }

        if (employeeType) {
            const types = Array.isArray(employeeType) ? employeeType : employeeType.split(',').filter(Boolean);
            if (types.length > 0) filter.employeeType = { $in: types };
        }

        if (workMode) {
            const modes = Array.isArray(workMode) ? workMode : workMode.split(',').filter(Boolean);
            if (modes.length > 0) filter.workMode = { $in: modes };
        }

        const employees = await Employee.find(filter)
            .select('firstName lastName employeeId department designation employeeType workMode joiningDate salaryTemplateId')
            .lean();

        // Optional: Get basic total count for context
        const totalCount = await Employee.countDocuments({ tenant: tenantId, status: { $in: ['Active', 'active', 'ACTIVE'] } });

        res.json({
            success: true,
            count: employees.length,
            totalTenantEmployees: totalCount,
            data: employees
        });

    } catch (error) {
        return respondWithPayrollError(res, 'getFilteredEmployees', error);
    }
};
