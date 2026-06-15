const crypto = require('crypto');
const mongoose = require('mongoose');
const PayrollInputBatchSchema = require('../models/PayrollInputBatch');
const PayrollExportArtifactSchema = require('../models/PayrollExportArtifact');
const ShiftAssignmentSchema = require('../models/ShiftAssignment');
const ShiftSchema = require('../models/Shift');

function getModel(db, name, schema) {
    try {
        return db.model(name, schema);
    } catch (_err) {
        return db.model(name);
    }
}

class PayrollLifecycleError extends Error {
    constructor(message, { code = 'PAYROLL_LIFECYCLE_ERROR', statusCode = 400, details = null } = {}) {
        super(message);
        this.name = 'PayrollLifecycleError';
        this.code = code;
        this.statusCode = statusCode;
        if (details && typeof details === 'object') {
            this.details = details;
        }
    }
}

function createLifecycleError(code, message, statusCode, details = null) {
    return new PayrollLifecycleError(message, { code, statusCode, details });
}

function lifecycleValidationError(code, message, details = null) {
    return createLifecycleError(code, message, 400, details);
}

function lifecycleNotFoundError(code, message, details = null) {
    return createLifecycleError(code, message, 404, details);
}

function lifecycleConflictError(code, message, details = null) {
    return createLifecycleError(code, message, 409, details);
}

function isPayrollLifecycleError(error) {
    return Boolean(
        error
        && error.name === 'PayrollLifecycleError'
        && Number.isInteger(error.statusCode)
    );
}

function getHttpStatusForError(error) {
    if (isPayrollLifecycleError(error)) {
        return error.statusCode;
    }
    return 500;
}

function normalizeActorId(value) {
    if (!value) return null;
    return String(value);
}

function sameActor(left, right) {
    const leftId = normalizeActorId(left);
    const rightId = normalizeActorId(right);
    return Boolean(leftId && rightId && leftId === rightId);
}

function parseBooleanConfig(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function isForceApprovalEnabled() {
    return parseBooleanConfig(process.env.PAYROLL_ALLOW_FORCE_APPROVAL);
}

function isDraftExportAllowed() {
    return parseBooleanConfig(process.env.PAYROLL_ALLOW_DRAFT_EXPORTS);
}

function normalizeRoleName(value = '') {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
        superadmin: 'super_admin',
        companysuperadmin: 'company_super_admin',
        company_superadmin: 'company_super_admin',
        companyadmin: 'company_admin',
        hradmin: 'hr_admin',
        hrmanager: 'hr_manager',
        financeadmin: 'finance_admin',
        financemanager: 'finance_manager'
    };
    return aliases[normalized] || normalized;
}

function normalizeApprovalRole(role = '') {
    return String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function roleMatchesApprovalStep(actorRole = '', requiredRole = '') {
    const actor = normalizeRoleName(actorRole);
    const required = normalizeApprovalRole(requiredRole);
    if (!required) return true;
    if (!actor) return false;

    const matchers = {
        HR: new Set(['hr', 'hr_admin', 'hr_manager', 'admin', 'company_admin', 'company_super_admin', 'super_admin', 'psa']),
        FINANCE: new Set(['finance', 'finance_admin', 'finance_manager', 'admin', 'company_admin', 'company_super_admin', 'super_admin', 'psa']),
        ADMIN: new Set(['admin', 'company_admin', 'company_super_admin', 'super_admin', 'psa']),
        PSA: new Set(['psa', 'super_admin'])
    };

    if (matchers[required]) {
        return matchers[required].has(actor);
    }

    return actor === normalizeRoleName(required);
}

function normalizeMoney(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
}

function roundMoney(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.round(numeric * 100) / 100;
}

function toObjectId(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    try {
        return new mongoose.Types.ObjectId(value);
    } catch (_err) {
        return null;
    }
}

function dedupeObjectIds(values = []) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        const objectId = toObjectId(value);
        if (!objectId) continue;
        const key = String(objectId);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(objectId);
    }
    return result;
}

function startOfDay(value) {
    const date = new Date(value || new Date());
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfDay(value) {
    const date = new Date(value || new Date());
    date.setHours(23, 59, 59, 999);
    return date;
}

function formatPeriodKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function getPeriodValue(year, month) {
    return (Number(year) * 100) + Number(month);
}

function getFinancialYearWindow(month, year) {
    const numericMonth = Number(month);
    const numericYear = Number(year);
    const fyStartYear = numericMonth >= 4 ? numericYear : numericYear - 1;
    const fyEndYear = fyStartYear + 1;
    return {
        start: new Date(Date.UTC(fyStartYear, 3, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(fyEndYear, 2, 31, 23, 59, 59, 999)),
        label: `FY${fyStartYear}-${String(fyEndYear).slice(-2)}`
    };
}

function buildRunCode(year, month, sequenceNo = 1, runType = 'FULL') {
    const typeCodeMap = {
        FULL: 'RUN',
        SELECTED: 'SEL',
        OFF_CYCLE: 'OFF',
        AMENDMENT: 'AMD'
    };
    const typeCode = typeCodeMap[runType] || 'RUN';
    return `${formatPeriodKey(year, month)}-${typeCode}-${String(sequenceNo).padStart(2, '0')}`;
}

function calculateBatchItemAmount(item = {}) {
    const explicitAmount = normalizeMoney(item.amount, null);
    if (explicitAmount !== null && explicitAmount !== undefined && explicitAmount !== 0) {
        return explicitAmount;
    }

    const quantity = normalizeMoney(item.quantity, 1);
    const rate = normalizeMoney(item.rate, 0);
    return roundMoney(quantity * rate, 0);
}

function summarizeInputItems(items = []) {
    const employeeSet = new Set();
    const summary = {
        employeeCount: 0,
        itemCount: 0,
        totalEarnings: 0,
        totalPreTaxDeductions: 0,
        totalPostTaxDeductions: 0,
        totalReimbursements: 0,
        totalEmployerContributions: 0
    };

    for (const item of items) {
        if (item?.employeeId) {
            employeeSet.add(String(item.employeeId));
        }

        const amount = calculateBatchItemAmount(item);
        if (amount <= 0) continue;

        summary.itemCount += 1;
        if (item.classification === 'EARNING') {
            summary.totalEarnings = roundMoney(summary.totalEarnings + amount, 0);
        } else if (item.classification === 'PRE_TAX_DEDUCTION') {
            summary.totalPreTaxDeductions = roundMoney(summary.totalPreTaxDeductions + amount, 0);
        } else if (item.classification === 'POST_TAX_DEDUCTION') {
            summary.totalPostTaxDeductions = roundMoney(summary.totalPostTaxDeductions + amount, 0);
        } else if (item.classification === 'REIMBURSEMENT') {
            summary.totalReimbursements = roundMoney(summary.totalReimbursements + amount, 0);
        } else if (item.classification === 'EMPLOYER_CONTRIBUTION') {
            summary.totalEmployerContributions = roundMoney(summary.totalEmployerContributions + amount, 0);
        }
    }

    summary.employeeCount = employeeSet.size;
    return summary;
}

function normalizeWorkflowStep(step = {}, index = 0) {
    return {
        order: Number(step.order || (index + 1)),
        label: String(step.label || step.name || `Approval Step ${index + 1}`).trim(),
        role: String(step.role || '').trim(),
        status: ['APPROVED', 'REJECTED', 'SKIPPED'].includes(step.status) ? step.status : 'PENDING',
        actedBy: step.actedBy || null,
        actedAt: step.actedAt || null,
        comment: String(step.comment || '').trim()
    };
}

function buildDefaultApprovalWorkflow(executionMode = 'MONTHLY') {
    if (executionMode === 'OFF_CYCLE') {
        return [
            normalizeWorkflowStep({ order: 1, label: 'HR Review', role: 'HR' }, 0),
            normalizeWorkflowStep({ order: 2, label: 'Finance Approval', role: 'FINANCE' }, 1)
        ];
    }

    return [
        normalizeWorkflowStep({ order: 1, label: 'Payroll Review', role: 'HR' }, 0),
        normalizeWorkflowStep({ order: 2, label: 'Finance Approval', role: 'FINANCE' }, 1)
    ];
}

function ensureApprovalWorkflow(existingSteps = [], requestedSteps = [], executionMode = 'MONTHLY') {
    const source = Array.isArray(requestedSteps) && requestedSteps.length > 0
        ? requestedSteps
        : (Array.isArray(existingSteps) && existingSteps.length > 0 ? existingSteps : buildDefaultApprovalWorkflow(executionMode));

    return source
        .map((step, index) => normalizeWorkflowStep(step, index))
        .sort((left, right) => left.order - right.order);
}

function makeChecksum(payload = {}) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function getNextPayrollRunSequence(db, tenantId, month, year) {
    const PayrollRun = getModel(db, 'PayrollRun');
    const latest = await PayrollRun.findOne({ tenantId, month, year })
        .sort({ sequenceNo: -1 })
        .select('sequenceNo')
        .lean();
    return Math.max(1, Number(latest?.sequenceNo || 0) + 1);
}

async function createPayrollInputBatch(db, tenantId, payload = {}, userId = null) {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    const month = Number(payload.month);
    const year = Number(payload.year);

    if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
        throw lifecycleValidationError(
            'INVALID_PAYROLL_PERIOD',
            'Valid month and year are required to create a payroll input batch.',
            { month, year }
        );
    }

    const periodStart = startOfDay(payload.periodStart || new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)));
    const periodEnd = endOfDay(payload.periodEnd || new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)));
    const items = Array.isArray(payload.items) ? payload.items : [];
    const summary = summarizeInputItems(items);

    const existing = await PayrollInputBatch.findOne({ tenantId }).sort({ createdAt: -1 }).select('batchCode').lean();
    const numericSuffix = existing?.batchCode ? Number(String(existing.batchCode).split('-').pop()) || 0 : 0;
    const batchCode = String(payload.batchCode || `PIB-${formatPeriodKey(year, month)}-${String(numericSuffix + 1).padStart(3, '0')}`).trim().toUpperCase();

    const created = await PayrollInputBatch.create({
        tenantId,
        batchCode,
        name: String(payload.name || batchCode).trim(),
        source: payload.source || 'MANUAL',
        runScope: payload.runScope || 'ANY',
        usagePolicy: payload.usagePolicy || 'ONE_TIME',
        month,
        year,
        periodKey: formatPeriodKey(year, month),
        periodStart,
        periodEnd,
        payDate: payload.payDate || null,
        status: payload.status || 'DRAFT',
        summary,
        items,
        notes: payload.notes || '',
        createdBy: userId || null,
        updatedBy: userId || null,
        approvalComments: [{
            action: 'CREATED',
            actorId: userId || null,
            comment: 'Payroll input batch created.'
        }]
    });

    return created.toObject();
}

