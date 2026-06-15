const canonicalPayroll = require('../services/canonicalPayroll.service');
const payrollService = require('../services/payroll.service');

/**
 * Get models from tenant database
 */
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error('Tenant database connection not available');
    }
    try {
        return {
            DeductionMaster: req.tenantDB.model('DeductionMaster'),
            EmployeeDeduction: req.tenantDB.model('EmployeeDeduction')
        };
    } catch (err) {
        console.error('[getModels] Error retrieving models in deduction.controller:', err.message);
        throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
    }
}

function normalizeTenantId(req) {
    return req.tenantId || req.user?.tenantId || null;
}

function normalizeDateValue(value, fallback = null) {
    if (!value) return fallback;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function serializeEmployeeAssignment(record = {}) {
    const assignment = typeof record?.toObject === 'function' ? record.toObject() : record;
    const master = assignment?.deductionId || {};
    return {
        _id: assignment?._id || null,
        employeeId: assignment?.employeeId || null,
        deductionId: master?._id || assignment?.deductionId || null,
        name: assignment?.nameSnapshot || master?.name || 'Employee Deduction',
        category: assignment?.categoryOverride || master?.category || 'POST_TAX',
        amountType: assignment?.amountTypeOverride || master?.amountType || 'FIXED',
        amountValue: assignment?.customValue !== null && assignment?.customValue !== undefined
            ? assignment.customValue
            : master?.amountValue,
        calculationBase: assignment?.calculationBaseOverride || master?.calculationBase || 'GROSS',
        deductionType: assignment?.deductionType || master?.deductionType || 'RECURRING',
        statutoryCategory: master?.statutoryCategory || 'OTHER',
        recurring: master?.recurring !== false,
        startDate: assignment?.startDate || null,
        endDate: assignment?.endDate || null,
        customValue: assignment?.customValue ?? null,
        installmentAmount: assignment?.installmentAmount ?? null,
        remainingInstallments: assignment?.remainingInstallments ?? null,
        status: assignment?.status || 'ACTIVE',
        source: assignment?.source || 'MASTER',
        notes: assignment?.notes || '',
        metadata: assignment?.metadata || {},
        master
    };
}

/**
 * @desc Create a new deduction master
 * @route POST /api/deductions/create
 */
exports.createDeduction = async (req, res) => {
    try {
        // console.log('📥 [CREATE DEDUCTION] Request Body:', JSON.stringify(req.body, null, 2));

        // Validate tenant context
        const tenantId = req.tenantId || req.user?.tenantId;

        if (!tenantId) {
            console.error('❌ [CREATE DEDUCTION] Unauthorized: tenantId missing in req or req.user');
            return res.status(401).json({ success: false, error: "unauthorized", message: "Tenant context not found. Please re-login." });
        }

        // console.log('👤 [CREATE DEDUCTION] Tenant ID:', tenantId);

        if (!req.tenantDB) {
            console.error('❌ [CREATE DEDUCTION] Database Unavailable');
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { DeductionMaster } = getModels(req);
        const { name, category, amountType, amountValue, calculationBase, recurring } = req.body;

        if (!name || !category) {
            console.error('❌ [CREATE DEDUCTION] Missing Name or Category');
            return res.status(400).json({ success: false, error: 'Name and category are required' });
        }

        const existing = await DeductionMaster.findOne({ tenantId, name });
        if (existing) {
            console.warn('⚠️ [CREATE DEDUCTION] Duplicate Name:', name);
            return res.status(400).json({ success: false, error: 'Deduction with this name already exists for this tenant.' });
        }

        const deduction = new DeductionMaster({
            tenantId,
            name,
            category,
            amountType,
            amountValue,
            calculationBase,
            recurring,
            createdBy: req.user._id || req.user.id
        });

        await deduction.save();
        // console.log('✅ [CREATE DEDUCTION] Saved Successfully:', deduction._id);
        res.status(201).json({ success: true, data: deduction });
    } catch (err) {
        console.error('❌ [CREATE DEDUCTION] CRITICAL ERROR:', err.message);
        console.error('❌ [CREATE DEDUCTION] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message, details: err.stack });
    }
};

/**
 * @desc Get all deductions for a tenant
 * @route GET /api/deductions
 */
exports.getDeductions = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { DeductionMaster } = getModels(req);
        const { category, recurring } = req.query;

        const filter = { tenantId };
        if (category) filter.category = category;
        if (recurring !== undefined) filter.recurring = recurring === 'true';

        const deductions = await DeductionMaster.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: deductions });
    } catch (err) {
        console.error('❌ [GET DEDUCTIONS] Error:', err);
        console.error('❌ [GET DEDUCTIONS] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * @desc Update a deduction master
 */
exports.updateDeduction = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { DeductionMaster } = getModels(req);
        const { id } = req.params;

        const deduction = await DeductionMaster.findOneAndUpdate(
            { _id: id, tenantId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!deduction) {
            return res.status(404).json({ success: false, error: 'Deduction not found.' });
        }

        res.status(200).json({ success: true, data: deduction });
    } catch (err) {
        console.error('❌ [UPDATE DEDUCTION] Error:', err);
        console.error('❌ [UPDATE DEDUCTION] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * @desc Update deduction status
 */
exports.updateStatus = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { DeductionMaster } = getModels(req);
        const { id } = req.params;
        const { isActive } = req.body;

        const deduction = await DeductionMaster.findOneAndUpdate(
            { _id: id, tenantId },
            { isActive },
            { new: true }
        );

        if (!deduction) {
            return res.status(404).json({ success: false, error: 'Deduction not found.' });
        }

        res.status(200).json({ success: true, data: deduction });
    } catch (err) {
        console.error('❌ [UPDATE DEDUCTION STATUS] Error:', err);
        console.error('❌ [UPDATE DEDUCTION STATUS] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * @desc Assign deduction to an employee
 */
exports.assignToEmployee = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = normalizeTenantId(req);
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { DeductionMaster, EmployeeDeduction } = getModels(req);
        const {
            employeeId,
            deductionId,
            startDate,
            endDate,
            customValue,
            deductionType,
            source,
            categoryOverride,
            amountTypeOverride,
            calculationBaseOverride,
            installmentAmount,
            remainingInstallments,
            metadata,
            notes
        } = req.body;

        const master = await DeductionMaster.findOne({ _id: deductionId, tenantId });
        if (!master) {
            return res.status(404).json({ success: false, error: 'Deduction master not found.' });
        }

        const normalizedStartDate = normalizeDateValue(startDate);
        const normalizedEndDate = normalizeDateValue(endDate, null);
        if (!normalizedStartDate) {
            return res.status(400).json({ success: false, error: 'A valid start date is required.' });
        }
        if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
            return res.status(400).json({ success: false, error: 'End date cannot be before start date.' });
        }

        const duplicate = await EmployeeDeduction.findOne({
            tenantId,
            employeeId,
            deductionId,
            status: { $in: ['ACTIVE', 'COMPLETED'] },
            startDate: normalizedStartDate
        }).lean();
        if (duplicate) {
            return res.status(409).json({ success: false, error: 'A deduction assignment for this employee already exists on the same start date.' });
        }

        const assignment = new EmployeeDeduction({
            tenantId,
            employeeId,
            deductionId,
            startDate: normalizedStartDate,
            endDate: normalizedEndDate,
            customValue,
            deductionType: deductionType || master.deductionType || 'RECURRING',
            source: source || 'MASTER',
            nameSnapshot: master.name,
            categoryOverride: categoryOverride || null,
            amountTypeOverride: amountTypeOverride || null,
            calculationBaseOverride: calculationBaseOverride || null,
            installmentAmount: installmentAmount ?? null,
            remainingInstallments: remainingInstallments ?? null,
            metadata: metadata || {},
            notes: notes || ''
        });

        await assignment.save();
        const populated = await EmployeeDeduction.findById(assignment._id).populate('deductionId').lean();
        res.status(201).json({ success: true, data: serializeEmployeeAssignment(populated) });
    } catch (err) {
        console.error('❌ [ASSIGN DEDUCTION] Error:', err);
        console.error('❌ [ASSIGN DEDUCTION] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * @desc Get employee assignments
 */
exports.getEmployeeDeductions = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = normalizeTenantId(req);
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { EmployeeDeduction } = getModels(req);
        const { employeeId } = req.params;

        const deductions = await EmployeeDeduction.find({ tenantId, employeeId })
            .populate('deductionId')
            .sort({ startDate: -1 });

        res.status(200).json({ success: true, data: deductions.map((item) => serializeEmployeeAssignment(item)) });
    } catch (err) {
        console.error('❌ [GET EMPLOYEE DEDUCTIONS] Error:', err);
        console.error('❌ [GET EMPLOYEE DEDUCTIONS] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateEmployeeDeduction = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = normalizeTenantId(req);
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { EmployeeDeduction } = getModels(req);
        const { assignmentId } = req.params;
        const payload = { ...req.body };
        if (payload.startDate) {
            payload.startDate = normalizeDateValue(payload.startDate);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'endDate')) {
            payload.endDate = normalizeDateValue(payload.endDate, null);
        }
        if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
            return res.status(400).json({ success: false, error: 'End date cannot be before start date.' });
        }

        const assignment = await EmployeeDeduction.findOneAndUpdate(
            { _id: assignmentId, tenantId },
            payload,
            { new: true, runValidators: true }
        ).populate('deductionId');

        if (!assignment) {
            return res.status(404).json({ success: false, error: 'Employee deduction assignment not found.' });
        }

        res.status(200).json({ success: true, data: serializeEmployeeAssignment(assignment) });
    } catch (err) {
        console.error('❌ [UPDATE EMPLOYEE DEDUCTION] Error:', err);
        console.error('❌ [UPDATE EMPLOYEE DEDUCTION] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteEmployeeDeduction = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = normalizeTenantId(req);
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { EmployeeDeduction } = getModels(req);
        const { assignmentId } = req.params;
        const deleted = await EmployeeDeduction.findOneAndDelete({ _id: assignmentId, tenantId });

        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Employee deduction assignment not found.' });
        }

        res.status(200).json({ success: true, message: 'Employee deduction assignment deleted successfully.' });
    } catch (err) {
        console.error('❌ [DELETE EMPLOYEE DEDUCTION] Error:', err);
        console.error('❌ [DELETE EMPLOYEE DEDUCTION] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getEmployeeDeductionPlan = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = normalizeTenantId(req);
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { employeeId } = req.params;
        const effectiveDate = normalizeDateValue(req.query.date, new Date());
        const compensation = await canonicalPayroll.resolveEffectiveSalaryVersion(
            req.tenantDB,
            tenantId,
            employeeId,
            effectiveDate,
            effectiveDate
        );

        const plan = await payrollService.getUnifiedEmployeeDeductionPlan(
            req.tenantDB,
            tenantId,
            employeeId,
            effectiveDate,
            effectiveDate,
            compensation?.components || []
        );

        res.status(200).json({
            success: true,
            data: {
                effectiveDate,
                salaryVersion: compensation ? canonicalPayroll.buildSalarySourceSnapshot(compensation) : null,
                ...plan
            }
        });
    } catch (err) {
        console.error('❌ [GET EMPLOYEE DEDUCTION PLAN] Error:', err);
        console.error('❌ [GET EMPLOYEE DEDUCTION PLAN] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};
// ... existing code ...

/**
 * @desc Delete a deduction master
 * @route DELETE /api/deductions/:id
 */
exports.deleteDeduction = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context not found" });
        }

        const tenantId = req.user.tenantId;
        if (!req.tenantDB) {
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database not available" });
        }

        const { DeductionMaster } = getModels(req);
        const { id } = req.params;

        const deduction = await DeductionMaster.findOneAndDelete({ _id: id, tenantId });

        if (!deduction) {
            return res.status(404).json({ success: false, error: 'Deduction not found.' });
        }

        res.status(200).json({ success: true, message: 'Deduction deleted successfully.' });
    } catch (err) {
        console.error('❌ [DELETE DEDUCTION] Error:', err);
        console.error('❌ [DELETE DEDUCTION] Stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
};