async function listPayrollInputBatches(db, tenantId, filters = {}) {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    const query = { tenantId };
    if (filters.status) query.status = filters.status;
    if (filters.month) query.month = Number(filters.month);
    if (filters.year) query.year = Number(filters.year);
    if (filters.source) query.source = filters.source;
    return PayrollInputBatch.find(query).sort({ year: -1, month: -1, createdAt: -1 }).lean();
}

async function getPayrollInputBatchById(db, tenantId, batchId) {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    return PayrollInputBatch.findOne({ _id: batchId, tenantId }).lean();
}

async function transitionPayrollInputBatch(db, tenantId, batchId, action, userId = null, comment = '') {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    const batch = await PayrollInputBatch.findOne({ _id: batchId, tenantId });
    if (!batch) {
        throw lifecycleNotFoundError('PAYROLL_INPUT_BATCH_NOT_FOUND', 'Payroll input batch not found.');
    }

    const upperAction = String(action || '').trim().toUpperCase();
    if (upperAction === 'SUBMIT') {
        batch.status = 'PENDING_APPROVAL';
        batch.submittedBy = userId || null;
        batch.submittedAt = new Date();
    } else if (upperAction === 'APPROVE') {
        batch.status = 'APPROVED';
        batch.approvedBy = userId || null;
        batch.approvedAt = new Date();
    } else if (upperAction === 'RELEASE') {
        if (!['APPROVED', 'RELEASED'].includes(batch.status)) {
            throw lifecycleConflictError(
                'INVALID_BATCH_RELEASE_STATE',
                'Only approved payroll input batches can be released.',
                { currentStatus: batch.status }
            );
        }
        batch.status = 'RELEASED';
        batch.releasedBy = userId || null;
        batch.releasedAt = new Date();
    } else if (upperAction === 'REJECT') {
        batch.status = 'REJECTED';
        batch.rejectedBy = userId || null;
        batch.rejectedAt = new Date();
        batch.rejectionReason = comment || batch.rejectionReason || '';
    } else if (upperAction === 'CANCEL') {
        batch.status = 'CANCELLED';
    } else {
        throw lifecycleValidationError(
            'UNSUPPORTED_BATCH_ACTION',
            `Unsupported payroll input batch action: ${action}`,
            { action }
        );
    }

    batch.updatedBy = userId || null;
    batch.approvalComments.push({
        action: upperAction,
        actorId: userId || null,
        comment: String(comment || '').trim()
    });

    await batch.save();
    return batch.toObject();
}

function batchMatchesRunScope(batch = {}, executionMode = 'MONTHLY') {
    if (!batch.runScope || batch.runScope === 'ANY') return true;
    return batch.runScope === executionMode;
}

function normalizeBatchInputItem(batch = {}, item = {}) {
    return {
        batchId: batch._id || null,
        batchCode: batch.batchCode || '',
        source: 'INPUT_BATCH',
        inputType: item.inputType || 'OTHER',
        classification: item.classification || 'EARNING',
        name: item.name || 'Payroll Input',
        amount: calculateBatchItemAmount(item),
        quantity: normalizeMoney(item.quantity, 1),
        rate: item.rate !== null && item.rate !== undefined ? normalizeMoney(item.rate, 0) : null,
        taxable: item.taxable !== false,
        affectsBasic: item.affectsBasic === true,
        componentCode: item.componentCode || '',
        effectiveDate: item.effectiveDate || batch.payDate || null,
        attendanceDate: item.attendanceDate || null,
        attendanceId: item.attendanceId || null,
        shiftId: item.shiftId || null,
        notes: item.notes || '',
        metadata: item.metadata || {}
    };
}

async function resolveRunInputBatches(db, tenantId, options = {}) {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    const inputBatchIds = dedupeObjectIds(options.inputBatchIds || []);
    const runId = toObjectId(options.payrollRunId);
    const startDate = startOfDay(options.startDate || new Date());
    const endDate = endOfDay(options.endDate || startDate);
    const executionMode = options.executionMode || 'MONTHLY';

    const query = {
        tenantId,
        status: { $in: ['APPROVED', 'RELEASED'] },
        periodStart: { $lte: endDate },
        periodEnd: { $gte: startDate }
    };

    if (inputBatchIds.length > 0) {
        query._id = { $in: inputBatchIds };
    }

    const batches = await PayrollInputBatch.find(query).lean();
    return batches.filter((batch) => {
        if (!batchMatchesRunScope(batch, executionMode)) return false;
        if (batch.usagePolicy === 'RECURRING') return true;
        const appliedRunIds = new Set((batch.appliedRunIds || []).map((id) => String(id)));
        if (appliedRunIds.size === 0) return true;
        return runId ? appliedRunIds.has(String(runId)) : false;
    });
}

async function resolveEffectiveShiftAssignments(db, tenantId, employeeId, startDate, endDate) {
    const ShiftAssignment = getModel(db, 'ShiftAssignment', ShiftAssignmentSchema);
    const Shift = getModel(db, 'Shift', ShiftSchema);
    const tenantKey = String(tenantId);

    const assignments = await ShiftAssignment.find({
        tenant: tenantKey,
        employee: employeeId,
        isActive: true,
        effectiveFrom: { $lte: endDate },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: startDate } }
        ]
    }).lean();

    if (assignments.length === 0) {
        return {
            assignments: [],
            shiftMap: new Map()
        };
    }

    const shiftIds = dedupeObjectIds(assignments.map((assignment) => assignment.shift));
    const shifts = await Shift.find({
        _id: { $in: shiftIds },
        tenant: tenantKey,
        isDeleted: false
    }).lean();

    return {
        assignments,
        shiftMap: new Map(shifts.map((shift) => [String(shift._id), shift]))
    };
}

function assignmentMatchesDate(assignment = {}, targetDate) {
    const effectiveFrom = startOfDay(assignment.effectiveFrom || targetDate);
    const effectiveTo = assignment.effectiveTo ? endOfDay(assignment.effectiveTo) : null;
    return effectiveFrom <= targetDate && (!effectiveTo || effectiveTo >= targetDate);
}

function findEffectiveShiftForDate(shiftContext, targetDate) {
    const matching = (shiftContext.assignments || [])
        .filter((assignment) => assignmentMatchesDate(assignment, targetDate))
        .sort((left, right) => {
            if (Boolean(right.isOverride) !== Boolean(left.isOverride)) {
                return right.isOverride ? 1 : -1;
            }
            return new Date(right.effectiveFrom || 0).getTime() - new Date(left.effectiveFrom || 0).getTime();
        });

    if (matching.length === 0) {
        return null;
    }

    const assignment = matching[0];
    return {
        assignment,
        shift: shiftContext.shiftMap.get(String(assignment.shift)) || null
    };
}

function applyRoundingToHours(hours, roundingMode = 'none') {
    const value = normalizeMoney(hours, 0);
    if (value <= 0) return 0;
    const quarter = 0.25;
    const half = 0.5;

    if (roundingMode === 'round_up_15') return Math.ceil(value / quarter) * quarter;
    if (roundingMode === 'round_up_30') return Math.ceil(value / half) * half;
    if (roundingMode === 'round_down_15') return Math.floor(value / quarter) * quarter;
    if (roundingMode === 'round_down_30') return Math.floor(value / half) * half;
    return value;
}

function calculateDerivedOvertimeInput(record = {}, shift = null, salaryTemplate = {}, attendanceSummary = {}) {
    if (!shift || shift.overtimeCfg?.enabled !== true) {
        return null;
    }

    const overtimeCfg = shift.overtimeCfg || {};
    const hoursWorked = normalizeMoney(record.workingHours, 0);
    const explicitOvertime = normalizeMoney(record.overtimeHours, 0);
    const fullDayHours = normalizeMoney(shift.workingHoursCfg?.fullDayThresholdHours, 8) || 8;
    const thresholdHours = fullDayHours + (normalizeMoney(overtimeCfg.startAfterMinutes, 0) / 60);
    const rawHours = explicitOvertime > 0
        ? explicitOvertime
        : (overtimeCfg.trackingEnabled ? Math.max(0, hoursWorked - thresholdHours) : 0);
    const roundedHours = applyRoundingToHours(rawHours, overtimeCfg.roundingMode);

    if (roundedHours <= 0 || overtimeCfg.compensationMode === 'NONE') {
        return null;
    }

    const monthlyEarnings = Array.isArray(salaryTemplate.earnings)
        ? salaryTemplate.earnings.reduce((sum, earning) => sum + normalizeMoney(earning.monthlyAmount, 0), 0)
        : normalizeMoney(salaryTemplate.monthlyCTC, 0);
    const totalDays = Math.max(1, normalizeMoney(attendanceSummary.totalDays, 30));
    const hourlyBaseRate = roundMoney(monthlyEarnings / (totalDays * fullDayHours), 0);
    const rate = overtimeCfg.compensationMode === 'FIXED_PER_HOUR'
        ? normalizeMoney(overtimeCfg.fixedHourlyRate, 0)
        : roundMoney(hourlyBaseRate * normalizeMoney(overtimeCfg.multiplier, 1), 0);
    const amount = roundMoney(roundedHours * rate, 0);

    if (amount <= 0) {
        return null;
    }

    return {
        source: 'ATTENDANCE',
        inputType: 'OVERTIME',
        classification: 'EARNING',
        name: overtimeCfg.earningLabel || 'Overtime Pay',
        amount,
        quantity: roundedHours,
        rate,
        taxable: true,
        affectsBasic: false,
        attendanceDate: record.date || null,
        attendanceId: record._id || null,
        shiftId: shift._id || null,
        metadata: {
            hoursWorked,
            roundedHours,
            shiftCode: shift.code || '',
            hourlyBaseRate
        }
    };
}

function calculateNightShiftAllowanceInput(record = {}, shift = null) {
    if (!shift || shift.nightShiftRules?.allowanceEnabled !== true) {
        return null;
    }

    const isNightShiftRecord = record.isNightShift === true || shift.isNightShift === true;
    if (!isNightShiftRecord) {
        return null;
    }

    const allowanceAmount = normalizeMoney(shift.nightShiftRules?.allowanceAmount, 0);
    if (allowanceAmount <= 0) {
        return null;
    }

    return {
        source: 'ATTENDANCE',
        inputType: 'NIGHT_SHIFT_ALLOWANCE',
        classification: 'EARNING',
        name: shift.nightShiftRules?.allowanceLabel || 'Night Shift Allowance',
        amount: allowanceAmount,
        quantity: 1,
        rate: allowanceAmount,
        taxable: shift.nightShiftRules?.allowanceTaxable !== false,
        affectsBasic: false,
        attendanceDate: record.date || null,
        attendanceId: record._id || null,
        shiftId: shift._id || null,
        metadata: {
            shiftCode: shift.code || '',
            isNightShift: true
        }
    };
}

function classifyResolvedInputs(items = []) {
    const result = {
        items,
        earnings: [],
        preTaxDeductions: [],
        postTaxDeductions: [],
        employerContributions: [],
        reimbursements: [],
        inputBatchIds: dedupeObjectIds(items.map((item) => item.batchId).filter(Boolean))
    };

    for (const item of items) {
        if (!item || normalizeMoney(item.amount, 0) <= 0) continue;

        if (item.classification === 'EARNING') {
            result.earnings.push(item);
        } else if (item.classification === 'PRE_TAX_DEDUCTION') {
            result.preTaxDeductions.push(item);
        } else if (item.classification === 'POST_TAX_DEDUCTION') {
            result.postTaxDeductions.push(item);
        } else if (item.classification === 'REIMBURSEMENT') {
            result.reimbursements.push(item);
        } else if (item.classification === 'EMPLOYER_CONTRIBUTION') {
            result.employerContributions.push(item);
        }
    }

    result.summary = {
        totalEarnings: roundMoney(result.earnings.reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0), 0),
        totalPreTaxDeductions: roundMoney(result.preTaxDeductions.reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0), 0),
        totalPostTaxDeductions: roundMoney(result.postTaxDeductions.reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0), 0),
        totalReimbursements: roundMoney(result.reimbursements.reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0), 0),
        totalEmployerContributions: roundMoney(result.employerContributions.reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0), 0)
    };

    return result;
}

async function resolveEmployeeRunInputs(db, tenantId, params = {}) {
    const batches = await resolveRunInputBatches(db, tenantId, params);
    const employeeId = params.employeeId;
    const runId = toObjectId(params.payrollRunId);
    const executionMode = params.executionMode || 'MONTHLY';
    const attendanceRecords = Array.isArray(params.attendanceRecords) ? params.attendanceRecords : [];
    const salaryTemplate = params.salaryTemplate || {};
    const attendanceSummary = params.attendanceSummary || {};

    const batchItems = [];
    const employeeInputBatchIds = [];
    for (const batch of batches) {
        const appliedRunIds = new Set((batch.appliedRunIds || []).map((id) => String(id)));
        if (batch.usagePolicy !== 'RECURRING' && appliedRunIds.size > 0 && (!runId || !appliedRunIds.has(String(runId)))) {
            continue;
        }
        if (!batchMatchesRunScope(batch, executionMode)) {
            continue;
        }

        const items = Array.isArray(batch.items) ? batch.items : [];
        for (const item of items) {
            if (String(item.employeeId) !== String(employeeId)) continue;
            const normalized = normalizeBatchInputItem(batch, item);
            if (normalized.amount <= 0) continue;
            batchItems.push(normalized);
            employeeInputBatchIds.push(batch._id);
        }
    }

    const shiftContext = await resolveEffectiveShiftAssignments(
        db,
        tenantId,
        employeeId,
        params.startDate,
        params.endDate
    );

    const derivedInputs = [];
    const overtimeSummary = {
        totalHours: 0,
        payableHours: 0,
        amount: 0,
        days: 0
    };
    const shiftSummary = {
        assignedShiftCodes: [],
        nightShiftDays: 0
    };
    const shiftCodeSet = new Set();

    for (const record of attendanceRecords) {
        const effectiveShift = findEffectiveShiftForDate(shiftContext, new Date(record.date));
        const shift = effectiveShift?.shift || null;
        if (!shift) continue;

        if (shift.code) {
            shiftCodeSet.add(shift.code);
        }

        const overtimeInput = calculateDerivedOvertimeInput(record, shift, salaryTemplate, attendanceSummary);
        if (overtimeInput) {
            derivedInputs.push(overtimeInput);
            overtimeSummary.totalHours = roundMoney(overtimeSummary.totalHours + normalizeMoney(record.overtimeHours, overtimeInput.quantity || 0), 0);
            overtimeSummary.payableHours = roundMoney(overtimeSummary.payableHours + normalizeMoney(overtimeInput.quantity, 0), 0);
            overtimeSummary.amount = roundMoney(overtimeSummary.amount + normalizeMoney(overtimeInput.amount, 0), 0);
            overtimeSummary.days += 1;
        }

        const nightShiftInput = calculateNightShiftAllowanceInput(record, shift);
        if (nightShiftInput) {
            derivedInputs.push(nightShiftInput);
            shiftSummary.nightShiftDays += 1;
        }
    }

    shiftSummary.assignedShiftCodes = [...shiftCodeSet];
    const classified = classifyResolvedInputs([...batchItems, ...derivedInputs]);
    classified.inputBatchIds = dedupeObjectIds(employeeInputBatchIds);
    classified.overtimeSummary = overtimeSummary;
    classified.shiftSummary = shiftSummary;
    classified.phase2Snapshot = {
        inputBatchIds: classified.inputBatchIds,
        items: classified.items,
        summary: classified.summary,
        overtimeSummary,
        shiftSummary
    };

    return classified;
}

function appendResolvedInputToEarningsSnapshot(target, input, includeInTaxableGross = true) {
    target.earningsSnapshot.push({
        name: input.name,
        amount: roundMoney(input.amount, 0),
        isProRata: false,
        originalAmount: roundMoney(input.amount, 0),
        daysWorked: null,
        totalDays: null
    });
    target.totalGross = roundMoney(target.totalGross + normalizeMoney(input.amount, 0), 0);
    if (includeInTaxableGross) {
        target.taxableGross = roundMoney(target.taxableGross + normalizeMoney(input.amount, 0), 0);
    }
    if (input.affectsBasic === true) {
        target.basicAmount = roundMoney(target.basicAmount + normalizeMoney(input.amount, 0), 0);
    }
}

function applyResolvedInputsToGross(baseGross = {}, resolvedInputs = {}) {
    const gross = {
        ...baseGross,
        earningsSnapshot: Array.isArray(baseGross.earningsSnapshot) ? [...baseGross.earningsSnapshot] : [],
        totalGross: roundMoney(baseGross.totalGross, 0),
        taxableGross: roundMoney(baseGross.taxableGross || baseGross.totalGross, 0),
        basicAmount: roundMoney(baseGross.basicAmount, 0),
        originalBasicAmount: roundMoney(baseGross.originalBasicAmount, 0)
    };

    for (const input of resolvedInputs.earnings || []) {
        appendResolvedInputToEarningsSnapshot(gross, input, input.taxable !== false);
    }

    for (const input of resolvedInputs.reimbursements || []) {
        appendResolvedInputToEarningsSnapshot(gross, input, input.taxable !== false);
    }

    return gross;
}

function mapDynamicPreTaxCategory(input = {}) {
    const inputType = String(input.inputType || '').toUpperCase();
    if (inputType.includes('PF')) return 'EPF';
    if (inputType.includes('ESI')) return 'ESI';
    if (inputType.includes('TDS')) return 'TDS';
    if (inputType.includes('PT')) return 'PROFESSIONAL_TAX';
    return 'OTHER';
}

function mapDynamicPostTaxCategory(input = {}) {
    const inputType = String(input.inputType || '').toUpperCase();
    if (inputType.includes('LOAN')) return 'LOAN';
    if (inputType.includes('ADVANCE')) return 'ADVANCE';
    if (inputType.includes('PENALTY')) return 'PENALTY';
    if (inputType.includes('LEAVE') || inputType.includes('ATTENDANCE')) return 'LOP';
    return 'OTHER';
}

function mergeResolvedInputsIntoDeductions(base = {}, resolvedInputs = {}, target = 'PRE_TAX') {
    const next = {
        ...base,
        snapshot: Array.isArray(base.snapshot) ? [...base.snapshot] : [],
        total: roundMoney(base.total, 0),
        appliedEmployeeDeductions: Array.isArray(base.appliedEmployeeDeductions) ? [...base.appliedEmployeeDeductions] : []
    };

    const items = target === 'PRE_TAX'
        ? (resolvedInputs.preTaxDeductions || [])
        : (resolvedInputs.postTaxDeductions || []);

    for (const input of items) {
        const amount = roundMoney(input.amount, 0);
        if (amount <= 0) continue;
        next.snapshot.push({
            name: input.name,
            amount,
            category: target === 'PRE_TAX' ? mapDynamicPreTaxCategory(input) : mapDynamicPostTaxCategory(input)
        });
        next.total = roundMoney(next.total + amount, 0);
    }

    return next;
}

function mergeResolvedInputsIntoEmployerContributions(base = [], resolvedInputs = {}) {
    const list = Array.isArray(base) ? [...base] : [];
    for (const input of resolvedInputs.employerContributions || []) {
        const amount = roundMoney(input.amount, 0);
        if (amount <= 0) continue;
        list.push({
            name: input.name,
            amount
        });
    }
    return list;
}

async function reserveInputBatchesForRun(db, tenantId, batchIds = [], runId) {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    const dedupedIds = dedupeObjectIds(batchIds);
    const normalizedRunId = toObjectId(runId);
    if (!normalizedRunId || dedupedIds.length === 0) return;

    await PayrollInputBatch.updateMany(
        { tenantId, _id: { $in: dedupedIds } },
        { $addToSet: { appliedRunIds: normalizedRunId } }
    );
}

async function releaseInputBatchReservations(db, tenantId, runId) {
    const PayrollInputBatch = getModel(db, 'PayrollInputBatch', PayrollInputBatchSchema);
    const normalizedRunId = toObjectId(runId);
    if (!normalizedRunId) return;

    await PayrollInputBatch.updateMany(
        { tenantId, appliedRunIds: normalizedRunId },
        { $pull: { appliedRunIds: normalizedRunId } }
    );
}

async function calculateFiscalYearTaxStats(db, tenantId, employeeId, month, year, excludedPayrollRunId = null) {
    const Payslip = getModel(db, 'Payslip');
    const currentPeriodValue = getPeriodValue(year, month);
    const financialYear = getFinancialYearWindow(month, year);
    const query = {
        tenantId,
        employeeId,
        status: { $in: ['APPROVED', 'PAID'] },
        generatedAt: { $gte: financialYear.start, $lte: financialYear.end }
    };

    if (excludedPayrollRunId) {
        query.payrollRunId = { $ne: excludedPayrollRunId };
    }

    const payslips = await Payslip.find(query).lean();
    const history = payslips.filter((payslip) => getPeriodValue(payslip.year, payslip.month) < currentPeriodValue);

    return history.reduce((acc, payslip) => {
        acc.taxableIncome = roundMoney(acc.taxableIncome + normalizeMoney(payslip.taxableIncome, 0), 0);
        acc.incomeTax = roundMoney(acc.incomeTax + normalizeMoney(payslip.incomeTax, 0), 0);
        acc.grossEarnings = roundMoney(acc.grossEarnings + normalizeMoney(payslip.grossEarnings, 0), 0);
        acc.periods += 1;
        return acc;
    }, {
        financialYearLabel: financialYear.label,
        taxableIncome: 0,
        incomeTax: 0,
        grossEarnings: 0,
        periods: 0
    });
}

function getCriticalSubmissionFailures(payrollRun = {}) {
    const failedEmployees = Number(payrollRun.failedEmployees || 0);
    const executionErrors = Array.isArray(payrollRun.executionErrors) ? payrollRun.executionErrors.filter(Boolean) : [];
    return {
        failedEmployees,
        executionErrorCount: executionErrors.length,
        sampleExecutionErrors: executionErrors.slice(0, 3).map((item) => ({
            employeeId: item?.employeeId ? String(item.employeeId) : null,
            message: item?.message || 'Unknown execution error'
        }))
    };
}

async function submitPayrollRunForApproval(db, tenantId, payrollRunId, userId = null, comment = '') {
    const PayrollRun = getModel(db, 'PayrollRun');
    const payrollRun = await PayrollRun.findOne({ _id: payrollRunId, tenantId });
    if (!payrollRun) {
        throw lifecycleNotFoundError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found.');
    }

    if (payrollRun.status !== 'CALCULATED') {
        throw lifecycleConflictError(
            'INVALID_RUN_STATUS_FOR_SUBMISSION',
            `Payroll run must be CALCULATED before approval submission. Current status: ${payrollRun.status}`,
            { currentStatus: payrollRun.status }
        );
    }

    if (payrollRun.approvalStatus === 'PENDING_APPROVAL') {
        throw lifecycleConflictError(
            'PAYROLL_ALREADY_SUBMITTED',
            'Payroll run is already pending approval.',
            { approvalStatus: payrollRun.approvalStatus }
        );
    }

    const criticalFailures = getCriticalSubmissionFailures(payrollRun);
    if (criticalFailures.failedEmployees > 0 || criticalFailures.executionErrorCount > 0) {
        throw lifecycleConflictError(
            'PAYROLL_CRITICAL_FAILURES',
            'Payroll run has critical failures and cannot be submitted for approval.',
            criticalFailures
        );
    }

    payrollRun.approvalWorkflow = ensureApprovalWorkflow(
        payrollRun.approvalWorkflow,
        payrollRun.approvalWorkflow,
        payrollRun.executionMode || 'MONTHLY'
    );
    payrollRun.approvalStatus = 'PENDING_APPROVAL';
    payrollRun.submittedForApprovalBy = userId || null;
    payrollRun.submittedForApprovalAt = new Date();
    payrollRun.approvalHistory = Array.isArray(payrollRun.approvalHistory) ? payrollRun.approvalHistory : [];
    payrollRun.approvalHistory.push({
        action: 'SUBMITTED',
        order: 0,
        label: 'Approval Submission',
        status: 'PENDING',
        actedBy: userId || null,
        comment: String(comment || '').trim()
    });

    await payrollRun.save();
    return payrollRun.toObject();
}

async function finalizeApprovedRun(db, tenantId, payrollRunInput, userId = null) {
    const PayrollRun = getModel(db, 'PayrollRun');
    const Payslip = getModel(db, 'Payslip');
    const PayrollRunItem = getModel(db, 'PayrollRunItem');
    const runId = toObjectId(payrollRunInput?._id || payrollRunInput);
    if (!runId) {
        throw lifecycleValidationError(
            'INVALID_PAYROLL_RUN_ID',
            'Valid payroll run id is required to finalize payroll.'
        );
    }

    const session = await db.startSession();
    let finalizedRun = null;

    try {
        await session.withTransaction(async () => {
            let payrollRun = (payrollRunInput && typeof payrollRunInput.save === 'function')
                ? payrollRunInput
                : null;

            if (!payrollRun) {
                payrollRun = await PayrollRun.findOne({ _id: runId, tenantId }).session(session);
            }

            if (!payrollRun || String(payrollRun.tenantId) !== String(tenantId)) {
                throw lifecycleNotFoundError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found.');
            }

            if (!['CALCULATED', 'APPROVED'].includes(payrollRun.status)) {
                throw lifecycleConflictError(
                    'INVALID_RUN_STATUS_FOR_FINALIZATION',
                    `Payroll run must be CALCULATED before finalization. Current status: ${payrollRun.status}`,
                    { currentStatus: payrollRun.status }
                );
            }

            if (typeof payrollRun.$session === 'function') {
                payrollRun.$session(session);
            }

            const approvedAt = new Date();
            payrollRun.status = 'APPROVED';
            payrollRun.lifecycleState = 'APPROVED';
            payrollRun.approvalStatus = 'APPROVED';
            payrollRun.approvedBy = userId || payrollRun.approvedBy || null;
            payrollRun.approvedAt = approvedAt;
            payrollRun.lockedAt = approvedAt;
            await payrollRun.save({ session });

            await Promise.all([
                Payslip.updateMany(
                    { tenantId, payrollRunId: payrollRun._id, status: 'DRAFT' },
                    {
                        $set: {
                            status: 'APPROVED',
                            approvedBy: userId || null,
                            approvedAt
                        }
                    },
                    { session }
                ),
                PayrollRunItem.updateMany(
                    { tenantId, payrollRunId: payrollRun._id, status: 'GENERATED' },
                    { $set: { status: 'LOCKED' } },
                    { session }
                )
            ]);

            if (payrollRun.runType === 'AMENDMENT') {
                await supersedePreviousPayslipsForAmendment(db, tenantId, payrollRun, { session });
            }

            finalizedRun = payrollRun.toObject();
        });
    } finally {
        await session.endSession();
    }

    return finalizedRun;
}

async function reviewPayrollRunApproval(db, tenantId, payrollRunId, decision, userId = null, comment = '', stepOrder = null, approverRole = '') {
    const PayrollRun = getModel(db, 'PayrollRun');
    const payrollRun = await PayrollRun.findOne({ _id: payrollRunId, tenantId });
    if (!payrollRun) {
        throw lifecycleNotFoundError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found.');
    }

    if (!userId) {
        throw lifecycleValidationError('APPROVER_REQUIRED', 'Approver identity is required to review payroll approval.');
    }

    if (payrollRun.approvalStatus !== 'PENDING_APPROVAL') {
        throw lifecycleConflictError(
            'INVALID_APPROVAL_STATUS',
            `Payroll run is not pending approval. Current approval status: ${payrollRun.approvalStatus}`,
            { approvalStatus: payrollRun.approvalStatus }
        );
    }

    payrollRun.approvalWorkflow = ensureApprovalWorkflow(
        payrollRun.approvalWorkflow,
        payrollRun.approvalWorkflow,
        payrollRun.executionMode || 'MONTHLY'
    );
    payrollRun.approvalHistory = Array.isArray(payrollRun.approvalHistory) ? payrollRun.approvalHistory : [];

    const normalizedDecision = String(decision || '').trim().toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(normalizedDecision)) {
        throw lifecycleValidationError(
            'INVALID_APPROVAL_DECISION',
            'Approval decision must be APPROVE or REJECT.',
            { decision }
        );
    }

    const pendingSteps = payrollRun.approvalWorkflow
        .filter((step) => step.status === 'PENDING')
        .sort((left, right) => Number(left.order) - Number(right.order));

    if (pendingSteps.length === 0) {
        throw lifecycleConflictError(
            'NO_PENDING_APPROVAL_STEP',
            'No pending approval step found for this payroll run.'
        );
    }

    const nextPendingStep = pendingSteps[0];
    const requestedStepOrder = (stepOrder === null || stepOrder === undefined || stepOrder === '')
        ? Number(nextPendingStep.order)
        : Number(stepOrder);

    if (!Number.isFinite(requestedStepOrder)) {
        throw lifecycleValidationError(
            'INVALID_STEP_ORDER',
            'Approval step order must be a valid number.',
            { stepOrder }
        );
    }

    if (requestedStepOrder !== Number(nextPendingStep.order)) {
        throw lifecycleConflictError(
            'APPROVAL_SEQUENCE_VIOLATION',
            'Only the next pending approval step can be reviewed.',
            { nextStepOrder: Number(nextPendingStep.order), requestedStepOrder }
        );
    }

    const targetStep = pendingSteps.find((step) => Number(step.order) === requestedStepOrder) || nextPendingStep;
    const requiredRole = normalizeApprovalRole(targetStep.role || '');
    if (requiredRole) {
        const normalizedApproverRole = normalizeRoleName(approverRole);
        if (!normalizedApproverRole) {
            throw lifecycleValidationError(
                'APPROVER_ROLE_REQUIRED',
                `Approver role is required for ${requiredRole} approval step.`,
                { requiredRole }
            );
        }

        if (!roleMatchesApprovalStep(normalizedApproverRole, requiredRole)) {
            throw lifecycleConflictError(
                'APPROVAL_ROLE_MISMATCH',
                `Approver role ${normalizedApproverRole} cannot act on ${requiredRole} approval step.`,
                {
                    requiredRole,
                    approverRole: normalizedApproverRole
                }
            );
        }
    }

    const makerActorId = payrollRun.submittedForApprovalBy || payrollRun.initiatedBy || null;
    if (normalizedDecision === 'APPROVE' && sameActor(makerActorId, userId)) {
        throw lifecycleConflictError(
            'MAKER_CHECKER_VIOLATION',
            'Maker-checker violation: submitter cannot approve their own payroll run.',
            {
                submittedForApprovalBy: normalizeActorId(makerActorId),
                approverId: normalizeActorId(userId)
            }
        );
    }

    const actedAt = new Date();
    targetStep.actedBy = userId || null;
    targetStep.actedAt = actedAt;
    targetStep.comment = String(comment || '').trim();

    if (normalizedDecision === 'REJECT') {
        targetStep.status = 'REJECTED';
        payrollRun.approvalStatus = 'REJECTED';
        payrollRun.rejectedBy = userId || null;
        payrollRun.rejectedAt = actedAt;
        payrollRun.rejectionReason = String(comment || '').trim();
        payrollRun.approvalHistory.push({
            action: 'REJECTED',
            order: targetStep.order,
            label: targetStep.label,
            status: 'REJECTED',
            actedBy: userId || null,
            comment: String(comment || '').trim()
        });
        await payrollRun.save();
        return payrollRun.toObject();
    }

    targetStep.status = 'APPROVED';
    payrollRun.approvalHistory.push({
        action: 'APPROVED',
        order: targetStep.order,
        label: targetStep.label,
        status: 'APPROVED',
        actedBy: userId || null,
        comment: String(comment || '').trim()
    });

    const hasRemainingPending = payrollRun.approvalWorkflow.some((step) => step.status === 'PENDING');
    if (hasRemainingPending) {
        await payrollRun.save();
        return payrollRun.toObject();
    }

    return finalizeApprovedRun(db, tenantId, payrollRun, userId);
}

async function forceApprovePayrollRun(db, tenantId, payrollRunId, userId = null, comment = '') {
    if (!isForceApprovalEnabled()) {
        throw lifecycleConflictError(
            'FORCE_APPROVAL_DISABLED',
            'Force approval is disabled. Enable PAYROLL_ALLOW_FORCE_APPROVAL=true to use this endpoint.'
        );
    }

    if (!userId) {
        throw lifecycleValidationError('APPROVER_REQUIRED', 'Approver identity is required for force approval.');
    }

    const reason = String(comment || '').trim();
    if (!reason) {
        throw lifecycleValidationError(
            'FORCE_APPROVAL_REASON_REQUIRED',
            'Force approval comment is required for audit trail.'
        );
    }

    const PayrollRun = getModel(db, 'PayrollRun');
    const payrollRun = await PayrollRun.findOne({ _id: payrollRunId, tenantId });
    if (!payrollRun) {
        throw lifecycleNotFoundError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found.');
    }

    if (payrollRun.status !== 'CALCULATED') {
        throw lifecycleConflictError(
            'INVALID_RUN_STATUS_FOR_FORCE_APPROVAL',
            `Payroll run status must be CALCULATED for force approval. Current status: ${payrollRun.status}`,
            { currentStatus: payrollRun.status }
        );
    }

    if (payrollRun.approvalStatus === 'REJECTED') {
        throw lifecycleConflictError(
            'REJECTED_RUN_CANNOT_BE_FORCE_APPROVED',
            'Rejected payroll runs must be recalculated before force approval.'
        );
    }

    const makerActorId = payrollRun.submittedForApprovalBy || payrollRun.initiatedBy || null;
    if (sameActor(makerActorId, userId)) {
        throw lifecycleConflictError(
            'MAKER_CHECKER_VIOLATION',
            'Maker-checker violation: submitter cannot force approve their own payroll run.',
            {
                submittedForApprovalBy: normalizeActorId(makerActorId),
                approverId: normalizeActorId(userId)
            }
        );
    }

    const actedAt = new Date();
    const auditComment = `Force approved via PAYROLL_ALLOW_FORCE_APPROVAL. ${reason}`;
    payrollRun.approvalWorkflow = ensureApprovalWorkflow(
        payrollRun.approvalWorkflow,
        payrollRun.approvalWorkflow,
        payrollRun.executionMode || 'MONTHLY'
    ).map((step) => ({
        ...step,
        status: 'APPROVED',
        actedBy: step.actedBy || userId || null,
        actedAt: step.actedAt || actedAt,
        comment: step.comment || auditComment
    }));
    payrollRun.approvalStatus = 'APPROVED';
    payrollRun.approvalHistory = Array.isArray(payrollRun.approvalHistory) ? payrollRun.approvalHistory : [];
    payrollRun.approvalHistory.push({
        action: 'FORCE_APPROVED',
        order: 0,
        label: 'Force Approval',
        status: 'APPROVED',
        actedBy: userId || null,
        comment: auditComment
    });

    return finalizeApprovedRun(db, tenantId, payrollRun, userId);
}

async function supersedePreviousPayslipsForAmendment(db, tenantId, payrollRun, options = {}) {
    const Payslip = getModel(db, 'Payslip');
    const PayrollRun = getModel(db, 'PayrollRun');
    const session = options.session || null;
    const readQueryOptions = session ? { session } : {};
    const writeQueryOptions = session ? { session } : {};

    const amendmentPayslips = await Payslip.find({
        tenantId,
        payrollRunId: payrollRun._id,
        status: { $in: ['APPROVED', 'PAID'] }
    }, null, readQueryOptions).lean();

    for (const payslip of amendmentPayslips) {
        const previousPayslips = await Payslip.find({
            tenantId,
            employeeId: payslip.employeeId,
            month: payslip.month,
            year: payslip.year,
            payrollRunId: { $ne: payrollRun._id },
            status: { $in: ['APPROVED', 'PAID'] }
        }, null, readQueryOptions).select('_id').lean();

        if (previousPayslips.length === 0) continue;

        await Payslip.updateMany(
            { _id: { $in: previousPayslips.map((item) => item._id) } },
            {
                $set: {
                    status: 'SUPERSEDED',
                    supersededByPayslipId: payslip._id
                }
            },
            writeQueryOptions
        );
    }

    if (payrollRun.amendmentOfRunId) {
        await PayrollRun.updateOne(
            { _id: payrollRun.amendmentOfRunId, tenantId },
            {
                $set: {
                    status: 'AMENDED',
                    lifecycleState: 'AMENDED'
                }
            },
            writeQueryOptions
        );
    }
}

function buildCsv(rows = [], columns = []) {
    const header = columns.map((column) => column.label).join(',');
    const lines = rows.map((row) => columns.map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return '';
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
    }).join(','));
    return [header, ...lines].join('\n');
}

function buildAccountingRows(payslips = []) {
    const buckets = new Map();
    for (const payslip of payslips) {
        for (const earning of payslip.earningsSnapshot || []) {
            const key = `EARNING:${earning.name}`;
            buckets.set(key, roundMoney((buckets.get(key) || 0) + normalizeMoney(earning.amount, 0), 0));
        }
        for (const deduction of payslip.preTaxDeductionsSnapshot || []) {
            const key = `PRE_TAX:${deduction.name}`;
            buckets.set(key, roundMoney((buckets.get(key) || 0) + normalizeMoney(deduction.amount, 0), 0));
        }
        for (const deduction of payslip.postTaxDeductionsSnapshot || []) {
            const key = `POST_TAX:${deduction.name}`;
            buckets.set(key, roundMoney((buckets.get(key) || 0) + normalizeMoney(deduction.amount, 0), 0));
        }
        if (normalizeMoney(payslip.incomeTax, 0) > 0) {
            const key = 'TAX:TDS';
            buckets.set(key, roundMoney((buckets.get(key) || 0) + normalizeMoney(payslip.incomeTax, 0), 0));
        }
    }

    return [...buckets.entries()].map(([bucket, amount]) => {
        const [category, component] = bucket.split(':');
        return { category, component, amount };
    });
}

async function createExportArtifact(db, tenantId, payrollRunId, artifactType, format, fileName, summary, payload, userId = null) {
    const PayrollExportArtifact = getModel(db, 'PayrollExportArtifact', PayrollExportArtifactSchema);

    const previousArtifacts = await PayrollExportArtifact.find({
        tenantId,
        payrollRunId,
        artifactType,
        status: 'GENERATED'
    }).select('_id').lean();

    const created = await PayrollExportArtifact.create({
        tenantId,
        payrollRunId,
        artifactType,
        format,
        fileName,
        checksum: makeChecksum(payload),
        rowCount: Array.isArray(payload.rows) ? payload.rows.length : 0,
        summary,
        payload,
        generatedBy: userId || null
    });

    if (previousArtifacts.length > 0) {
        await PayrollExportArtifact.updateMany(
            { _id: { $in: previousArtifacts.map((item) => item._id) } },
            {
                $set: {
                    status: 'SUPERSEDED',
                    supersededByArtifactId: created._id
                }
            }
        );
    }

    return created.toObject();
}

async function generateRunExports(db, tenantId, payrollRunId, artifactTypes = [], userId = null) {
    const PayrollRun = getModel(db, 'PayrollRun');
    const Payslip = getModel(db, 'Payslip');
    const payrollRun = await PayrollRun.findOne({ _id: payrollRunId, tenantId });
    if (!payrollRun) {
        throw lifecycleNotFoundError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found.');
    }

    const allowDraftExports = isDraftExportAllowed();
    if (!allowDraftExports && !['APPROVED', 'PAID'].includes(payrollRun.status)) {
        throw lifecycleConflictError(
            'EXPORTS_REQUIRE_FINALIZED_RUN',
            `Payroll exports require APPROVED or PAID run status. Current status: ${payrollRun.status}`,
            { currentStatus: payrollRun.status }
        );
    }

    const eligiblePayslipStatuses = allowDraftExports
        ? ['DRAFT', 'APPROVED', 'PAID']
        : ['APPROVED', 'PAID'];

    const payslips = await Payslip.find({
        tenantId,
        payrollRunId,
        status: { $in: eligiblePayslipStatuses }
    }).lean();

    if (!allowDraftExports && payslips.length === 0) {
        throw lifecycleConflictError(
            'NO_FINALIZED_PAYSLIPS_FOR_EXPORT',
            'No finalized payslips found for export generation.'
        );
    }

    const types = Array.isArray(artifactTypes) && artifactTypes.length > 0
        ? artifactTypes
        : ['BANK_TRANSFER', 'ACCOUNTING_SUMMARY', 'COMPLIANCE_PF', 'COMPLIANCE_ESI', 'COMPLIANCE_TDS', 'EXCEPTION_REPORT', 'VARIANCE_REPORT'];

    const createdArtifacts = [];
    const bankRows = payslips.map((payslip) => ({
        employeeId: payslip.employeeInfo?.employeeId || '',
        employeeName: payslip.employeeInfo?.name || '',
        bankName: payslip.employeeInfo?.bankName || '',
        accountNumber: payslip.employeeInfo?.bankAccountNumber || '',
        ifsc: payslip.employeeInfo?.bankIFSC || '',
        amount: roundMoney(payslip.netPay, 0),
        payDate: payrollRun.payDate ? new Date(payrollRun.payDate).toISOString().split('T')[0] : ''
    }));
    const accountingRows = buildAccountingRows(payslips);
    const pfRows = payslips.map((payslip) => {
        const employeePf = (payslip.preTaxDeductionsSnapshot || [])
            .filter((item) => item.category === 'EPF')
            .reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0);
        const employerPf = (payslip.employerContributionsSnapshot || [])
            .filter((item) => String(item.name || '').toLowerCase().includes('pf'))
            .reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0);
        return {
            employeeId: payslip.employeeInfo?.employeeId || '',
            employeeName: payslip.employeeInfo?.name || '',
            uan: payslip.employeeInfo?.uanNumber || '',
            employeePf: roundMoney(employeePf, 0),
            employerPf: roundMoney(employerPf, 0)
        };
    });
    const esiRows = payslips.map((payslip) => ({
        employeeId: payslip.employeeInfo?.employeeId || '',
        employeeName: payslip.employeeInfo?.name || '',
        employeeEsi: roundMoney((payslip.preTaxDeductionsSnapshot || [])
            .filter((item) => item.category === 'ESI')
            .reduce((sum, item) => sum + normalizeMoney(item.amount, 0), 0), 0)
    }));
    const tdsRows = payslips.map((payslip) => ({
        employeeId: payslip.employeeInfo?.employeeId || '',
        employeeName: payslip.employeeInfo?.name || '',
        pan: payslip.employeeInfo?.panNumber || '',
        regime: payslip.taxProfileSnapshot?.regime || payslip.tdsSnapshot?.regime || 'NEW',
        taxableIncome: roundMoney(payslip.taxableIncome, 0),
        tds: roundMoney(payslip.incomeTax, 0)
    }));
    const varianceRows = payslips
        .filter((payslip) => payslip.varianceSnapshot?.hasPrevious)
        .map((payslip) => ({
            employeeId: payslip.employeeInfo?.employeeId || '',
            employeeName: payslip.employeeInfo?.name || '',
            previousMonth: payslip.varianceSnapshot?.previousMonth || '',
            previousYear: payslip.varianceSnapshot?.previousYear || '',
            grossDelta: roundMoney(payslip.varianceSnapshot?.grossDelta, 0),
            netDelta: roundMoney(payslip.varianceSnapshot?.netDelta, 0),
            incomeTaxDelta: roundMoney(payslip.varianceSnapshot?.incomeTaxDelta, 0)
        }));
    const exceptionRows = [];
    for (const error of payrollRun.executionErrors || []) {
        exceptionRows.push({
            employeeId: String(error.employeeId || ''),
            type: 'EXECUTION_ERROR',
            message: error.message || 'Unknown payroll error'
        });
    }
    for (const payslip of payslips) {
        if (!payslip.employeeInfo?.bankAccountNumber || !payslip.employeeInfo?.bankIFSC) {
            exceptionRows.push({
                employeeId: payslip.employeeInfo?.employeeId || '',
                type: 'MISSING_BANK_DETAILS',
                message: 'Bank account number or IFSC is missing.'
            });
        }
        if ((payslip.phase2InputsSnapshot?.overtimeSummary?.days || 0) > 0 && normalizeMoney(payslip.phase2InputsSnapshot?.overtimeSummary?.amount, 0) === 0) {
            exceptionRows.push({
                employeeId: payslip.employeeInfo?.employeeId || '',
                type: 'UNPAID_OVERTIME',
                message: 'Attendance recorded overtime days but no overtime amount was generated.'
            });
        }
    }

    for (const type of types) {
        if (type === 'BANK_TRANSFER') {
            const summary = {
                employeeCount: bankRows.length,
                totalAmount: roundMoney(bankRows.reduce((sum, row) => sum + normalizeMoney(row.amount, 0), 0), 0)
            };
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-bank-transfer.csv`,
                summary,
                {
                    rows: bankRows,
                    csv: buildCsv(bankRows, [
                        { key: 'employeeId', label: 'Employee ID' },
                        { key: 'employeeName', label: 'Employee Name' },
                        { key: 'bankName', label: 'Bank Name' },
                        { key: 'accountNumber', label: 'Account Number' },
                        { key: 'ifsc', label: 'IFSC' },
                        { key: 'amount', label: 'Amount' },
                        { key: 'payDate', label: 'Pay Date' }
                    ])
                },
                userId
            ));
        } else if (type === 'ACCOUNTING_SUMMARY') {
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-accounting-summary.csv`,
                {
                    rowCount: accountingRows.length,
                    grossTotal: roundMoney(payslips.reduce((sum, payslip) => sum + normalizeMoney(payslip.grossEarnings, 0), 0), 0),
                    netTotal: roundMoney(payslips.reduce((sum, payslip) => sum + normalizeMoney(payslip.netPay, 0), 0), 0)
                },
                {
                    rows: accountingRows,
                    csv: buildCsv(accountingRows, [
                        { key: 'category', label: 'Category' },
                        { key: 'component', label: 'Component' },
                        { key: 'amount', label: 'Amount' }
                    ])
                },
                userId
            ));
        } else if (type === 'COMPLIANCE_PF') {
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-pf.csv`,
                {
                    employeeCount: pfRows.length,
                    totalEmployeePf: roundMoney(pfRows.reduce((sum, row) => sum + normalizeMoney(row.employeePf, 0), 0), 0),
                    totalEmployerPf: roundMoney(pfRows.reduce((sum, row) => sum + normalizeMoney(row.employerPf, 0), 0), 0)
                },
                {
                    rows: pfRows,
                    csv: buildCsv(pfRows, [
                        { key: 'employeeId', label: 'Employee ID' },
                        { key: 'employeeName', label: 'Employee Name' },
                        { key: 'uan', label: 'UAN' },
                        { key: 'employeePf', label: 'Employee PF' },
                        { key: 'employerPf', label: 'Employer PF' }
                    ])
                },
                userId
            ));
        } else if (type === 'COMPLIANCE_ESI') {
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-esi.csv`,
                {
                    employeeCount: esiRows.length,
                    totalEmployeeEsi: roundMoney(esiRows.reduce((sum, row) => sum + normalizeMoney(row.employeeEsi, 0), 0), 0)
                },
                {
                    rows: esiRows,
                    csv: buildCsv(esiRows, [
                        { key: 'employeeId', label: 'Employee ID' },
                        { key: 'employeeName', label: 'Employee Name' },
                        { key: 'employeeEsi', label: 'Employee ESI' }
                    ])
                },
                userId
            ));
        } else if (type === 'COMPLIANCE_TDS') {
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-tds.csv`,
                {
                    employeeCount: tdsRows.length,
                    totalTds: roundMoney(tdsRows.reduce((sum, row) => sum + normalizeMoney(row.tds, 0), 0), 0)
                },
                {
                    rows: tdsRows,
                    csv: buildCsv(tdsRows, [
                        { key: 'employeeId', label: 'Employee ID' },
                        { key: 'employeeName', label: 'Employee Name' },
                        { key: 'pan', label: 'PAN' },
                        { key: 'regime', label: 'Tax Regime' },
                        { key: 'taxableIncome', label: 'Taxable Income' },
                        { key: 'tds', label: 'TDS' }
                    ])
                },
                userId
            ));
        } else if (type === 'EXCEPTION_REPORT') {
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-exceptions.csv`,
                {
                    exceptionCount: exceptionRows.length
                },
                {
                    rows: exceptionRows,
                    csv: buildCsv(exceptionRows, [
                        { key: 'employeeId', label: 'Employee ID' },
                        { key: 'type', label: 'Type' },
                        { key: 'message', label: 'Message' }
                    ])
                },
                userId
            ));
        } else if (type === 'VARIANCE_REPORT') {
            createdArtifacts.push(await createExportArtifact(
                db,
                tenantId,
                payrollRunId,
                type,
                'CSV',
                `${payrollRun.runCode || buildRunCode(payrollRun.year, payrollRun.month, payrollRun.sequenceNo, payrollRun.runType)}-variance.csv`,
                {
                    changedEmployees: varianceRows.filter((row) => normalizeMoney(row.grossDelta, 0) !== 0 || normalizeMoney(row.netDelta, 0) !== 0 || normalizeMoney(row.incomeTaxDelta, 0) !== 0).length
                },
                {
                    rows: varianceRows,
                    csv: buildCsv(varianceRows, [
                        { key: 'employeeId', label: 'Employee ID' },
                        { key: 'employeeName', label: 'Employee Name' },
                        { key: 'previousMonth', label: 'Previous Month' },
                        { key: 'previousYear', label: 'Previous Year' },
                        { key: 'grossDelta', label: 'Gross Delta' },
                        { key: 'netDelta', label: 'Net Delta' },
                        { key: 'incomeTaxDelta', label: 'Income Tax Delta' }
                    ])
                },
                userId
            ));
        }
    }

    payrollRun.exportArtifactIds = dedupeObjectIds([
        ...(payrollRun.exportArtifactIds || []),
        ...createdArtifacts.map((artifact) => artifact._id)
    ]);
    payrollRun.bankTransferSummary = createdArtifacts.find((artifact) => artifact.artifactType === 'BANK_TRANSFER')?.summary || payrollRun.bankTransferSummary || {};
    payrollRun.accountingSummary = createdArtifacts.find((artifact) => artifact.artifactType === 'ACCOUNTING_SUMMARY')?.summary || payrollRun.accountingSummary || {};
    payrollRun.complianceSummary = {
        pf: createdArtifacts.find((artifact) => artifact.artifactType === 'COMPLIANCE_PF')?.summary || {},
        esi: createdArtifacts.find((artifact) => artifact.artifactType === 'COMPLIANCE_ESI')?.summary || {},
        tds: createdArtifacts.find((artifact) => artifact.artifactType === 'COMPLIANCE_TDS')?.summary || {},
        exceptions: createdArtifacts.find((artifact) => artifact.artifactType === 'EXCEPTION_REPORT')?.summary || {},
        variance: createdArtifacts.find((artifact) => artifact.artifactType === 'VARIANCE_REPORT')?.summary || {}
    };
    await payrollRun.save();

    return createdArtifacts;
}

async function listRunExportArtifacts(db, tenantId, payrollRunId) {
    const PayrollExportArtifact = getModel(db, 'PayrollExportArtifact', PayrollExportArtifactSchema);
    return PayrollExportArtifact.find({ tenantId, payrollRunId }).sort({ createdAt: -1 }).lean();
}

async function buildRunOperationalSummary(db, tenantId, payrollRunId) {
    const PayrollRun = getModel(db, 'PayrollRun');
    const PayrollRunItem = getModel(db, 'PayrollRunItem');
    const payslipModel = getModel(db, 'Payslip');

    const payrollRun = await PayrollRun.findOne({ _id: payrollRunId, tenantId }).lean();
    if (!payrollRun) {
        throw lifecycleNotFoundError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found.');
    }

    const runItems = await PayrollRunItem.find({ tenantId, payrollRunId }).lean();
    const payslips = await payslipModel.find({ tenantId, payrollRunId }).lean();
    const exports = await listRunExportArtifacts(db, tenantId, payrollRunId);

    return {
        payrollRun,
        totals: {
            employees: runItems.length,
            generatedPayslips: payslips.length,
            overtimeAmount: roundMoney(runItems.reduce((sum, item) => sum + normalizeMoney(item.overtimeSummary?.amount, 0), 0), 0),
            variableInputs: roundMoney(runItems.reduce((sum, item) => sum + normalizeMoney(item.phase2InputSummary?.totalEarnings, 0), 0), 0),
            reimbursements: roundMoney(runItems.reduce((sum, item) => sum + normalizeMoney(item.phase2InputSummary?.totalReimbursements, 0), 0), 0),
            preTaxInputs: roundMoney(runItems.reduce((sum, item) => sum + normalizeMoney(item.phase2InputSummary?.totalPreTaxDeductions, 0), 0), 0),
            postTaxInputs: roundMoney(runItems.reduce((sum, item) => sum + normalizeMoney(item.phase2InputSummary?.totalPostTaxDeductions, 0), 0), 0),
            exceptionFlags: runItems.reduce((sum, item) => sum + ((item.exceptionFlags || []).length), 0)
        },
        exports
    };
}

module.exports = {
    applyResolvedInputsToGross,
    buildCsv,
    buildDefaultApprovalWorkflow,
    buildRunCode,
    calculateFiscalYearTaxStats,
    createPayrollInputBatch,
    ensureApprovalWorkflow,
    finalizeApprovedRun,
    forceApprovePayrollRun,
    formatPeriodKey,
    generateRunExports,
    getHttpStatusForError,
    getNextPayrollRunSequence,
    getPayrollInputBatchById,
    isPayrollLifecycleError,
    listPayrollInputBatches,
    listRunExportArtifacts,
    buildRunOperationalSummary,
    PayrollLifecycleError,
    mergeResolvedInputsIntoDeductions,
    mergeResolvedInputsIntoEmployerContributions,
    releaseInputBatchReservations,
    reserveInputBatchesForRun,
    resolveEmployeeRunInputs,
    resolveRunInputBatches,
    reviewPayrollRunApproval,
    submitPayrollRunForApproval,
    summarizeInputItems,
    transitionPayrollInputBatch
};
