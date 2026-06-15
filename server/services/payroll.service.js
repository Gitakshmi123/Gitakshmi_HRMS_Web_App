const mongoose = require('mongoose');
/**
 * Payroll Service
 * Core payroll calculation engine
 * 
 * IMPORTANT RULES:
 * 1. All calculations are server-side only (never in frontend)
 * 2. Payslip data is stored as immutable snapshots
 * 3. Past payslips are never recalculated
 * 4. Follows mandatory calculation order
 * 5. Multi-tenant safe: ALWAYS use db.model(), NEVER use mongoose.model()
 * 6. Graceful fallbacks: Never crash on missing compensation
 */

const tdsService = require('./tds.service');
const { normalizeCompensation, ensureGrossTotals, getComponentValue, normalizeComponentKey } = require('./componentNormalizer.service');
const canonicalPayroll = require('./canonicalPayroll.service');
const payrollRuleResolver = require('./payrollRuleResolver.service');
const payrollPhase1 = require('./payrollPhase1.service');
const payrollPhase2 = require('./payrollPhase2.service');

/**
 * Safe model loader for multi-tenant DB access
 * Prevents "Schema not registered" errors by using db.model() pattern
 */
function getSafeModel(db, modelName, schema) {
    try {
        return db.model(modelName, schema);
    } catch (e) {
        // Already registered on this db connection
        return db.model(modelName);
    }
}

function getDeductionPeriodQuery(payrollStartDate = null, payrollEndDate = null) {
    const fallbackDate = new Date();
    const periodStart = payrollStartDate instanceof Date && !isNaN(payrollStartDate.getTime())
        ? payrollStartDate
        : fallbackDate;
    const periodEnd = payrollEndDate instanceof Date && !isNaN(payrollEndDate.getTime())
        ? payrollEndDate
        : periodStart;

    return {
        startDate: { $lte: periodEnd },
        $or: [
            { endDate: null },
            { endDate: { $exists: false } },
            { endDate: { $gte: periodStart } }
        ]
    };
}

function normalizeDeductionName(name = '') {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isStatutoryAutoDeductionName(name = '') {
    const normalized = normalizeDeductionName(name);
    return (
        normalized.includes('epf') ||
        normalized.includes('provident fund') ||
        normalized === 'pf' ||
        normalized.includes('employee state insurance') ||
        normalized === 'esi' ||
        normalized.includes('tds') ||
        normalized.includes('income tax')
    );
}

function isProfessionalTaxName(name = '') {
    const normalized = normalizeDeductionName(name);
    return normalized.includes('professional tax') || normalized === 'pt' || normalized.includes('ptax');
}

function getTemplateDeductionCategory(deduction = {}) {
    const rawCategory = String(deduction.category || deduction.deductionCategory || '').trim().toUpperCase();
    const name = normalizeDeductionName(deduction.name || deduction.label || deduction.componentName);

    if (rawCategory.includes('PRE')) return 'PRE_TAX';
    if (rawCategory.includes('POST')) return 'POST_TAX';
    if (name.includes('professional tax') || name === 'pt' || name.includes('ptax')) return 'PRE_TAX';
    if (
        name.includes('loan') ||
        name.includes('advance') ||
        name.includes('penalty') ||
        name.includes('fine') ||
        name.includes('loss of pay') ||
        name.includes('lop')
    ) {
        return 'POST_TAX';
    }

    return 'POST_TAX';
}

function getTemplateDeductionAmount(deduction = {}, grossEarnings = 0, basicAmount = 0) {
    const amountType = String(deduction.amountType || deduction.calculationType || '').trim().toUpperCase();
    const rawFixed = deduction.monthlyAmount ?? deduction.amount ?? deduction.amountValue ?? deduction.customValue ?? deduction.value;
    const fixedAmount = parseFloat(String(rawFixed || 0).replace(/[^0-9.-]+/g, '')) || 0;

    if (amountType === 'PERCENTAGE' || amountType === 'PERCENT_BASIC' || amountType === 'PERCENT_GROSS') {
        const rawRate = deduction.percentage ?? deduction.amountValue ?? deduction.value ?? fixedAmount;
        const rate = parseFloat(String(rawRate || 0).replace(/[^0-9.-]+/g, '')) || 0;
        const calculationBase = String(deduction.calculationBase || '').trim().toUpperCase();
        const baseAmount = amountType === 'PERCENT_BASIC' || calculationBase === 'BASIC'
            ? basicAmount
            : grossEarnings;

        return Math.round((baseAmount * rate / 100) * 100) / 100;
    }

    return Math.round(fixedAmount * 100) / 100;
}

function mapTemplateDeductionSnapshotCategory(deduction = {}, targetCategory) {
    const name = normalizeDeductionName(deduction.name || deduction.label || deduction.componentName);

    if (targetCategory === 'PRE_TAX') {
        if (name.includes('professional tax') || name === 'pt' || name.includes('ptax')) return 'PROFESSIONAL_TAX';
        if (name.includes('tds') || name.includes('income tax')) return 'TDS';
        if (name.includes('epf') || name.includes('pf') || name.includes('provident fund')) return 'EPF';
        if (name.includes('esi') || name.includes('employee state insurance')) return 'ESI';
        return 'OTHER';
    }

    if (name.includes('loan')) return 'LOAN';
    if (name.includes('advance')) return 'ADVANCE';
    if (name.includes('penalty') || name.includes('fine')) return 'PENALTY';
    if (name.includes('lop') || name.includes('loss of pay')) return 'LOP';
    return 'OTHER';
}

function appendTemplateDeductions(snapshot, total, templateDeductions, targetCategory, grossEarnings, basicAmount) {
    if (!Array.isArray(templateDeductions) || templateDeductions.length === 0) {
        return total;
    }

    for (const deduction of templateDeductions) {
        if (!deduction || deduction.enabled === false) continue;

        const name = deduction.name || deduction.label || deduction.componentName || 'Salary Deduction';
        if (getTemplateDeductionCategory(deduction) !== targetCategory) continue;

        // PF/ESI/TDS are handled by the statutory/TDS paths; do not double-deduct salary setup lines.
        if (isStatutoryAutoDeductionName(name)) continue;

        const duplicate = snapshot.some(item => normalizeDeductionName(item.name) === normalizeDeductionName(name));
        if (duplicate) continue;

        const amount = getTemplateDeductionAmount(deduction, grossEarnings, basicAmount);
        if (amount <= 0) continue;

        snapshot.push({
            name,
            amount,
            category: mapTemplateDeductionSnapshotCategory(deduction, targetCategory)
        });
        total += amount;
    }

    return total;
}

function shouldAllowMissingAttendanceFallback(settings = {}, attendancePolicy = null) {
    if (attendancePolicy === 'STRICT') {
        return false;
    }
    if (attendancePolicy === 'ALLOW_FALLBACK') {
        return true;
    }
    const envValue = String(process.env.PAYROLL_ALLOW_MISSING_ATTENDANCE_FALLBACK || '').trim().toLowerCase();
    return settings.allowMissingAttendanceFallback === true || envValue === 'true' || envValue === '1';
}

function resolveMissingAttendanceFallbackMode(settings = {}) {
    const modeFromSettings = String(settings?.missingAttendanceFallbackMode || '').trim().toUpperCase();
    const modeFromEnv = String(process.env.PAYROLL_MISSING_ATTENDANCE_FALLBACK_MODE || '').trim().toUpperCase();
    const mode = modeFromSettings || modeFromEnv;
    if (mode === 'FULL_PRESENT') return 'FULL_PRESENT';
    if (mode === 'ZERO_PRESENT') return 'ZERO_PRESENT';
    return 'ZERO_PRESENT';
}

function parseBooleanFlag(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    return fallback;
}

function hasExplicitFlag(value) {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
}

function resolvePayrollProfileResolutionPolicy(options = {}) {
    const strictOption = options.requirePayrollProfile ?? options.profileStrictMode;
    const autoBackfillOption = options.autoBackfillPayrollProfile ?? options.profileAutoBackfill;
    const backfillFailOption = options.failOnPayrollProfileBackfillError ?? options.profileBackfillFailOnError;

    const strictEnvRaw = process.env.PAYROLL_PROFILE_STRICT_MODE;
    const autoBackfillEnvRaw = process.env.PAYROLL_PROFILE_AUTO_BACKFILL;
    const backfillFailEnvRaw = process.env.PAYROLL_PROFILE_BACKFILL_FAIL_ON_ERROR;
    const legacyRequireProfileRaw = process.env.PAYROLL_REQUIRE_PROFILE;

    const strict = hasExplicitFlag(strictOption)
        ? parseBooleanFlag(strictOption, true)
        : hasExplicitFlag(strictEnvRaw)
            ? parseBooleanFlag(strictEnvRaw, true)
            : hasExplicitFlag(legacyRequireProfileRaw)
                ? parseBooleanFlag(legacyRequireProfileRaw, false)
                : true;
    const autoBackfill = hasExplicitFlag(autoBackfillOption)
        ? parseBooleanFlag(autoBackfillOption, true)
        : hasExplicitFlag(autoBackfillEnvRaw)
            ? parseBooleanFlag(autoBackfillEnvRaw, true)
            : true;
    const failOnBackfillError = hasExplicitFlag(backfillFailOption)
        ? parseBooleanFlag(backfillFailOption, strict)
        : hasExplicitFlag(backfillFailEnvRaw)
            ? parseBooleanFlag(backfillFailEnvRaw, strict)
            : strict;

    return {
        strict,
        autoBackfill,
        failOnBackfillError
    };
}

function normalizeTdsFailurePolicy(value, fallback = 'STRICT') {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return fallback;
    if (['STRICT', 'FAIL'].includes(normalized)) return 'STRICT';
    if (['FALLBACK_TO_ZERO', 'FALLBACK_ZERO', 'ZERO'].includes(normalized)) return 'FALLBACK_TO_ZERO';
    if (['WARN_AND_ZERO', 'WARN_ZERO', 'WARNING_ZERO'].includes(normalized)) return 'WARN_AND_ZERO';
    return fallback;
}

function resolveTdsFailurePolicy(options = {}) {
    const optionPolicy = options.tdsFailurePolicy;
    const envPolicy = process.env.PAYROLL_TDS_FAILURE_POLICY;
    const legacyAllowZero = process.env.PAYROLL_ALLOW_TDS_ZERO_FALLBACK;

    if (hasExplicitFlag(optionPolicy)) {
        return normalizeTdsFailurePolicy(optionPolicy, 'STRICT');
    }

    if (hasExplicitFlag(envPolicy)) {
        return normalizeTdsFailurePolicy(envPolicy, 'STRICT');
    }

    if (hasExplicitFlag(legacyAllowZero) && parseBooleanFlag(legacyAllowZero, false)) {
        return 'FALLBACK_TO_ZERO';
    }

    return 'STRICT';
}

function normalizeRunOptions(options = {}) {
    if (Array.isArray(options)) {
        const selectedEmployeeIds = options
            .map((item) => item?.employeeId)
            .filter(Boolean);
        return {
            selectedEmployeeIds,
            selectedItems: options,
            runType: selectedEmployeeIds.length > 0 ? 'SELECTED' : 'FULL'
        };
    }

    return options || {};
}

function buildPayrollEmployeeFilter(tenantId, payrollRun = {}) {
    const filter = {
        tenant: tenantId,
        status: { $in: ['Active', 'active', 'ACTIVE'] },
        $or: [
            { payrollLocked: { $ne: true } },
            { payrollLocked: { $exists: false } }
        ]
    };

    if (payrollRun.isFiltered && payrollRun.filters) {
        const { department, designation, employeeType, workMode, employeeTypes, workModes } = payrollRun.filters;

        if (department && department !== 'All Departments') {
            filter.department = department;
        }

        if (designation && designation !== 'All Designations') {
            filter.designation = designation;
        }

        const types = employeeType || employeeTypes;
        if (types && types.length > 0) {
            filter.employeeType = { $in: Array.isArray(types) ? types : [types] };
        }

        const modes = workMode || workModes;
        if (modes && modes.length > 0) {
            filter.workMode = { $in: Array.isArray(modes) ? modes : [modes] };
        }
    }

    return filter;
}

function roundPayrollAmount(value, fallback = 0) {
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

function shouldSkipResolvedDeduction(record = {}) {
    if (!record || record.enabled === false) return true;
    if (record.deductionType === 'ONE_TIME' && record.isOneTimeApplied === true) return true;
    if (record.status && ['INACTIVE', 'COMPLETED', 'CANCELLED'].includes(record.status)) return true;
    return false;
}

function isResolvedDeductionProfessionalTax(record = {}) {
    return record.statutoryCategory === 'PROFESSIONAL_TAX' || isProfessionalTaxName(record.name);
}

function isResolvedDeductionStatutory(record = {}) {
    const category = String(record.statutoryCategory || '').toUpperCase();
    return ['EPF', 'ESI', 'PROFESSIONAL_TAX', 'TDS'].includes(category) || isStatutoryAutoDeductionName(record.name);
}

function resolveDeductionAmount(record = {}, grossEarnings = 0, basicAmount = 0) {
    if (record.installmentAmount !== null && record.installmentAmount !== undefined && Number(record.installmentAmount) > 0) {
        return roundPayrollAmount(record.installmentAmount, 0);
    }

    const amountType = String(record.amountType || 'FIXED').trim().toUpperCase();
    const amountValue = roundPayrollAmount(record.amountValue, 0);

    if (amountType === 'PERCENTAGE') {
        const calculationBase = String(record.calculationBase || 'GROSS').trim().toUpperCase();
        const baseAmount = calculationBase === 'BASIC' ? basicAmount : grossEarnings;
        return roundPayrollAmount((baseAmount * amountValue) / 100, 0);
    }

    return amountValue;
}

function getDeductionSourceRank(record = {}) {
    const sourceType = String(record.sourceType || '').toUpperCase();
    if (sourceType === 'EMPLOYEE_ASSIGNMENT') return 0;
    if (sourceType === 'MANUAL') return 1;
    if (sourceType === 'MASTER') return 2;
    if (sourceType === 'SALARY_VERSION') return 3;
    return 4;
}

function buildUnifiedDeductionKey(record = {}) {
    return [
        String(record.category || 'POST_TAX').trim().toUpperCase(),
        normalizeDeductionName(record.name || ''),
        String(record.calculationBase || 'GROSS').trim().toUpperCase()
    ].join('::');
}

function mapTemplateDeductionStatutoryCategory(deduction = {}, category = 'POST_TAX') {
    return mapTemplateDeductionSnapshotCategory(deduction, category);
}

function extractSalaryVersionDeductions(components = []) {
    return (Array.isArray(components) ? components : [])
        .filter((component) => component && String(component.type || '').toUpperCase() === 'DEDUCTION')
        .map((component, index) => {
            const name = component.name || component.label || `Salary Deduction ${index + 1}`;
            const category = getTemplateDeductionCategory(component);
            const amountType = String(component.amountType || component.calculationType || '').trim().toUpperCase();
            const rawFixed = component.monthlyAmount ?? component.amount ?? component.value ?? component.componentAmount;
            const fixedAmount = roundPayrollAmount(rawFixed, 0);
            const rawPercentage = component.percentage ?? component.amountValue ?? component.value ?? fixedAmount;
            const percentage = roundPayrollAmount(rawPercentage, 0);

            return {
                deductionId: null,
                employeeDeductionId: null,
                name,
                category,
                amountType: ['PERCENTAGE', 'PERCENT_BASIC', 'PERCENT_GROSS'].includes(amountType) ? 'PERCENTAGE' : 'FIXED',
                amountValue: ['PERCENTAGE', 'PERCENT_BASIC', 'PERCENT_GROSS'].includes(amountType) ? percentage : fixedAmount,
                calculationBase: amountType === 'PERCENT_BASIC'
                    ? 'BASIC'
                    : String(component.calculationBase || '').trim().toUpperCase() === 'BASIC'
                        ? 'BASIC'
                        : 'GROSS',
                deductionType: String(component.deductionType || 'RECURRING').trim().toUpperCase() || 'RECURRING',
                statutoryCategory: mapTemplateDeductionStatutoryCategory(component, category),
                priority: 200 + index,
                installmentAmount: null,
                remainingInstallments: null,
                isOneTimeApplied: false,
                status: component.enabled === false ? 'INACTIVE' : 'ACTIVE',
                source: 'SALARY_VERSION',
                sourceType: 'SALARY_VERSION',
                metadata: {
                    componentType: 'DEDUCTION',
                    componentName: name,
                    includedInSalaryVersion: true
                },
                enabled: component.enabled !== false
            };
        })
        .filter((record) => !shouldSkipResolvedDeduction(record));
}

function mergeUnifiedDeductionRecords(records = []) {
    const merged = [];
    const duplicates = [];
    const registry = new Map();

    for (const record of records) {
        if (!record || shouldSkipResolvedDeduction(record)) continue;
        const key = buildUnifiedDeductionKey(record);
        const existingIndex = registry.get(key);
        if (existingIndex === undefined) {
            registry.set(key, merged.length);
            merged.push(record);
            continue;
        }

        const existing = merged[existingIndex];
        const shouldReplace =
            getDeductionSourceRank(record) < getDeductionSourceRank(existing) ||
            (
                getDeductionSourceRank(record) === getDeductionSourceRank(existing) &&
                Number(record.priority || 100) < Number(existing.priority || 100)
            );

        duplicates.push({
            key,
            kept: shouldReplace ? record.name : existing.name,
            discarded: shouldReplace ? existing.name : record.name,
            sources: [existing.sourceType || existing.source || 'UNKNOWN', record.sourceType || record.source || 'UNKNOWN']
        });

        if (shouldReplace) {
            merged[existingIndex] = record;
        }
    }

    merged.sort((left, right) => {
        const priorityGap = Number(left.priority || 100) - Number(right.priority || 100);
        if (priorityGap !== 0) return priorityGap;
        return getDeductionSourceRank(left) - getDeductionSourceRank(right);
    });

    return {
        items: merged,
        duplicates
    };
}

async function getResolvedEmployeeDeductions(
    db,
    tenantId,
    employeeId,
    payrollStartDate = null,
    payrollEndDate = null,
    category = null
) {
    const EmployeeDeduction = db.model('EmployeeDeduction');
    const records = await EmployeeDeduction.find({
        tenantId,
        employeeId,
        status: { $in: ['ACTIVE', 'COMPLETED'] },
        ...getDeductionPeriodQuery(payrollStartDate, payrollEndDate)
    }).populate('deductionId').lean();

    return records
        .filter((record) => record && record.deductionId)
        .map((record) => {
            const master = record.deductionId || {};
            return {
                employeeDeductionId: record._id,
                deductionId: master._id || null,
                name: record.nameSnapshot || master.name || 'Employee Deduction',
                category: record.categoryOverride || master.category || 'POST_TAX',
                amountType: record.amountTypeOverride || master.amountType || 'FIXED',
                amountValue: record.customValue !== null && record.customValue !== undefined
                    ? record.customValue
                    : master.amountValue,
                calculationBase: record.calculationBaseOverride || master.calculationBase || 'GROSS',
                deductionType: record.deductionType || master.deductionType || 'RECURRING',
                statutoryCategory: master.statutoryCategory || 'OTHER',
                priority: Number(master.priority || 100),
                installmentAmount: record.installmentAmount,
                remainingInstallments: record.remainingInstallments,
                isOneTimeApplied: record.isOneTimeApplied === true,
                status: record.status || 'ACTIVE',
                source: record.source || 'MASTER',
                sourceType: 'EMPLOYEE_ASSIGNMENT',
                metadata: record.metadata || {},
                rawRecord: record
            };
        })
        .filter((record) => !category || record.category === category)
        .filter((record) => !shouldSkipResolvedDeduction(record))
        .sort((left, right) => left.priority - right.priority);
}

async function getUnifiedEmployeeDeductionPlan(
    db,
    tenantId,
    employeeId,
    payrollStartDate = null,
    payrollEndDate = null,
    salaryComponents = []
) {
    const [employeeAssignments] = await Promise.all([
        getResolvedEmployeeDeductions(
            db,
            tenantId,
            employeeId,
            payrollStartDate,
            payrollEndDate,
            null
        )
    ]);

    const salaryVersionDeductions = extractSalaryVersionDeductions(salaryComponents);
    const merged = mergeUnifiedDeductionRecords([
        ...employeeAssignments,
        ...salaryVersionDeductions
    ]);

    const preTax = merged.items.filter((item) => item.category === 'PRE_TAX');
    const postTax = merged.items.filter((item) => item.category !== 'PRE_TAX');

    return {
        items: merged.items,
        duplicates: merged.duplicates,
        preTax,
        postTax,
        summary: {
            totalCount: merged.items.length,
            preTaxCount: preTax.length,
            postTaxCount: postTax.length,
            employeeAssignmentCount: employeeAssignments.length,
            salaryVersionCount: salaryVersionDeductions.length
        }
    };
}

function normalizeBoundaryStart(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || new Date());
    if (Number.isNaN(date.getTime())) return new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function normalizeBoundaryEnd(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || new Date());
    if (Number.isNaN(date.getTime())) return new Date();
    date.setHours(23, 59, 59, 999);
    return date;
}

function getIsoDateKey(value) {
    if (!value) return '';
    const date = normalizeBoundaryStart(value);
    return date.toISOString().split('T')[0];
}

function parseIsoDateKey(value) {
    return new Date(`${value}T00:00:00.000Z`);
}

function isDateWithinRange(value, rangeStart, rangeEnd) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= normalizeBoundaryStart(rangeStart) && date <= normalizeBoundaryEnd(rangeEnd);
}

function daysBetweenInclusive(start, end) {
    const startDate = normalizeBoundaryStart(start);
    const endDate = normalizeBoundaryStart(end);
    if (endDate < startDate) return 0;
    return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
}

function filterHolidayDatesForRange(holidayDates = new Set(), rangeStart, rangeEnd) {
    const result = new Set();
    for (const value of holidayDates) {
        const parsed = parseIsoDateKey(value);
        if (parsed >= normalizeBoundaryStart(rangeStart) && parsed <= normalizeBoundaryEnd(rangeEnd)) {
            result.add(value);
        }
    }
    return result;
}

function buildLocationSegmentLabel(segment = {}) {
    const snapshot = segment.locationPolicySnapshot || {};
    const parts = [
        snapshot.workCity || '',
        snapshot.workState || '',
        snapshot.payrollRegion || ''
    ].filter(Boolean);
    const location = parts[0] || segment.profileSnapshot?.workCity || segment.profileSnapshot?.workState || 'Default Policy';
    return `${location} (${getIsoDateKey(segment.segmentStart)} to ${getIsoDateKey(segment.segmentEnd)})`;
}

function selectPrimaryLocationSegment(locationSegments = [], startDate = null) {
    if (!Array.isArray(locationSegments) || locationSegments.length === 0) return null;
    const segmentCoveringStart = locationSegments.find((segment) =>
        isDateWithinRange(startDate || new Date(), segment.segmentStart, segment.segmentEnd)
    );
    if (segmentCoveringStart) return segmentCoveringStart;

    return [...locationSegments].sort((left, right) => {
        const rightDays = Number(right.calendarDays || 0);
        const leftDays = Number(left.calendarDays || 0);
        return rightDays - leftDays;
    })[0] || null;
}

async function buildLocationPolicySegments(
    db,
    tenantId,
    rawSegments = [],
    attendanceRecords = [],
    holidayDates = new Set(),
    joiningDate = null,
    options = {}
) {
    const startDate = normalizeBoundaryStart(options.startDate || new Date());
    const endDate = normalizeBoundaryEnd(options.endDate || startDate);
    const fallbackSegments = Array.isArray(rawSegments) && rawSegments.length > 0
        ? rawSegments
        : [{
            profile: null,
            segmentStart: startDate,
            segmentEnd: endDate,
            isGap: true,
            source: 'DEFAULT'
        }];

    const segments = [];
    for (const rawSegment of fallbackSegments) {
        const segmentStart = normalizeBoundaryStart(rawSegment.segmentStart || startDate);
        const segmentEnd = normalizeBoundaryEnd(rawSegment.segmentEnd || endDate);
        const segmentAttendance = (Array.isArray(attendanceRecords) ? attendanceRecords : [])
            .filter((record) => isDateWithinRange(record.date, segmentStart, segmentEnd));
        const segmentHolidayDates = filterHolidayDatesForRange(holidayDates, segmentStart, segmentEnd);
        const calendarDays = daysBetweenInclusive(segmentStart, segmentEnd);
        const attendanceSummary = calculateAttendanceSummary(
            segmentAttendance,
            calendarDays,
            segmentHolidayDates,
            joiningDate ? new Date(joiningDate) : null,
            segmentStart,
            options.employeeId || null,
            segmentEnd
        );

        let locationPolicy = null;
        let locationPolicySnapshot = null;
        try {
            locationPolicy = await payrollRuleResolver.resolvePayrollLocationPolicy(
                db,
                tenantId,
                rawSegment.profile || null
            );
            locationPolicySnapshot = payrollRuleResolver.buildLocationPolicySnapshot(locationPolicy);
        } catch (_err) {
            locationPolicy = payrollRuleResolver.buildResolvedLocationPolicy({}, rawSegment.profile || null);
            locationPolicySnapshot = payrollRuleResolver.buildLocationPolicySnapshot(locationPolicy);
        }

        segments.push({
            segmentStart,
            segmentEnd,
            calendarDays,
            isGap: rawSegment.isGap === true,
            source: rawSegment.source || 'DEFAULT',
            profile: rawSegment.profile || null,
            profileSnapshot: canonicalPayroll.buildPayrollProfileSnapshot(rawSegment.profile || null),
            attendanceSummary,
            locationPolicy,
            locationPolicySnapshot
        });
    }

    if ((Array.isArray(attendanceRecords) ? attendanceRecords.length : 0) === 0 && options.zeroPresentFallback === true) {
        segments.forEach((segment) => {
            segment.attendanceSummary.presentDays = 0;
        });
    }

    return segments;
}

function findLocationSegmentForDate(locationSegments = [], dateValue = null) {
    return (Array.isArray(locationSegments) ? locationSegments : []).find((segment) =>
        isDateWithinRange(dateValue, segment.segmentStart, segment.segmentEnd)
    ) || null;
}

function applyLocationPolicyToResolvedInputs(resolvedInputs = {}, locationSegments = [], holidayDates = new Set()) {
    if (!resolvedInputs || !Array.isArray(resolvedInputs.earnings) || resolvedInputs.earnings.length === 0) {
        return resolvedInputs;
    }

    let earningsDelta = 0;
    let overtimeDelta = 0;

    for (const input of resolvedInputs.earnings) {
        if (String(input.inputType || '').toUpperCase() !== 'OVERTIME') continue;
        const segment = findLocationSegmentForDate(locationSegments, input.attendanceDate || input.metadata?.attendanceDate);
        const overtimePolicy = segment?.locationPolicy?.overtime;
        if (!overtimePolicy || overtimePolicy.enabled !== true) continue;

        const attendanceDate = input.attendanceDate ? new Date(input.attendanceDate) : null;
        const dateKey = attendanceDate ? getIsoDateKey(attendanceDate) : '';
        const isHoliday = dateKey ? holidayDates.has(dateKey) : false;
        const weeklyOffDays = Array.isArray(segment?.locationPolicySnapshot?.weeklyOffDays)
            ? segment.locationPolicySnapshot.weeklyOffDays
            : [];
        const isWeeklyOff = attendanceDate ? weeklyOffDays.includes(attendanceDate.getUTCDay()) : false;
        const baseHourlyRate = roundPayrollAmount(
            overtimePolicy.fixedHourlyRate ?? input.metadata?.hourlyBaseRate ?? input.rate,
            0
        );
        let multiplier = roundPayrollAmount(overtimePolicy.multiplier, 1);
        if (isHoliday) {
            multiplier = roundPayrollAmount(overtimePolicy.holidayMultiplier, multiplier);
        } else if (isWeeklyOff) {
            multiplier = roundPayrollAmount(overtimePolicy.weeklyOffMultiplier, multiplier);
        }

        const nextRate = overtimePolicy.fixedHourlyRate !== null && overtimePolicy.fixedHourlyRate !== undefined
            ? roundPayrollAmount(baseHourlyRate * multiplier, 0)
            : roundPayrollAmount(baseHourlyRate * multiplier, 0);
        const nextAmount = roundPayrollAmount((input.quantity || 0) * nextRate, 0);
        const previousAmount = roundPayrollAmount(input.amount, 0);
        const delta = nextAmount - previousAmount;
        if (delta === 0) continue;

        input.rate = nextRate;
        input.amount = nextAmount;
        input.name = overtimePolicy.label || input.name || 'Overtime Pay';
        input.metadata = {
            ...(input.metadata || {}),
            cityPolicyApplied: true,
            locationPolicyRuleId: segment?.locationPolicySnapshot?.locationRuleId || null,
            locationPolicyLabel: buildLocationSegmentLabel(segment),
            overtimeMultiplier: multiplier
        };
        earningsDelta += delta;
        overtimeDelta += delta;
    }

    if (earningsDelta !== 0) {
        resolvedInputs.summary = {
            ...(resolvedInputs.summary || {}),
            totalEarnings: roundPayrollAmount((resolvedInputs.summary?.totalEarnings || 0) + earningsDelta, 0)
        };
        resolvedInputs.overtimeSummary = {
            ...(resolvedInputs.overtimeSummary || {}),
            amount: roundPayrollAmount((resolvedInputs.overtimeSummary?.amount || 0) + overtimeDelta, 0)
        };
    }

    return resolvedInputs;
}

function applyLocationPolicyEarningAdjustments(grossCalculation = {}, locationSegments = [], totalPayrollDays = 0) {
    const next = {
        ...grossCalculation,
        earningsSnapshot: Array.isArray(grossCalculation.earningsSnapshot) ? [...grossCalculation.earningsSnapshot] : [],
        totalGross: roundPayrollAmount(grossCalculation.totalGross, 0),
        taxableGross: roundPayrollAmount(grossCalculation.taxableGross || grossCalculation.totalGross, 0),
        basicAmount: roundPayrollAmount(grossCalculation.basicAmount, 0),
        originalBasicAmount: roundPayrollAmount(grossCalculation.originalBasicAmount, 0)
    };
    const denominator = Math.max(
        1,
        Number(totalPayrollDays || 0) ||
        (Array.isArray(locationSegments) ? locationSegments.reduce((sum, segment) => sum + Number(segment.calendarDays || 0), 0) : 0)
    );
    const baseGrossTotal = roundPayrollAmount(next.totalGross, 0);

    for (const segment of Array.isArray(locationSegments) ? locationSegments : []) {
        const presentDays = roundPayrollAmount(segment.attendanceSummary?.presentDays, 0);
        const weight = roundPayrollAmount(
            (presentDays > 0 ? presentDays : Number(segment.calendarDays || 0)) / denominator,
            6
        );
        if (weight <= 0) continue;

        const label = buildLocationSegmentLabel(segment);
        const policy = segment.locationPolicy || {};

        if (policy.localAllowance?.amount > 0 && policy.localAllowance?.includedInCtc !== true) {
            const localAllowanceAmount = roundPayrollAmount(policy.localAllowance.amount * weight, 0);
            if (localAllowanceAmount > 0) {
                next.earningsSnapshot.push({
                    name: policy.localAllowance.label || `Local Allowance - ${label}`,
                    amount: localAllowanceAmount,
                    isProRata: true,
                    originalAmount: roundPayrollAmount(policy.localAllowance.amount, 0),
                    daysWorked: presentDays || Number(segment.calendarDays || 0),
                    totalDays: denominator
                });
                next.totalGross = roundPayrollAmount(next.totalGross + localAllowanceAmount, 0);
                next.taxableGross = roundPayrollAmount(next.taxableGross + localAllowanceAmount, 0);
            }
        }

        if (policy.minimumWage?.monthlyAmount > 0) {
            const targetMinimum = roundPayrollAmount(policy.minimumWage.monthlyAmount * weight, 0);
            const currentShare = roundPayrollAmount(baseGrossTotal * weight, 0);
            if (targetMinimum > currentShare) {
                const topUp = roundPayrollAmount(targetMinimum - currentShare, 0);
                next.earningsSnapshot.push({
                    name: `Minimum Wage Top-Up - ${label}`,
                    amount: topUp,
                    isProRata: true,
                    originalAmount: roundPayrollAmount(policy.minimumWage.monthlyAmount, 0),
                    daysWorked: presentDays || Number(segment.calendarDays || 0),
                    totalDays: denominator
                });
                next.totalGross = roundPayrollAmount(next.totalGross + topUp, 0);
                next.taxableGross = roundPayrollAmount(next.taxableGross + topUp, 0);
            }
        }
    }

    return next;
}

function buildLocationPolicySegmentSnapshots(locationSegments = []) {
    return (Array.isArray(locationSegments) ? locationSegments : []).map((segment) => ({
        segmentStart: segment.segmentStart,
        segmentEnd: segment.segmentEnd,
        calendarDays: segment.calendarDays,
        isGap: segment.isGap === true,
        source: segment.source || 'DEFAULT',
        attendanceSummary: segment.attendanceSummary || {},
        profile: segment.profileSnapshot || null,
        locationPolicy: segment.locationPolicySnapshot || null
    }));
}

function calculateProfessionalTaxForSegments(locationSegments = [], statutoryRuleSet = null, grossEarnings = 0, totalPayrollDays = 0) {
    if (!Array.isArray(locationSegments) || locationSegments.length === 0) return 0;
    const denominator = Math.max(1, Number(totalPayrollDays || 0));
    let total = 0;

    for (const segment of locationSegments) {
        const calendarWeight = roundPayrollAmount(Number(segment.calendarDays || 0) / denominator, 6);
        if (calendarWeight <= 0) continue;

        const policy = segment.locationPolicy || {};
        const policyAmount = roundPayrollAmount(policy.professionalTax?.amount, 0);
        const statutoryAmount = calculateProfessionalTaxFromSlabs(
            statutoryRuleSet?.professionalTax?.slabs || [],
            roundPayrollAmount(grossEarnings * calendarWeight, 0)
        ) || roundPayrollAmount(statutoryRuleSet?.professionalTax?.defaultAmount, 0);
        const amount = policy.professionalTax?.enabled === false
            ? 0
            : (policyAmount > 0 ? policyAmount : statutoryAmount);

        total = roundPayrollAmount(total + (amount * calendarWeight), 0);
    }

    return total;
}

function calculateLwfForSegments(locationSegments = [], payrollStartDate = null, totalPayrollDays = 0) {
    if (!Array.isArray(locationSegments) || locationSegments.length === 0) return 0;
    const payrollMonth = payrollStartDate ? new Date(payrollStartDate).getUTCMonth() + 1 : null;
    const denominator = Math.max(1, Number(totalPayrollDays || 0));
    let total = 0;

    for (const segment of locationSegments) {
        const policy = segment.locationPolicy?.statutoryApplicability || {};
        if (policy.lwfEnabled !== true) continue;
        if (policy.lwfDeductionMonth && payrollMonth && Number(policy.lwfDeductionMonth) !== Number(payrollMonth)) continue;

        const calendarWeight = roundPayrollAmount(Number(segment.calendarDays || 0) / denominator, 6);
        if (calendarWeight <= 0) continue;

        total = roundPayrollAmount(
            total + (roundPayrollAmount(policy.lwfEmployeeAmount, 0) * calendarWeight),
            0
        );
    }

    return total;
}

function calculateApplicableEsiGross(locationSegments = [], grossEarnings = 0, totalPayrollDays = 0) {
    if (!Array.isArray(locationSegments) || locationSegments.length === 0) {
        return {
            applicableGross: grossEarnings,
            hasExplicitOverride: false
        };
    }

    const denominator = Math.max(1, Number(totalPayrollDays || 0));
    let applicableGross = 0;
    let hasExplicitOverride = false;

    for (const segment of locationSegments) {
        const applicability = segment.locationPolicy?.statutoryApplicability?.esiApplicable;
        const weight = roundPayrollAmount(Number(segment.calendarDays || 0) / denominator, 6);
        if (weight <= 0) continue;
        if (applicability !== null && applicability !== undefined) {
            hasExplicitOverride = true;
        }
        if (applicability === false) continue;
        applicableGross = roundPayrollAmount(applicableGross + (grossEarnings * weight), 0);
    }

    return {
        applicableGross: hasExplicitOverride ? applicableGross : grossEarnings,
        hasExplicitOverride
    };
}

async function markEmployeeDeductionsApplied(db, deductions = []) {
    if (!Array.isArray(deductions) || deductions.length === 0) return;
    const EmployeeDeduction = db.model('EmployeeDeduction');

    for (const deduction of deductions) {
        if (!deduction?.employeeDeductionId) continue;

        const update = {};
        const set = {};

        if (deduction.deductionType === 'ONE_TIME') {
            set.isOneTimeApplied = true;
            set.status = 'COMPLETED';
        } else if (Number.isFinite(Number(deduction.remainingInstallments)) && Number(deduction.remainingInstallments) > 0) {
            const remaining = Number(deduction.remainingInstallments) - 1;
            set.remainingInstallments = Math.max(remaining, 0);
            if (remaining <= 0) {
                set.status = 'COMPLETED';
            }
        }

        if (Object.keys(set).length === 0) continue;
        update.$set = set;
        await EmployeeDeduction.updateOne({ _id: deduction.employeeDeductionId }, update);
    }
}

function calculateProfessionalTaxFromSlabs(slabs = [], grossEarnings = 0) {
    if (!Array.isArray(slabs) || slabs.length === 0) return 0;

    for (const slab of slabs) {
        const minIncome = roundPayrollAmount(slab.minIncome, 0);
        const maxIncome = slab.maxIncome === null || slab.maxIncome === undefined || slab.maxIncome === ''
            ? null
            : roundPayrollAmount(slab.maxIncome, 0);
        const amount = roundPayrollAmount(slab.amount, 0);

        if (grossEarnings >= minIncome && (maxIncome === null || grossEarnings <= maxIncome)) {
            return amount;
        }
    }

    return 0;
}

function buildTraceStep(order, code, label, formula, inputs, result) {
    return {
        order,
        code,
        label,
        formula,
        inputs,
        result
    };
}

function mapResolvedPreTaxSnapshotCategory(record = {}) {
    const statutoryCategory = String(record.statutoryCategory || '').toUpperCase();
    if (['EPF', 'ESI', 'PROFESSIONAL_TAX', 'TDS'].includes(statutoryCategory)) {
        return statutoryCategory;
    }
    return 'OTHER';
}

function mapResolvedPostTaxSnapshotCategory(record = {}) {
    const name = normalizeDeductionName(record.name);
    const deductionType = String(record.deductionType || '').toUpperCase();

    if (deductionType === 'LOAN' || name.includes('loan')) return 'LOAN';
    if (deductionType === 'ADVANCE' || name.includes('advance')) return 'ADVANCE';
    if (deductionType === 'LEAVE' || name.includes('lop') || name.includes('loss of pay')) return 'LOP';
    if (deductionType === 'DISCIPLINARY' || name.includes('penalty') || name.includes('fine')) return 'PENALTY';
    return 'OTHER';
}

async function hasPayrollSalarySource(db, tenantId, employee) {
    const employeeId = employee._id;

    try {
        const EmployeeCtcVersion = db.model('EmployeeCtcVersion');
        const effectiveVersion = await EmployeeCtcVersion.findOne({
            companyId: tenantId,
            employeeId,
            status: { $in: ['ACTIVE', 'SCHEDULED'] }
        }).sort({ effectiveFrom: -1, version: -1 }).select('_id').lean();
        if (effectiveVersion) return true;
    } catch (_err) {
        // Model may not exist in older tenants.
    }

    return false;
}

async function preflightPayrollRun(db, tenantId, month, year, payrollRunId = null, options = {}) {
    const PayrollRun = db.model('PayrollRun');
    const Payslip = db.model('Payslip');
    const Employee = db.model('Employee');
    const Attendance = db.model('Attendance');
    const runOptions = normalizeRunOptions(options);

    const payrollRun = payrollRunId
        ? await PayrollRun.findOne({ _id: payrollRunId, tenantId }).lean()
        : await PayrollRun.findOne({ tenantId, month, year }).lean();

    const filter = buildPayrollEmployeeFilter(tenantId, payrollRun || {});
    const selectedEmployeeIds = dedupeObjectIds(runOptions.selectedEmployeeIds || []);
    if (selectedEmployeeIds.length > 0) {
        filter._id = { $in: selectedEmployeeIds };
    }
    let employees = await Employee.find(filter)
        .select('firstName lastName employeeId email department designation role joiningDate bankDetails commAddress permAddress tempAddress currentSalarySnapshotId salarySnapshotId')
        .lean();

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const runType = runOptions.runType || payrollRun?.runType || 'FULL';
    const executionMode = runOptions.executionMode || payrollRun?.executionMode || (runType === 'OFF_CYCLE' ? 'OFF_CYCLE' : runType === 'AMENDMENT' ? 'AMENDMENT' : 'MONTHLY');
    const attendancePolicy = runOptions.attendancePolicy || payrollRun?.attendancePolicy || 'STRICT';
    const payrollProfilePolicy = resolvePayrollProfileResolutionPolicy(runOptions);
    const fallbackAttendanceAllowed = shouldAllowMissingAttendanceFallback({}, attendancePolicy);
    const allowSupplementalPayslips = ['OFF_CYCLE', 'AMENDMENT'].includes(runType);
    const candidateBatches = await payrollPhase2.resolveRunInputBatches(db, tenantId, {
        payrollRunId: payrollRun?._id || payrollRunId,
        inputBatchIds: runOptions.inputBatchIds || payrollRun?.inputBatchIds || [],
        startDate,
        endDate,
        executionMode
    });
    const employeeInputBatchMap = new Map();
    for (const batch of candidateBatches) {
        for (const item of batch.items || []) {
            const employeeKey = String(item.employeeId || '');
            if (!employeeKey) continue;
            const existing = employeeInputBatchMap.get(employeeKey) || [];
            existing.push({
                batchId: batch._id,
                batchCode: batch.batchCode,
                inputType: item.inputType,
                classification: item.classification,
                name: item.name
            });
            employeeInputBatchMap.set(employeeKey, existing);
        }
    }
    if (executionMode === 'OFF_CYCLE' && selectedEmployeeIds.length === 0 && employeeInputBatchMap.size > 0) {
        employees = employees.filter((employee) => employeeInputBatchMap.has(String(employee._id)));
    }

    const duplicatePayslips = await Payslip.find({
        tenantId,
        month,
        year,
        status: { $ne: 'SUPERSEDED' },
        ...(payrollRun?._id ? { payrollRunId: { $ne: payrollRun._id } } : {})
    }).select('employeeId payrollRunId status').lean();
    const duplicatePayslipEmployeeIds = new Set(duplicatePayslips.map(p => String(p.employeeId)));

    const blockers = [];
    const warnings = [];
    const employeeResults = [];

    for (const employee of employees) {
        const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId || String(employee._id);
        const employeeIssues = [];

        const employeeBatchRefs = employeeInputBatchMap.get(String(employee._id)) || [];

        if (!allowSupplementalPayslips && duplicatePayslipEmployeeIds.has(String(employee._id))) {
            employeeIssues.push({
                severity: 'BLOCKER',
                code: 'DUPLICATE_PAYSLIP',
                message: 'A payslip already exists for this employee in another payroll run for this month.'
            });
        } else if (allowSupplementalPayslips && duplicatePayslipEmployeeIds.has(String(employee._id))) {
            employeeIssues.push({
                severity: 'WARNING',
                code: 'SUPPLEMENTAL_PAYSLIP',
                message: 'Another payslip already exists for this employee in the same month. This run will be treated as supplemental or amendment payroll.'
            });
        }

        const canonicalValidation = await canonicalPayroll.validateEmployeePayrollData(
            db,
            tenantId,
            employee,
            startDate,
            endDate,
            {
                allowLegacyFallback: false,
                requirePayrollProfile: payrollProfilePolicy.strict,
                autoBackfillPayrollProfile: payrollProfilePolicy.autoBackfill,
                failOnPayrollProfileBackfillError: payrollProfilePolicy.failOnBackfillError
            }
        );
        employeeIssues.push(...canonicalValidation.issues, ...canonicalValidation.warnings);

        const attendanceCount = await Attendance.countDocuments({
            tenant: tenantId,
            employee: employee._id,
            date: { $gte: startDate, $lte: endDate }
        });

        if (attendanceCount === 0) {
            const canRelyOnInputBatch = executionMode === 'OFF_CYCLE' && employeeBatchRefs.length > 0;
            employeeIssues.push({
                severity: canRelyOnInputBatch ? 'WARNING' : (fallbackAttendanceAllowed ? 'WARNING' : 'BLOCKER'),
                code: 'MISSING_ATTENDANCE',
                message: canRelyOnInputBatch
                    ? 'No attendance records found, but approved off-cycle inputs exist for this employee.'
                    : (fallbackAttendanceAllowed
                        ? 'No attendance records found; configured fallback will treat the month as payable.'
                        : 'No attendance records found for the payroll period.')
            });
        }

        const bank = employee.bankDetails || {};
        if (!bank.accountNumber || !bank.ifsc) {
            employeeIssues.push({
                severity: 'WARNING',
                code: 'MISSING_BANK_DETAILS',
                message: 'Bank account number or IFSC is missing; payout export may fail.'
            });
        }

        const employeeResult = {
            employeeId: employee._id,
            employeeCode: employee.employeeId,
            name: employeeName,
            attendanceRecords: attendanceCount,
            inputBatchCount: employeeBatchRefs.length,
            inputBatches: employeeBatchRefs,
            status: employeeIssues.some(issue => issue.severity === 'BLOCKER') ? 'BLOCKED' : 'READY',
            issues: employeeIssues
        };

        for (const issue of employeeIssues) {
            const entry = {
                employeeId: employee._id,
                employeeCode: employee.employeeId,
                name: employeeName,
                ...issue
            };
            if (issue.severity === 'BLOCKER') blockers.push(entry);
            else warnings.push(entry);
        }

        employeeResults.push(employeeResult);
    }

    if (employees.length === 0) {
        blockers.push({
            code: 'NO_EMPLOYEES',
            severity: 'BLOCKER',
            message: 'No active employees matched this payroll run.'
        });
    }

    return {
        canCalculate: blockers.length === 0,
        month,
        year,
        payrollRunId: payrollRun?._id || payrollRunId,
        runType,
        executionMode,
        attendancePolicy,
        selectedEmployees: selectedEmployeeIds.length,
        totalEmployees: employees.length,
        blockedEmployees: employeeResults.filter(item => item.status === 'BLOCKED').length,
        readyEmployees: employeeResults.filter(item => item.status === 'READY').length,
        blockers,
        warnings,
        employees: employeeResults
    };
}

/**
 * Run payroll for a specific month/year
 * @param {Object} db - Tenant database connection
 * @param {ObjectId} tenantId - Tenant ID
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @param {ObjectId} initiatedBy - Employee ID who initiated
 * @returns {Object} Payroll run result
 */
async function runPayroll(db, tenantId, month, year, initiatedBy, options = {}) {
    const PayrollRun = db.model('PayrollRun');
    const PayrollRunItem = db.model('PayrollRunItem');
    const Payslip = db.model('Payslip');
    const Employee = db.model('Employee');
    const Attendance = db.model('Attendance');
    const Holiday = db.model('Holiday');
    const runOptions = normalizeRunOptions(options);
    const selectedEmployeeIds = dedupeObjectIds(runOptions.selectedEmployeeIds || []);
    const payrollRunId = toObjectId(runOptions.payrollRunId);
    const runType = runOptions.runType || (selectedEmployeeIds.length > 0 ? 'SELECTED' : 'FULL');
    const executionMode = runOptions.executionMode || (runType === 'OFF_CYCLE' ? 'OFF_CYCLE' : runType === 'AMENDMENT' ? 'AMENDMENT' : 'MONTHLY');
    const attendancePolicy = runOptions.attendancePolicy || 'STRICT';
    const payrollProfilePolicy = resolvePayrollProfileResolutionPolicy(runOptions);
    const tdsFailurePolicy = resolveTdsFailurePolicy(runOptions);
    const periodKey = payrollPhase2.formatPeriodKey(year, month);
    const payPeriodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const payPeriodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const daysInMonth = new Date(year, month, 0).getDate();
    const selectedInputBatchIds = dedupeObjectIds(runOptions.inputBatchIds || []);

    let payrollRun = payrollRunId
        ? await PayrollRun.findOne({ _id: payrollRunId, tenantId })
        : await PayrollRun.findOne({
            tenantId,
            month,
            year,
            sequenceNo: Number(runOptions.sequenceNo || 1)
        });

    if (payrollRun && ['APPROVED', 'PAID', 'AMENDED'].includes(payrollRun.status)) {
        throw new Error(`Payroll for ${month}/${year} is already ${payrollRun.status}. Cannot recalculate.`);
    }

    if (!payrollRun) {
        const sequenceNo = Number(runOptions.sequenceNo || await payrollPhase2.getNextPayrollRunSequence(db, tenantId, month, year));
        payrollRun = new PayrollRun({
            tenantId,
            month,
            year,
            periodKey,
            sequenceNo,
            runCode: runOptions.runCode || payrollPhase2.buildRunCode(year, month, sequenceNo, runType),
            status: 'INITIATED',
            lifecycleState: 'DRAFT',
            initiatedBy,
            runType,
            executionMode,
            selectedEmployeeIds,
            inputBatchIds: selectedInputBatchIds,
            attendancePolicy,
            calculationMode: 'SNAPSHOT',
            snapshotVersion: 2,
            payPeriodStart,
            payPeriodEnd,
            payDate: runOptions.payDate || payPeriodEnd,
            offCycleReason: runOptions.offCycleReason || '',
            offCycleLabel: runOptions.offCycleLabel || '',
            amendmentOfRunId: runOptions.amendmentOfRunId || null,
            approvalWorkflow: payrollPhase2.ensureApprovalWorkflow([], runOptions.approvalWorkflow || [], executionMode)
        });
    } else {
        const finalizedPayslips = await Payslip.countDocuments({
            tenantId,
            payrollRunId: payrollRun._id,
            status: { $in: ['APPROVED', 'LOCKED', 'PAID'] }
        });

        if (finalizedPayslips > 0) {
            throw new Error('This payroll run already contains approved or paid payslips. Create an amendment instead of recalculating it.');
        }

        await payrollPhase2.releaseInputBatchReservations(db, tenantId, payrollRun._id);
        await Payslip.deleteMany({
            tenantId,
            payrollRunId: payrollRun._id,
            month,
            year,
            status: 'DRAFT'
        });
        await PayrollRunItem.deleteMany({ tenantId, payrollRunId: payrollRun._id });

        payrollRun.periodKey = periodKey;
        payrollRun.sequenceNo = Number(runOptions.sequenceNo || payrollRun.sequenceNo || 1);
        payrollRun.runCode = runOptions.runCode || payrollRun.runCode || payrollPhase2.buildRunCode(year, month, payrollRun.sequenceNo, runType);
        payrollRun.executionMode = executionMode;
        payrollRun.attendancePolicy = attendancePolicy;
        payrollRun.inputBatchIds = selectedInputBatchIds.length > 0 ? selectedInputBatchIds : (payrollRun.inputBatchIds || []);
        payrollRun.payPeriodStart = payPeriodStart;
        payrollRun.payPeriodEnd = payPeriodEnd;
        payrollRun.payDate = runOptions.payDate || payrollRun.payDate || payPeriodEnd;
        payrollRun.offCycleReason = runOptions.offCycleReason || payrollRun.offCycleReason || '';
        payrollRun.offCycleLabel = runOptions.offCycleLabel || payrollRun.offCycleLabel || '';
        payrollRun.amendmentOfRunId = runOptions.amendmentOfRunId || payrollRun.amendmentOfRunId || null;
        payrollRun.approvalWorkflow = payrollPhase2.ensureApprovalWorkflow(
            payrollRun.approvalWorkflow || [],
            runOptions.approvalWorkflow || [],
            executionMode
        );
    }

    const filter = buildPayrollEmployeeFilter(tenantId, payrollRun);
    if (selectedEmployeeIds.length > 0) {
        filter._id = { $in: selectedEmployeeIds };
    }

    let employees = await Employee.find(filter);
    if (executionMode === 'OFF_CYCLE' && selectedEmployeeIds.length === 0 && (payrollRun.inputBatchIds || []).length > 0) {
        const candidateBatches = await payrollPhase2.resolveRunInputBatches(db, tenantId, {
            payrollRunId: payrollRun._id,
            inputBatchIds: payrollRun.inputBatchIds || [],
            startDate: payPeriodStart,
            endDate: payPeriodEnd,
            executionMode
        });
        const employeeIdsFromBatches = dedupeObjectIds(
            candidateBatches.flatMap((batch) => (batch.items || []).map((item) => item.employeeId))
        );
        if (employeeIdsFromBatches.length > 0) {
            const employeeIdSet = new Set(employeeIdsFromBatches.map((id) => String(id)));
            employees = employees.filter((employee) => employeeIdSet.has(String(employee._id)));
        }
    }

    payrollRun.status = 'PROCESSING';
    payrollRun.lifecycleState = 'DRAFT';
    payrollRun.runType = runType;
    payrollRun.selectedEmployeeIds = selectedEmployeeIds;
    payrollRun.initiatedBy = initiatedBy;
    payrollRun.initiatedAt = new Date();
    payrollRun.totalEmployees = employees.length;
    payrollRun.processedEmployees = 0;
    payrollRun.failedEmployees = 0;
    payrollRun.executionErrors = [];
    payrollRun.totalGross = 0;
    payrollRun.totalDeductions = 0;
    payrollRun.totalNetPay = 0;
    payrollRun.approvalStatus = 'NOT_SUBMITTED';
    payrollRun.rejectedAt = null;
    payrollRun.rejectedBy = null;
    payrollRun.rejectionReason = '';
    payrollRun.approvalHistory = [];
    payrollRun.exportArtifactIds = [];
    payrollRun.bankTransferSummary = {};
    payrollRun.accountingSummary = {};
    payrollRun.complianceSummary = {};
    payrollRun.approvalWorkflow = payrollPhase2.ensureApprovalWorkflow(
        payrollRun.approvalWorkflow || [],
        runOptions.approvalWorkflow || [],
        executionMode
    ).map((step) => ({
        ...step,
        status: 'PENDING',
        actedBy: null,
        actedAt: null,
        comment: ''
    }));
    payrollRun.runExecutionSummary = {
        inputBatchIds: payrollRun.inputBatchIds || [],
        overtimeAmount: 0,
        overtimeHours: 0,
        inputDrivenEarnings: 0,
        inputDrivenReimbursements: 0,
        inputDrivenPreTaxDeductions: 0,
        inputDrivenPostTaxDeductions: 0,
        exceptionFlags: 0
    };
    payrollRun.varianceSummary = {
        comparedEmployees: 0,
        changedEmployees: 0,
        grossDelta: 0,
        netDelta: 0,
        incomeTaxDelta: 0
    };
    await payrollRun.save();

    const holidays = await Holiday.find({
        tenant: tenantId,
        date: { $gte: payPeriodStart, $lte: payPeriodEnd }
    }).lean();
    const holidayDates = new Set(holidays.map((holiday) => holiday.date.toISOString().split('T')[0]));
    const usedInputBatchIds = [];

    for (const employee of employees) {
        try {
            const payslip = await calculateEmployeePayroll(
                db,
                tenantId,
                employee,
                month,
                year,
                payPeriodStart,
                payPeriodEnd,
                daysInMonth,
                holidayDates,
                payrollRun._id,
                null,
                false,
                {
                    userId: initiatedBy,
                    runType,
                    executionMode,
                    attendancePolicy,
                    profileResolutionPolicy: payrollProfilePolicy,
                    tdsFailurePolicy,
                    inputBatchIds: payrollRun.inputBatchIds || [],
                    runCode: payrollRun.runCode || '',
                    sequenceNo: payrollRun.sequenceNo || null,
                    payDate: payrollRun.payDate || null
                }
            );

            const grossEarnings = roundPayrollAmount(payslip.grossEarnings, 0);
            const totalDeductions = roundPayrollAmount(
                (payslip.preTaxDeductionsTotal || 0) +
                (payslip.postTaxDeductionsTotal || 0) +
                (payslip.incomeTax || 0),
                0
            );
            const netPay = roundPayrollAmount(payslip.netPay, 0);
            const phase2Summary = payslip.phase2InputsSnapshot?.summary || {};
            const overtimeSummary = payslip.phase2InputsSnapshot?.overtimeSummary || {};
            const exceptionFlags = payslip.phase2InputsSnapshot?.exceptionFlags || [];
            const payslipInputBatchIds = dedupeObjectIds(payslip.phase2InputsSnapshot?.inputBatchIds || []);
            usedInputBatchIds.push(...payslipInputBatchIds);

            payrollRun.processedEmployees += 1;
            payrollRun.totalGross = roundPayrollAmount(payrollRun.totalGross + grossEarnings, 0);
            payrollRun.totalDeductions = roundPayrollAmount(payrollRun.totalDeductions + totalDeductions, 0);
            payrollRun.totalNetPay = roundPayrollAmount(payrollRun.totalNetPay + netPay, 0);
            payrollRun.runExecutionSummary.overtimeAmount = roundPayrollAmount(
                payrollRun.runExecutionSummary.overtimeAmount + (overtimeSummary.amount || 0),
                0
            );
            payrollRun.runExecutionSummary.overtimeHours = roundPayrollAmount(
                payrollRun.runExecutionSummary.overtimeHours + (overtimeSummary.payableHours || 0),
                0
            );
            payrollRun.runExecutionSummary.inputDrivenEarnings = roundPayrollAmount(
                payrollRun.runExecutionSummary.inputDrivenEarnings + (phase2Summary.totalEarnings || 0),
                0
            );
            payrollRun.runExecutionSummary.inputDrivenReimbursements = roundPayrollAmount(
                payrollRun.runExecutionSummary.inputDrivenReimbursements + (phase2Summary.totalReimbursements || 0),
                0
            );
            payrollRun.runExecutionSummary.inputDrivenPreTaxDeductions = roundPayrollAmount(
                payrollRun.runExecutionSummary.inputDrivenPreTaxDeductions + (phase2Summary.totalPreTaxDeductions || 0),
                0
            );
            payrollRun.runExecutionSummary.inputDrivenPostTaxDeductions = roundPayrollAmount(
                payrollRun.runExecutionSummary.inputDrivenPostTaxDeductions + (phase2Summary.totalPostTaxDeductions || 0),
                0
            );
            payrollRun.runExecutionSummary.exceptionFlags += exceptionFlags.length;

            if (payslip.varianceSnapshot?.hasPrevious) {
                payrollRun.varianceSummary.comparedEmployees += 1;
                payrollRun.varianceSummary.grossDelta = roundPayrollAmount(
                    payrollRun.varianceSummary.grossDelta + (payslip.varianceSnapshot.grossDelta || 0),
                    0
                );
                payrollRun.varianceSummary.netDelta = roundPayrollAmount(
                    payrollRun.varianceSummary.netDelta + (payslip.varianceSnapshot.netDelta || 0),
                    0
                );
                payrollRun.varianceSummary.incomeTaxDelta = roundPayrollAmount(
                    payrollRun.varianceSummary.incomeTaxDelta + (payslip.varianceSnapshot.incomeTaxDelta || 0),
                    0
                );
                if (payslip.varianceSnapshot.changed) {
                    payrollRun.varianceSummary.changedEmployees += 1;
                }
            }

            await PayrollRunItem.findOneAndUpdate(
                { tenantId, payrollRunId: payrollRun._id, employeeId: employee._id },
                {
                    $set: {
                        salaryTemplateId: payslip.salaryTemplateId || null,
                        payslipId: payslip._id || null,
                        inputSnapshotId: payslip.payrollInputSnapshotId || null,
                        calculationTraceId: payslip.calculationTraceId || null,
                        runCode: payrollRun.runCode || '',
                        runType,
                        inputBatchIds: payslipInputBatchIds,
                        attendanceSummary: {
                            totalDays: payslip.attendanceSummary?.totalDays || 0,
                            daysPresent: payslip.attendanceSummary?.presentDays || 0,
                            daysAbsent: Math.max(
                                0,
                                (payslip.attendanceSummary?.totalDays || 0) - (payslip.attendanceSummary?.presentDays || 0)
                            ),
                            leaves: payslip.attendanceSummary?.leaveDays || 0,
                            holidays: payslip.attendanceSummary?.holidayDays || 0
                        },
                        overtimeSummary,
                        phase2InputSummary: phase2Summary,
                        exceptionFlags,
                        calculatedGross: grossEarnings,
                        calculatedNet: netPay,
                        status: 'GENERATED'
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (error) {
            console.error(`[PAYROLL] Error processing employee ${employee._id}:`, error);
            payrollRun.failedEmployees += 1;
            payrollRun.executionErrors.push({
                employeeId: employee._id,
                message: error.message,
                stack: error.stack
            });

            await PayrollRunItem.findOneAndUpdate(
                { tenantId, payrollRunId: payrollRun._id, employeeId: employee._id },
                {
                    $set: {
                        salaryTemplateId: null,
                        payslipId: null,
                        inputSnapshotId: null,
                        calculationTraceId: null,
                        runCode: payrollRun.runCode || '',
                        runType,
                        inputBatchIds: [],
                        attendanceSummary: {
                            totalDays: 0,
                            daysPresent: 0,
                            daysAbsent: 0,
                            leaves: 0,
                            holidays: 0
                        },
                        overtimeSummary: {},
                        phase2InputSummary: {},
                        exceptionFlags: ['CALCULATION_FAILED'],
                        calculatedGross: 0,
                        calculatedNet: 0,
                        status: 'Failed'
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }
    }

    payrollRun.inputBatchIds = dedupeObjectIds([
        ...(payrollRun.inputBatchIds || []),
        ...usedInputBatchIds
    ]);
    payrollRun.runExecutionSummary.inputBatchIds = payrollRun.inputBatchIds;
    const hasRunFailures = Number(payrollRun.failedEmployees || 0) > 0;
    payrollRun.status = hasRunFailures ? 'CALCULATED_WITH_ERRORS' : 'CALCULATED';
    payrollRun.lifecycleState = hasRunFailures ? 'DRAFT' : 'CALCULATED';
    payrollRun.calculatedBy = initiatedBy;
    payrollRun.calculatedAt = new Date();
    await payrollRun.save();

    if ((payrollRun.inputBatchIds || []).length > 0) {
        await payrollPhase2.reserveInputBatchesForRun(db, tenantId, payrollRun.inputBatchIds, payrollRun._id);
    }

    if (executionMode === 'MONTHLY') {
        const attendanceFilter = {
            tenant: tenantId,
            date: { $gte: payPeriodStart, $lte: payPeriodEnd }
        };
        if (selectedEmployeeIds.length > 0) {
            attendanceFilter.employee = { $in: selectedEmployeeIds };
        }

        await Attendance.updateMany(attendanceFilter, { $set: { locked: true } });
    }

    return payrollRun;
}

/**
 * Calculate payroll for a single employee
 */
async function calculateEmployeePayroll(
    db,
    tenantId,
    employee,
    month,
    year,
    startDate,
    endDate,
    daysInMonth,
    holidayDates,
    payrollRunId,
    _unusedTemplateId = null,
    dryRun = false,
    executionContext = {}
) {

    const Payslip = db.model('Payslip');
    const Attendance = db.model('Attendance');
    const PayrollAdjustment = db.model('PayrollAdjustment', require('../models/PayrollAdjustment'));
    const generatedByUserId = executionContext.userId || null;
    const runType = executionContext.runType || 'FULL';
    const executionMode = executionContext.executionMode || (runType === 'OFF_CYCLE' ? 'OFF_CYCLE' : runType === 'AMENDMENT' ? 'AMENDMENT' : 'MONTHLY');
    const attendancePolicy = executionContext.attendancePolicy || 'STRICT';
    const profileResolutionPolicy = executionContext.profileResolutionPolicy || resolvePayrollProfileResolutionPolicy(executionContext);
    const tdsFailurePolicy = resolveTdsFailurePolicy(executionContext);
    const traceWarnings = [];
    const traceErrors = [];
    const exceptionFlags = [];

    // 🛡️ STEP 0A: Verify person exists (Employee OR Applicant)
    const Employee = db.model('Employee');
    const Applicant = db.model('Applicant');
    let person = await Employee.findById(employee._id).lean();
    if (!person) {
        person = await Applicant.findById(employee._id).lean();
    }
    if (!person) {
        console.error(`❌ [PAYROLL] Person with ID ${employee._id} not found in Employees or Applicants`);
        throw new Error(`Person with ID ${employee._id} not found`);
    }

    // 🎯 FETCH APPROVED ADJUSTMENTS for this month
    const mStr = `${year}-${String(month).padStart(2, '0')}`;
    const pendingAdjustments = await PayrollAdjustment.find({
        employeeId: employee._id,
        adjustmentMonth: mStr,
        status: 'APPROVED' // Maker-Checker: ONLY APPROVED are eligible
    }).lean();

    const adjustmentTotal = pendingAdjustments.reduce((sum, adj) => sum + adj.adjustmentAmount, 0);

    // 🔍 STEP 0: Canonical effective-dated salary version is the only active payroll salary source
    let salarySourceSnapshot = null;
    let payrollProfileSnapshot = null;
    let payrollProfileSegmentsSnapshot = [];
    let locationPolicySnapshot = null;
    let locationPolicySegmentsSnapshot = [];
    let statutoryRuleSnapshot = null;
    let taxProfileSnapshot = null;
    let deductionPlanSnapshot = null;
    let resolvedLocationPolicy = null;
    let resolvedStatutoryRule = null;
    let resolvedTaxProfile = null;
    let locationPolicySegments = [];
    let comp = null;

    try {
        comp = await canonicalPayroll.resolveEffectiveSalaryVersion(
            db,
            tenantId,
            employee._id,
            startDate,
            endDate
        );
    } catch (canonicalErr) {
        console.warn(`[PAYROLL] Canonical salary lookup failed for ${employee.employeeId}:`, canonicalErr.message);
        throw canonicalErr;
    }

    if (!comp) {
        throw new Error(`No canonical salary version found for ${employee.employeeId} in ${year}-${String(month).padStart(2, '0')}`);
    }

    salarySourceSnapshot = canonicalPayroll.buildSalarySourceSnapshot(comp);
    // console.log(`✅ [PAYROLL] Using canonical EmployeeCtcVersion v${comp.version} for ${employee.firstName}`);


    const normalizedComp = normalizeCompensation(comp);
    const grossTotals = ensureGrossTotals(normalizedComp);

    // 2️⃣ Build Earnings from Components
    const earnings = (normalizedComp.components || [])
        .filter(c => c && (c.type || '').toUpperCase() === 'EARNING')
        .map(e => {
            // 🛡️ Multi-field fallback for monthly amount
            const rawMonthly = e.monthlyAmount ?? e.amount ?? e.value ?? e.monthly ?? e.componentAmount;
            const monthlyAmount = parseFloat(String(rawMonthly || 0).replace(/[^0-9.-]+/g, '')) || 0;

            // 🛡️ Multi-field fallback for annual amount
            const rawAnnual = e.annualAmount ?? e.annual ?? e.yearlyAmount;
            let annualAmount = parseFloat(String(rawAnnual || 0).replace(/[^0-9.-]+/g, '')) || 0;

            // Auto-calculate annual if missing
            if (annualAmount === 0 && monthlyAmount > 0) {
                annualAmount = monthlyAmount * 12;
            }

            return {
                name: e.name || 'Unknown Earning',
                monthlyAmount: monthlyAmount,
                annualAmount: annualAmount,
                proRata: e.isProRata !== false,
                taxable: e.isTaxable !== false
            };
        });

    const employeeDeductions = (normalizedComp.components || [])
        .filter(c => c && (c.type || '').toUpperCase() === 'DEDUCTION')
        .map(d => {
            const rawMonthly = d.monthlyAmount ?? d.amount ?? d.value ?? d.monthly ?? d.componentAmount;
            const monthlyAmount = parseFloat(String(rawMonthly || 0).replace(/[^0-9.-]+/g, '')) || 0;

            return {
                name: d.name || d.label || 'Salary Deduction',
                category: d.category || d.deductionCategory,
                amountType: d.amountType || d.calculationType || 'FIXED',
                calculationBase: d.calculationBase,
                percentage: d.percentage,
                amountValue: d.amountValue,
                monthlyAmount,
                enabled: d.enabled !== false
            };
        });

    // 3️⃣ Strict Validation: Check for empty earnings
    if (!earnings || earnings.length === 0) {
        throw new Error(`Salary components (earnings) are missing for ${employee.firstName}. Ensure they have an active Compensation/CTC structure.`);
    }

    // 4️⃣ Construct Salary Template Object (Strictly from Compensation)
    const salaryTemplate = {
        _id: comp._id,
        templateName: `Active Compensation`,
        annualCTC: grossTotals.totalCTC || 0,
        monthlyCTC: Math.round((grossTotals.totalCTC || 0) / 12),
        earnings: earnings,
        employeeDeductions,
        employerDeductions: (normalizedComp.components || [])
            .filter(c => c && (c.type || '').toUpperCase() === 'BENEFIT')
            .map(b => ({
                name: b.name || 'Unknown Benefit',
                monthlyAmount: b.monthlyAmount || 0
            })),
        settings: comp.settings || {
            includePensionScheme: true,
            pfWageRestriction: true,
            includeESI: true
        }
    };

    // 📅 Get attendance for the month using date range filtering only
    // Date range: Start of month to end of month (inclusive with time)
    let payrollProfile = null;
    let payrollProfileResolution = null;
    try {
        payrollProfileResolution = await canonicalPayroll.resolvePayrollProfile(
            db,
            tenantId,
            employee._id,
            startDate,
            endDate,
            {
                employee: person,
                userId: generatedByUserId,
                autoBackfill: profileResolutionPolicy.autoBackfill === true,
                failOnBackfillError: profileResolutionPolicy.failOnBackfillError === true,
                returnMeta: true
            }
        );
        payrollProfile = payrollProfileResolution?.profile || null;
        if (payrollProfileResolution?.autoBackfilled === true) {
            traceWarnings.push({
                code: 'PAYROLL_PROFILE_AUTO_BACKFILLED',
                message: 'Payroll profile was auto-backfilled from employee location data.'
            });
            exceptionFlags.push('PAYROLL_PROFILE_AUTO_BACKFILLED');
        }
    } catch (profileErr) {
        console.warn(`[PAYROLL] Payroll profile lookup failed for ${employee.employeeId}:`, profileErr.message);
        traceWarnings.push({
            code: 'PAYROLL_PROFILE_LOOKUP_FAILED',
            message: profileErr.message
        });
        if (profileResolutionPolicy.strict === true) {
            traceErrors.push({
                code: 'PAYROLL_PROFILE_REQUIRED',
                message: profileErr.message
            });
            exceptionFlags.push('PAYROLL_PROFILE_REQUIRED');
            throw profileErr;
        }
    }

    let payrollProfileSegmentResolution = null;
    try {
        payrollProfileSegmentResolution = await canonicalPayroll.resolvePayrollProfileSegments(
            db,
            tenantId,
            employee._id,
            startDate,
            endDate,
            {
                employee: person,
                userId: generatedByUserId,
                autoBackfill: profileResolutionPolicy.autoBackfill === true,
                failOnBackfillError: profileResolutionPolicy.failOnBackfillError === true,
                returnMeta: true
            }
        );
    } catch (segmentErr) {
        console.warn(`[PAYROLL] Payroll profile segment lookup failed for ${employee.employeeId}:`, segmentErr.message);
        traceWarnings.push({
            code: 'PAYROLL_PROFILE_SEGMENT_LOOKUP_FAILED',
            message: segmentErr.message
        });
    }

    if (!payrollProfile) {
        const backfillReason = payrollProfileResolution?.backfill?.reason || 'NOT_FOUND';
        const missingProfileMessage = `No effective payroll profile found for ${employee.employeeId} in ${year}-${String(month).padStart(2, '0')} (reason: ${backfillReason}).`;
        if (profileResolutionPolicy.strict === true) {
            traceErrors.push({
                code: 'MISSING_PAYROLL_PROFILE',
                message: missingProfileMessage
            });
            exceptionFlags.push('MISSING_PAYROLL_PROFILE');
            throw new Error(`${missingProfileMessage} Update employee work state/city or create EmployeePayrollProfile before payroll.`);
        }

        traceWarnings.push({
            code: 'MISSING_PAYROLL_PROFILE_FALLBACK',
            message: `${missingProfileMessage} Continuing with company default location policy.`
        });
        exceptionFlags.push('MISSING_PAYROLL_PROFILE_FALLBACK');
    }

    const attendanceStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const attendanceEndDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // console.log(`🔍 [ATTENDANCE] Fetching records for employee ${employee._id}`);
    // console.log(`   - Date Range: ${attendanceStartDate.toISOString()} to ${attendanceEndDate.toISOString()}`);
    // console.log(`   - Month: ${month}, Year: ${year}`);

    const attendanceRecords = await Attendance.find({
        tenant: tenantId,
        employee: new mongoose.Types.ObjectId(employee._id),
        date: { $gte: attendanceStartDate, $lte: attendanceEndDate }
    }).sort({ date: 1 }).lean();

    // console.log(`✅ [ATTENDANCE] Found ${attendanceRecords.length} attendance records`);
    // console.log(`   - Total Days in Month: ${daysInMonth}`);
    // console.log(`   - Employee: ${employee.firstName} ${employee.lastName}`);

    // Debug: Log first few records
    if (attendanceRecords.length > 0) {
        // console.log(`   - Sample Records (first 3):`);
        attendanceRecords.slice(0, 3).forEach((rec, idx) => {
            // console.log(`     ${idx + 1}. Date: ${rec.date?.toISOString()?.split('T')[0]}, Status: ${rec.status}`);
        });
    }

    // Calculate attendance summary
    const attendanceSummary = calculateAttendanceSummary(
        attendanceRecords,
        daysInMonth,
        holidayDates,
        employee.joiningDate ? new Date(employee.joiningDate) : null,
        startDate,
        employee._id, // For logging
        endDate
    );

    const hadZeroPresentDays = attendanceSummary.presentDays === 0;
    const allowMissingAttendanceFallback = shouldAllowMissingAttendanceFallback(salaryTemplate.settings, attendancePolicy);
    const missingAttendanceFallbackMode = resolveMissingAttendanceFallbackMode(salaryTemplate.settings);
    if (attendanceRecords.length === 0 && !allowMissingAttendanceFallback) {
        throw new Error(`Attendance records are missing for ${employee.firstName || employee.employeeId || employee._id} in ${month}/${year}. Complete attendance or explicitly enable missing-attendance fallback.`);
    }

    // 🛡️ SAFETY: If no attendance records or presentDays is 0, assume full month present
    // This prevents zero salary when attendance is not tracked
    if (attendanceRecords.length === 0) {
        console.warn(`⚠️ [ATTENDANCE] No attendance records found for ${employee.firstName}. Assuming full month present.`);
        traceWarnings.push({
            code: 'MISSING_ATTENDANCE_FALLBACK',
            message: 'No attendance records found; payable days fell back to full month present.'
        });
        exceptionFlags.push('MISSING_ATTENDANCE_FALLBACK');
        attendanceSummary.presentDays = attendanceSummary.totalDays;
    } else if (attendanceSummary.presentDays === 0) {
        console.warn(`⚠️ [ATTENDANCE] Present days is 0 for ${employee.firstName}. Assuming full month present.`);
        traceWarnings.push({
            code: 'ZERO_PRESENT_DAYS_FALLBACK',
            message: 'Attendance summary returned zero payable days before safeguard handling.'
        });
        exceptionFlags.push('ZERO_PRESENT_DAYS_FALLBACK');
        attendanceSummary.presentDays = attendanceSummary.totalDays;
    }

    // console.log(`📊 [FINAL ATTENDANCE] Using Present Days: ${attendanceSummary.presentDays} / ${attendanceSummary.totalDays}`);

    if (attendanceRecords.length === 0 && missingAttendanceFallbackMode !== 'FULL_PRESENT') {
        console.warn(`No attendance records found for ${employee.firstName}. Fallback mode ZERO_PRESENT applied.`);
        traceWarnings.push({
            code: 'MISSING_ATTENDANCE_ZERO_PRESENT_FALLBACK',
            message: 'No attendance records found; payable days set to 0 due to ZERO_PRESENT fallback mode.'
        });
        exceptionFlags.push('MISSING_ATTENDANCE_ZERO_PRESENT_FALLBACK');
        attendanceSummary.presentDays = 0;
    }

    if (attendanceRecords.length > 0 && hadZeroPresentDays) {
        console.warn(`[ATTENDANCE] Present days is 0 for ${employee.firstName || employee.employeeId || employee._id}. Keeping calculated zero payable days.`);
        attendanceSummary.presentDays = 0;
    }

    locationPolicySegments = await buildLocationPolicySegments(
        db,
        tenantId,
        payrollProfileSegmentResolution?.segments || [],
        attendanceRecords,
        holidayDates,
        employee.joiningDate ? new Date(employee.joiningDate) : null,
        {
            employeeId: employee._id,
            startDate,
            endDate,
            zeroPresentFallback: attendanceRecords.length === 0 && missingAttendanceFallbackMode !== 'FULL_PRESENT'
        }
    );

    const primaryLocationSegment = selectPrimaryLocationSegment(locationPolicySegments, startDate);
    payrollProfileSnapshot = canonicalPayroll.buildPayrollProfileSnapshot(
        payrollProfile || primaryLocationSegment?.profile || null
    );
    payrollProfileSegmentsSnapshot = locationPolicySegments.map((segment) => ({
        segmentStart: segment.segmentStart,
        segmentEnd: segment.segmentEnd,
        calendarDays: segment.calendarDays,
        isGap: segment.isGap === true,
        source: segment.source || 'DEFAULT',
        attendanceSummary: segment.attendanceSummary || {},
        profileId: segment.profileSnapshot?.profileId || null,
        branchName: segment.profileSnapshot?.branchName || '',
        workCity: segment.profileSnapshot?.workCity || '',
        workState: segment.profileSnapshot?.workState || '',
        payrollRegion: segment.profileSnapshot?.payrollRegion || ''
    }));
    locationPolicySegmentsSnapshot = buildLocationPolicySegmentSnapshots(locationPolicySegments);

    const distinctPolicyLabels = [...new Set(
        locationPolicySegmentsSnapshot
            .map((segment) => segment.locationPolicy?.ruleName || segment.locationPolicy?.workCity || '')
            .filter(Boolean)
    )];
    if (distinctPolicyLabels.length > 1) {
        traceWarnings.push({
            code: 'MULTI_LOCATION_SEGMENTED_PAYROLL',
            message: `Payroll period spans multiple city/state policies: ${distinctPolicyLabels.join(', ')}.`
        });
        exceptionFlags.push('MULTI_LOCATION_SEGMENTED_PAYROLL');
    }

    try {
        resolvedLocationPolicy = primaryLocationSegment?.locationPolicy || await payrollRuleResolver.resolvePayrollLocationPolicy(
            db,
            tenantId,
            payrollProfile
        );
        locationPolicySnapshot = payrollRuleResolver.buildLocationPolicySnapshot(resolvedLocationPolicy);
        // console.log(
        //     `[PAYROLL] Resolved location policy for ${employee.employeeId}: ${locationPolicySnapshot?.ruleName || 'Company Default'}`
        // );
    } catch (locationErr) {
        console.warn(`[PAYROLL] Location policy resolution failed for ${employee.employeeId}:`, locationErr.message);
        traceWarnings.push({
            code: 'LOCATION_POLICY_LOOKUP_FAILED',
            message: locationErr.message
        });
        try {
            resolvedLocationPolicy = await payrollRuleResolver.resolvePayrollLocationPolicy(db, tenantId, null);
            locationPolicySnapshot = payrollRuleResolver.buildLocationPolicySnapshot(resolvedLocationPolicy);
        } catch (fallbackLocationErr) {
            traceWarnings.push({
                code: 'LOCATION_POLICY_DEFAULT_LOOKUP_FAILED',
                message: fallbackLocationErr.message
            });
        }
    }

    resolvedStatutoryRule = await payrollPhase1.resolveStatutoryRuleSet(
        db,
        tenantId,
        startDate,
        endDate,
        payrollProfileSnapshot || null,
        { createIfMissing: false }
    );
    statutoryRuleSnapshot = payrollPhase1.buildStatutoryRuleSnapshot(resolvedStatutoryRule);

    resolvedTaxProfile = await payrollPhase1.resolveEmployeeTaxProfile(
        db,
        tenantId,
        employee._id,
        startDate,
        endDate
    );
    taxProfileSnapshot = payrollPhase1.buildTaxProfileSnapshot(resolvedTaxProfile, startDate);

    const unifiedDeductionPlan = await getUnifiedEmployeeDeductionPlan(
        db,
        tenantId,
        employee._id,
        startDate,
        endDate,
        normalizedComp.components || []
    );
    deductionPlanSnapshot = {
        summary: unifiedDeductionPlan.summary,
        duplicates: unifiedDeductionPlan.duplicates,
        items: unifiedDeductionPlan.items.map((item) => ({
            name: item.name,
            category: item.category,
            amountType: item.amountType,
            amountValue: item.amountValue,
            calculationBase: item.calculationBase,
            deductionType: item.deductionType,
            statutoryCategory: item.statutoryCategory,
            source: item.sourceType || item.source || 'UNKNOWN',
            employeeDeductionId: item.employeeDeductionId || null
        }))
    };

    // STEP 1: Calculate Gross Earnings (with pro-rata)
    let grossCalculation = calculateGrossEarnings(
        salaryTemplate.earnings || [],
        attendanceSummary.totalDays || daysInMonth,
        attendanceSummary.presentDays || 0,
        attendanceSummary.lopDays || 0
    );

    // console.log(`📊 [PAYROLL] Gross calculation result:`);
    // console.log(`   - Earnings snapshot count: ${grossCalculation.earningsSnapshot?.length || 0}`);
    // console.log(`   - Total Gross: ₹${grossCalculation.totalGross}`);
    // console.log(`   - Original Basic Amount: ₹${grossCalculation.originalBasicAmount}`);
    // console.log(`   - Pro-rated Basic Amount: ₹${grossCalculation.basicAmount}`);
    if (grossCalculation.earningsSnapshot && grossCalculation.earningsSnapshot.length > 0) {
        // console.log(`   - First earning in snapshot: ${grossCalculation.earningsSnapshot[0].name} = ₹${grossCalculation.earningsSnapshot[0].amount}`);
    }

    const resolvedPhase2Inputs = await payrollPhase2.resolveEmployeeRunInputs(
        db,
        tenantId,
        {
            employeeId: employee._id,
            payrollRunId,
            inputBatchIds: executionContext.inputBatchIds || [],
            startDate,
            endDate,
            executionMode,
            attendanceRecords,
            attendanceSummary,
            salaryTemplate
        }
    );

    applyLocationPolicyToResolvedInputs(resolvedPhase2Inputs, locationPolicySegments, holidayDates);
    grossCalculation = payrollPhase2.applyResolvedInputsToGross(grossCalculation, resolvedPhase2Inputs);
    grossCalculation = applyLocationPolicyEarningAdjustments(
        grossCalculation,
        locationPolicySegments,
        attendanceSummary.totalDays || daysInMonth
    );
    if ((resolvedPhase2Inputs.summary?.totalEarnings || 0) > 0 || (resolvedPhase2Inputs.summary?.totalReimbursements || 0) > 0) {
        // console.log(`[PAYROLL] Applied Phase 2 inputs for ${employee.employeeId}: earnings=${resolvedPhase2Inputs.summary?.totalEarnings || 0}, reimbursements=${resolvedPhase2Inputs.summary?.totalReimbursements || 0}`);
    }

    // STEP 2: Calculate Pre-Tax Deductions
    let preTaxDeductions = await calculatePreTaxDeductions(
        db,
        tenantId,
        employee._id,
        grossCalculation.totalGross,
        grossCalculation.basicAmount,
        salaryTemplate.settings,
        salaryTemplate.employeeDeductions,
        startDate,
        endDate,
        resolvedLocationPolicy,
        resolvedStatutoryRule,
        unifiedDeductionPlan,
        locationPolicySegments,
        attendanceSummary.totalDays || daysInMonth
    );
    preTaxDeductions = payrollPhase2.mergeResolvedInputsIntoDeductions(preTaxDeductions, resolvedPhase2Inputs, 'PRE_TAX');

    // STEP 3: Calculate Taxable Income
    // Use only components marked `taxable` when computing taxable income
    let taxableIncome = (grossCalculation.taxableGross || grossCalculation.totalGross) - preTaxDeductions.total;

    // 🔒 SAFETY: Ensure taxable income is never negative (can't have negative tax)
    if (taxableIncome < 0) {
        console.warn(`⚠️ [PAYROLL] Taxable income is negative (₹${taxableIncome}). Setting to 0.`);
        console.warn(`   Gross: ₹${grossCalculation.totalGross}, Pre-Tax Deductions: ₹${preTaxDeductions.total}`);
        taxableIncome = 0;
    }

    // STEP 4: Calculate Income Tax (TDS)
    // Use the TDS service to compute monthly TDS based on annualized taxable income
    let incomeTax = 0;
    let tdsResult = { monthly: 0, annual: 0, regime: 'NEW' };  // Default snapshot
    const fiscalYearTaxStats = await payrollPhase2.calculateFiscalYearTaxStats(
        db,
        tenantId,
        employee._id,
        month,
        year,
        payrollRunId
    );

    try {
        tdsResult = await tdsService.calculateMonthlyTDS(taxableIncome, employee, {
            tenantId,
            month,
            year,
            ruleSet: resolvedStatutoryRule,
            taxProfile: resolvedTaxProfile,
            taxAlreadyDeducted: fiscalYearTaxStats.incomeTax,
            ytdTaxableIncome: fiscalYearTaxStats.taxableIncome
        });
        incomeTax = Number(tdsResult?.monthly);

        // 🔒 SAFETY: Validate TDS result
        if (!Number.isFinite(incomeTax) || incomeTax < 0) {
            throw new Error(`Invalid monthly TDS value "${tdsResult?.monthly}"`);
            console.warn(`⚠️ [PAYROLL] TDS calculation returned invalid value: ${incomeTax}. Setting to 0.`);
        }
        incomeTax = roundPayrollAmount(incomeTax, 0);
    } catch (tdsError) {
        console.error(`❌ [PAYROLL] TDS calculation failed:`, tdsError.message);
        const tdsFailureMessage = `TDS calculation failed for ${employee.employeeId}: ${tdsError.message}`;
        if (tdsFailurePolicy === 'STRICT') {
            traceErrors.push({
                code: 'TDS_CALCULATION_FAILED',
                message: tdsFailureMessage
            });
            exceptionFlags.push('TDS_CALCULATION_FAILED');
            throw new Error(tdsFailureMessage);
        }

        traceWarnings.push({
            code: 'TDS_FALLBACK_TO_ZERO',
            message: `${tdsFailureMessage} Applied zero TDS due to policy ${tdsFailurePolicy}.`
        });
        exceptionFlags.push('TDS_FALLBACK_TO_ZERO');
        incomeTax = 0;
        tdsResult = {
            monthly: 0,
            annual: 0,
            regime: resolvedTaxProfile?.regime || 'NEW',
            error: tdsError.message,
            failurePolicy: tdsFailurePolicy,
            fallbackApplied: true
        };
    }

    // STEP 5: Calculate Post-Tax Deductions (including excess leave deduction)
    const dailyRateForLeave = salaryTemplate.monthlyCTC && salaryTemplate.monthlyCTC > 0
        ? salaryTemplate.monthlyCTC / 26
        : grossCalculation.basicAmount / Math.max(1, attendanceSummary.presentDays || 1) * (attendanceSummary.totalDays || daysInMonth) / 26;
    let postTaxDeductions = await calculatePostTaxDeductions(
        db,
        tenantId,
        employee._id,
        grossCalculation.totalGross,
        grossCalculation.basicAmount,
        attendanceSummary.lopDays,
        grossCalculation.basicAmount,
        daysInMonth,
        startDate,
        endDate,
        dailyRateForLeave,
        salaryTemplate.employeeDeductions,
        unifiedDeductionPlan
    );
    postTaxDeductions = payrollPhase2.mergeResolvedInputsIntoDeductions(postTaxDeductions, resolvedPhase2Inputs, 'POST_TAX');

    // STEP 6: Calculate Net Pay
    let netPay = (taxableIncome - incomeTax) - postTaxDeductions.total;

    // 🔥 APPLY PAYROLL ADJUSTMENTS (Corrections/Arrears)
    netPay += adjustmentTotal;
    // console.log(`💡 [PAYROLL] Applying adjustments for ${employee.firstName}: ₹${adjustmentTotal} (New Net: ₹${netPay})`);

    // 🔒 SAFETY: Validate net pay
    if (isNaN(netPay) || !isFinite(netPay)) {
        console.error(`❌ [PAYROLL] Net pay calculation resulted in invalid value (NaN/Infinity): ${netPay}`);
        console.error(`   - Details: Taxable Income: ₹${taxableIncome}, Income Tax: ₹${incomeTax}, Post-Tax Total: ₹${postTaxDeductions.total}, Adjustments: ₹${adjustmentTotal}`);
        netPay = 0;
    }

    // Ensure net pay is not negative
    if (netPay < 0) {
        console.warn(`⚠️ [PAYROLL] Net pay is negative (₹${netPay}). Setting to 0.`);
        netPay = 0;
    }

    // Prepare employer contributions snapshot (from template)
    const employerContributions = payrollPhase2.mergeResolvedInputsIntoEmployerContributions(
        salaryTemplate.employerDeductions.map(contrib => ({
            name: contrib.name,
            amount: contrib.monthlyAmount
        })),
        resolvedPhase2Inputs
    ).map(contrib => ({
        name: contrib.name,
        amount: contrib.monthlyAmount
            ?? contrib.amount
    }));

    const adjustmentsSnapshot = pendingAdjustments.map(adj => ({
        adjustmentId: adj._id,
        type: adj.adjustmentType,
        amount: adj.adjustmentAmount,
        reason: adj.reason
    }));
    const varianceSnapshot = await payrollPhase1.buildVarianceSnapshot(
        db,
        tenantId,
        employee._id,
        month,
        year,
        {
            grossEarnings: grossCalculation.totalGross,
            netPay,
            incomeTax
        }
    );
    const traceSteps = [
        buildTraceStep(1, 'ATTENDANCE', 'Attendance Summary', 'Payable days determined from attendance records and safeguards.', {
            attendanceRecords: attendanceRecords.length,
            totalDays: attendanceSummary.totalDays || 0,
            presentDays: attendanceSummary.presentDays || 0,
            leaveDays: attendanceSummary.leaveDays || 0,
            lopDays: attendanceSummary.lopDays || 0,
            holidayDays: attendanceSummary.holidayDays || 0
        }, attendanceSummary),
        buildTraceStep(2, 'PHASE2_INPUTS', 'Phase 2 Inputs', 'Approved payroll input batches and derived attendance inputs are merged into the run snapshot before tax.', {
            inputBatchIds: resolvedPhase2Inputs.inputBatchIds || [],
            overtimeSummary: resolvedPhase2Inputs.overtimeSummary || {},
            shiftSummary: resolvedPhase2Inputs.shiftSummary || {},
            totals: resolvedPhase2Inputs.summary || {}
        }, {
            itemCount: resolvedPhase2Inputs.items?.length || 0
        }),
        buildTraceStep(3, 'EARNINGS', 'Gross Earnings', 'Gross earnings are calculated from salary components after pro-rata rules and approved supplemental inputs.', {
            componentCount: grossCalculation.earningsSnapshot?.length || 0,
            basicAmount: grossCalculation.basicAmount || 0,
            taxableGross: grossCalculation.taxableGross || grossCalculation.totalGross
        }, { grossEarnings: grossCalculation.totalGross }),
        buildTraceStep(4, 'PRE_TAX', 'Pre-Tax Deductions', 'Pre-tax deductions include statutory deductions, configured employee deductions, and approved payroll input deductions.', {
            snapshot: preTaxDeductions.snapshot
        }, { total: preTaxDeductions.total }),
        buildTraceStep(5, 'TAXABLE_INCOME', 'Taxable Income', 'Taxable income equals taxable gross minus pre-tax deductions.', {
            taxableGross: grossCalculation.taxableGross || grossCalculation.totalGross,
            preTaxDeductions: preTaxDeductions.total
        }, { taxableIncome }),
        buildTraceStep(6, 'TDS', 'Income Tax', 'Monthly TDS is resolved using the active tax rule set, employee tax profile, and fiscal year-to-date tax position.', {
            regime: tdsResult.regime || taxProfileSnapshot?.regime || 'NEW',
            enhancedMode: tdsResult.enhancedMode === true,
            annualTaxable: tdsResult.annualTaxable || tdsResult.annual || 0,
            ytdTaxableIncome: fiscalYearTaxStats.taxableIncome || 0,
            taxAlreadyDeducted: fiscalYearTaxStats.incomeTax || 0
        }, {
            monthlyTDS: incomeTax,
            annualTaxWithCess: tdsResult.annualTaxWithCess || 0
        }),
        buildTraceStep(7, 'POST_TAX', 'Post-Tax Deductions', 'Post-tax deductions include loans, advances, penalties, leave deductions, and approved payroll input deductions.', {
            snapshot: postTaxDeductions.snapshot
        }, { total: postTaxDeductions.total }),
        buildTraceStep(8, 'ADJUSTMENTS', 'Payroll Adjustments', 'Approved payroll adjustments are applied after tax and deductions.', {
            adjustments: adjustmentsSnapshot
        }, { adjustmentTotal }),
        buildTraceStep(9, 'NET_PAY', 'Net Pay', 'Net pay equals taxable income minus TDS, post-tax deductions, and then plus approved adjustments.', {
            taxableIncome,
            incomeTax,
            postTaxDeductions: postTaxDeductions.total,
            adjustmentTotal
        }, { netPay })
    ];
    let persistedArtifacts = {
        attendanceSnapshot: null,
        inputSnapshot: null,
        calculationTrace: null
    };
    const runMetadataSnapshot = {
        payrollRunId: payrollRunId || null,
        runType,
        executionMode,
        attendancePolicy,
        runCode: executionContext.runCode || '',
        sequenceNo: executionContext.sequenceNo || null,
        payDate: executionContext.payDate || null,
        payrollProfileSegments: payrollProfileSegmentsSnapshot,
        locationPolicySegments: locationPolicySegmentsSnapshot,
        deductionPlanSummary: deductionPlanSnapshot?.summary || null
    };
    const phase2InputsSnapshot = {
        ...(resolvedPhase2Inputs.phase2Snapshot || {}),
        inputBatchIds: resolvedPhase2Inputs.inputBatchIds || [],
        summary: resolvedPhase2Inputs.summary || {},
        overtimeSummary: resolvedPhase2Inputs.overtimeSummary || {},
        shiftSummary: resolvedPhase2Inputs.shiftSummary || {},
        exceptionFlags,
        cityPolicyAdjusted: locationPolicySegmentsSnapshot.length > 0
    };

    if (!dryRun) {
        persistedArtifacts = await payrollPhase1.persistPayrollArtifacts(
            db,
            {
                tenantId,
                payrollRunId,
                employeeId: employee._id,
                month,
                year,
                salarySourceSnapshot,
                payrollProfileSnapshot,
                locationPolicySnapshot,
                statutoryRuleSnapshot,
                taxProfileSnapshot,
                payrollProfileSegmentsSnapshot,
                locationPolicySegmentsSnapshot,
                deductionPlanSnapshot,
                attendanceSummary,
                attendanceRecordCount: attendanceRecords.length,
                deductions: {
                    preTax: preTaxDeductions.snapshot,
                    preTaxTotal: preTaxDeductions.total,
                    postTax: postTaxDeductions.snapshot,
                    postTaxTotal: postTaxDeductions.total,
                    tds: tdsResult
                },
                adjustments: adjustmentsSnapshot,
                phase2Snapshot: phase2InputsSnapshot,
                runMetadata: runMetadataSnapshot,
                warnings: traceWarnings,
                errors: traceErrors,
                traceSteps,
                summary: {
                    grossEarnings: grossCalculation.totalGross,
                    taxableIncome,
                    incomeTax,
                    postTaxDeductionsTotal: postTaxDeductions.total,
                    netPay,
                    adjustmentTotal
                }
            },
            {
                mode: 'RUN',
                userId: generatedByUserId
            }
        );
    }

    // Create payslip snapshot
    const payslipData = {
        tenantId,
        employeeId: employee._id,
        payrollRunId: payrollRunId || new mongoose.Types.ObjectId(), // Mock ID for preview if null
        status: 'DRAFT',
        month,
        year,
        employeeInfo: {
            employeeId: employee.employeeId || '',
            name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
            department: employee.departmentId?.name || employee.department || 'General',
            designation: employee.designation || employee.role || 'N/A',
            bankAccountNumber: employee.bankDetails?.accountNumber || '',
            bankIFSC: employee.bankDetails?.ifsc || '',
            bankName: employee.bankDetails?.bankName || '',
            branchName: payrollProfileSnapshot?.branchName || employee.bankDetails?.branchName || '',
            accountHolderName: employee.bankDetails?.accountHolderName || '',
            panNumber: employee.documents?.panCard || employee.panCard || '',
            pfNumber: employee.meta?.pfNo || employee.pfNo || '',
            uanNumber: employee.meta?.uanNo || employee.uanNo || '',
            gender: employee.gender || 'N/A',
            dob: employee.dob || null,
            joiningDate: employee.joiningDate || null
        },
        earningsSnapshot: grossCalculation.earningsSnapshot,
        preTaxDeductionsSnapshot: preTaxDeductions.snapshot,
        postTaxDeductionsSnapshot: postTaxDeductions.snapshot,
        employerContributionsSnapshot: employerContributions,
        grossEarnings: grossCalculation.totalGross,
        preTaxDeductionsTotal: preTaxDeductions.total,
        taxableIncome,
        incomeTax,
        tdsSnapshot: tdsResult,
        postTaxDeductionsTotal: postTaxDeductions.total,
        netPay,
        adjustmentsSnapshot,
        attendanceSummary,
        attendanceSnapshotId: persistedArtifacts.attendanceSnapshot?._id || null,

        salaryTemplateId: salaryTemplate._id,
        salarySourceSnapshot,
        payrollProfileSnapshot,
        payrollProfileSegmentsSnapshot,
        locationPolicySnapshot,
        locationPolicySegmentsSnapshot,
        deductionPlanSnapshot,
        statutoryRuleSnapshot,
        taxProfileSnapshot,
        payrollInputSnapshotId: persistedArtifacts.inputSnapshot?._id || null,
        calculationTraceId: persistedArtifacts.calculationTrace?._id || null,
        varianceSnapshot,
        runMetadataSnapshot,
        phase2InputsSnapshot,
        generatedBy: generatedByUserId
    };

    const payslip = new Payslip(payslipData);

    // Manually generate hash to avoid pre-validate hook issues
    if (!payslip.hash) {
        const crypto = require('crypto');
        const hashData = JSON.stringify({
            grossEarnings: payslip.grossEarnings || 0,
            preTaxDeductionsTotal: payslip.preTaxDeductionsTotal || 0,
            taxableIncome: payslip.taxableIncome || 0,
            incomeTax: payslip.incomeTax || 0,
            postTaxDeductionsTotal: payslip.postTaxDeductionsTotal || 0,
            netPay: payslip.netPay || 0,
            adjustments: payslip.adjustmentsSnapshot?.map(a => ({ id: a.adjustmentId, amt: a.amount })),
            phase2: payslip.phase2InputsSnapshot || {},
            runMetadata: payslip.runMetadataSnapshot || {}
        });
        payslip.hash = crypto.createHash('sha256').update(hashData).digest('hex');
    }

    // 🔍 COMPREHENSIVE LOGGING BEFORE SAVE
    // console.log(`\n🎯 [PAYROLL] Final Payslip Data for ${employee.firstName} ${employee.lastName}:`);
    // console.log(`   📊 Earnings Snapshot: ${payslip.earningsSnapshot?.length || 0} items`);
    if (payslip.earningsSnapshot && payslip.earningsSnapshot.length > 0) {
        payslip.earningsSnapshot.forEach((e, idx) => {
            // console.log(`      ${idx + 1}. ${e.name}: ₹${e.amount}`);
        });
    }
    // console.log(`   💰 Gross Earnings: ₹${payslip.grossEarnings}`);
    // console.log(`   📉 Pre-Tax Deductions: ₹${payslip.preTaxDeductionsTotal}`);
    // console.log(`   💸 Taxable Income: ₹${payslip.taxableIncome}`);
    // console.log(`   🏦 Income Tax: ₹${payslip.incomeTax}`);
    // console.log(`   📉 Post-Tax Deductions: ₹${payslip.postTaxDeductionsTotal}`);
    // console.log(`   ✅ Net Pay: ₹${payslip.netPay}`);
    // console.log(`   🔒 Dry Run: ${dryRun ? 'YES (Preview)' : 'NO (Saving to DB)'}\n`);

    if (!dryRun) {
        await payslip.save();
        await payrollPhase1.attachPayslipToTrace(db, payslip.calculationTraceId, payslip._id);
        await markEmployeeDeductionsApplied(db, [
            ...(preTaxDeductions.appliedEmployeeDeductions || []),
            ...(postTaxDeductions.appliedEmployeeDeductions || [])
        ]);
        // console.log(`✅ [PAYROLL] Payslip saved to DB with ID: ${payslip._id}`);

        // 🎯 MARK ADJUSTMENTS AS APPLIED
        if (pendingAdjustments.length > 0) {
            await PayrollAdjustment.updateMany(
                { _id: { $in: pendingAdjustments.map(a => a._id) } },
                {
                    $set: {
                        status: 'APPLIED',
                        appliedInPayslipId: payslip._id
                    }
                }
            );
            // console.log(`📝 [PAYROLL] Marked ${pendingAdjustments.length} adjustments as APPLIED`);
        }
    }

    return payslip;
}

/**
 * Calculate attendance summary
 */
function calculateAttendanceSummary(attendanceRecords, daysInMonth, holidayDates, joiningDate, monthStartDate, empIdForLog, monthEndDate = null) {
    let presentDays = 0;
    let leaveDays = 0;
    let lopDays = 0;
    let holidayDays = 0;

    // console.log(`\n📊 [ATTENDANCE SUMMARY] Processing ${attendanceRecords.length} records for employee ${empIdForLog}`);
    // console.log(`   - Total Days in Month: ${daysInMonth}`);
    // console.log(`   - Holiday Dates Count: ${holidayDates.size}`);

    const periodStartDate = normalizeBoundaryStart(monthStartDate);
    const periodEndDate = normalizeBoundaryEnd(monthEndDate || new Date(periodStartDate.getFullYear(), periodStartDate.getMonth() + 1, 0));

    // Validate joining date
    const isValidJoinDate = joiningDate instanceof Date && !isNaN(joiningDate.getTime());
    const joinDate = isValidJoinDate ? normalizeBoundaryStart(joiningDate) : null;

    let actualDaysInMonth = daysInMonth;
    if (joinDate && joinDate > periodEndDate) {
        actualDaysInMonth = 0;
    } else if (joinDate && joinDate >= periodStartDate && joinDate <= periodEndDate) {
        actualDaysInMonth = daysBetweenInclusive(joinDate, periodEndDate);
    }

    attendanceRecords.forEach(record => {
        const dateStr = record.date.toISOString().split('T')[0];

        // Status normalization (case-insensitive)
        const status = (record.status || '').toLowerCase();
        const isWFH = record.isWFH === true || status === 'work_from_home' || status === 'wfh';
        const isOnDuty = record.isOnDuty === true || status === 'on_duty' || status === 'od';

        // ✅ Primary check: status === 'present' (case-insensitive)
        const isPresent = status === 'present';

        // Accumulate explicit LOP (from penalty rules) for reporting
        if (record.lopDays && typeof record.lopDays === 'number') {
            lopDays += record.lopDays;
        }

        if (holidayDates.has(dateStr)) {
            holidayDays++;
            // Holidays are paid days
            presentDays += 1;
        } else if (isPresent || status === 'half_day' || isWFH || isOnDuty) {
            // STRICT DAY-WISE CALCULATION: Ignore hours, use purely day status
            const dayWeight = status === 'half_day' ? 0.5 : 1;
            presentDays += dayWeight;
        } else if (status === 'leave') {
            // Check if paid leave or unpaid (LOP)
            // If it's a paid leave, it should count towards present days for salary purposes
            if (record.leaveType && (record.leaveType.toLowerCase().includes('lop') || record.leaveType.toLowerCase().includes('unpaid'))) {
                // It's unpaid, count as LOP
                if (!record.lopDays) {
                    lopDays++;
                }
            } else {
                // It's a PAID leave, count towards present/payable days!
                leaveDays++;
                presentDays += 1; // Paid leaves count as payable days in day-wise calculation
            }
        } else if (status === 'absent') {
            if (!record.lopDays) {
                lopDays++;
            }
        }
    });

    // 🛡️ RECOVERY: For monthly fixed salary, we assume days with NO records are PAID (Weekends/Working days without punch)
    // unless they were explicitly marked as Absent/LOP.
    // However, if the count is still low, we adjust it to (ActualDaysInMonth - LOPDays)
    const calculatedPayableDays = actualDaysInMonth - lopDays;
    if (presentDays < calculatedPayableDays) {
        // console.log(`ℹ️ [ATTENDANCE] Adjusting payable days from ${presentDays} to ${calculatedPayableDays} (Actual - LOP)`);
        presentDays = calculatedPayableDays;
    }

    // console.log(`\n✅ [ATTENDANCE SUMMARY] Results:`);
    // console.log(`   - Total Days: ${actualDaysInMonth}`);
    // console.log(`   - Present Days: ${presentDays}`);
    // console.log(`   - Leave Days (Paid): ${leaveDays}`);
    // console.log(`   - LOP Days: ${lopDays}`);
    // console.log(`   - Holiday Days: ${holidayDays}`);
    // console.log(`   - Pro-rata Formula: (basic / ${actualDaysInMonth}) * ${presentDays}\n`);

    return {
        totalDays: actualDaysInMonth,
        presentDays,
        leaveDays,
        lopDays,
        holidayDays
    };
}

/**
 * Calculate Gross Earnings with pro-rata
 */
function calculateGrossEarnings(earnings, daysInMonth, presentDays, lopDays) {
    const earningsSnapshot = [];
    let totalGross = 0;
    let basicAmount = 0;  // Pro-rated basic for deductions
    let originalBasicAmount = 0;  // Original monthly basic
    let taxableGross = 0;

    earnings.forEach(earning => {
        let amount = earning.monthlyAmount || 0;
        let originalAmount = amount;
        let isProRata = false;

        // Use ComponentKey Normalizer for robust matching
        const normalizedName = normalizeComponentKey(earning.name);
        const isBasic = normalizedName === 'basic' || earning.name.toLowerCase().includes('basic');

        // Apply pro-rata if enabled (Default to TRUE for ALL components unless explicitly false)
        // User requested strict day-wise calculation for all components
        if (earning.proRata !== false) {
            // Track original basic amount
            if (isBasic) {
                originalBasicAmount = originalAmount;
            }

            // Pro-rata calculation: (amount / calendarDaysInMonth) * presentDays
            // RULE: Divisor MUST be the full calendar month days (e.g. 30/31)
            const calculatedAmount = (amount / daysInMonth) * presentDays;

            // 🔍 Debug log for pro-rata calculation
            if (isBasic) {
                // console.log(`\n💰 [PRO-RATA DEBUG] Basic Salary Calculation:`);
                // console.log(`   - Component: ${earning.name}`);
                // console.log(`   - Original Monthly Amount: ₹${originalAmount}`);
                // console.log(`   - Total Days in Month: ${daysInMonth}`);
                // console.log(`   - Present Days: ${presentDays}`);
                // console.log(`   - Formula: (${originalAmount} / ${daysInMonth}) * ${presentDays}`);
                // console.log(`   - Calculated: ₹${calculatedAmount}`);
            }

            amount = Math.round(calculatedAmount * 100) / 100;
            isProRata = true;

            // Set pro-rated basic amount for deductions
            if (isBasic) {
                basicAmount = amount;  // Use pro-rated amount
            }
        } else {
            // Non-pro-rated basic (if exists)
            if (isBasic && !basicAmount) {
                basicAmount = amount;
                originalBasicAmount = amount;
            }
        }

        earningsSnapshot.push({
            name: earning.name,
            amount: Math.round(amount * 100) / 100,
            isProRata,
            originalAmount: originalAmount,
            daysWorked: isProRata ? presentDays : null,
            totalDays: isProRata ? daysInMonth : null
        });

        totalGross += amount;
        // Accumulate taxable gross only for components marked taxable (default true)
        const isTaxable = earning.taxable === false ? false : true;
        if (isTaxable) taxableGross += amount;
    });

    // 🔒 SAFETY: If no component was identified as 'basic', use the first earning as a fallback 
    // to ensure deductions (PF/ESI) don't crash with zero base.
    if (basicAmount === 0 && earningsSnapshot.length > 0) {
        // Only warn if totalGross is > 0, otherwise it's just a 0-salary employee
        if (totalGross > 0) {
            console.warn(`⚠️ [PAYROLL] No 'basic' component identified for deductions. Using first earning.`);
            basicAmount = earningsSnapshot[0].amount;
            originalBasicAmount = earningsSnapshot[0].originalAmount;
        }
    }

    return {
        earningsSnapshot,
        totalGross: Math.round(totalGross * 100) / 100,
        taxableGross: Math.round(taxableGross * 100) / 100,
        basicAmount,  // Pro-rated basic for deduction calculations
        originalBasicAmount  // Original monthly basic for reference
    };
}

/**
 * Calculate Pre-Tax Deductions (EPF, ESI, Professional Tax, TDS)
 */
async function calculatePreTaxDeductions(
    db,
    tenantId,
    employeeId,
    grossEarnings,
    basicAmount,
    templateSettings,
    templateDeductions = [],
    payrollStartDate = null,
    payrollEndDate = null,
    locationPolicy = null,
    statutoryRuleSet = null,
    deductionPlan = null,
    locationSegments = [],
    totalPayrollDays = 0
) {
    const snapshot = [];
    let total = 0;
    const appliedEmployeeDeductions = [];
    const resolvedPlan = deductionPlan || await getUnifiedEmployeeDeductionPlan(
        db,
        tenantId,
        employeeId,
        payrollStartDate,
        payrollEndDate,
        templateDeductions
    );
    const employeeDeductions = Array.isArray(resolvedPlan?.preTax)
        ? resolvedPlan.preTax
        : await getResolvedEmployeeDeductions(
            db,
            tenantId,
            employeeId,
            payrollStartDate,
            payrollEndDate,
            'PRE_TAX'
        );

    const pfEnabled = statutoryRuleSet?.pf?.enabled !== false && (
        templateSettings?.includePensionScheme ||
        employeeDeductions.some((item) => ['EPF', 'OTHER'].includes(item.statutoryCategory) && isStatutoryAutoDeductionName(item.name))
    );
    const pfWageLimit = roundPayrollAmount(
        statutoryRuleSet?.pf?.wageCeiling ?? templateSettings?.pfWageLimit ?? 15000,
        15000
    );
    const pfWageRestriction = templateSettings?.pfWageRestriction !== false || statutoryRuleSet?.pf?.capContribution === true;
    const professionalTaxEnabled = locationPolicy?.professionalTax?.enabled === true || statutoryRuleSet?.professionalTax?.enabled === true;
    const locationProfessionalTax = Array.isArray(locationSegments) && locationSegments.length > 0
        ? calculateProfessionalTaxForSegments(locationSegments, statutoryRuleSet, grossEarnings, totalPayrollDays || 0)
        : (
            locationPolicy?.professionalTax?.enabled === true
                ? roundPayrollAmount(locationPolicy?.professionalTax?.amount, 0)
                : 0
        );
    const statutoryProfessionalTax = locationProfessionalTax > 0
        ? locationProfessionalTax
        : calculateProfessionalTaxFromSlabs(statutoryRuleSet?.professionalTax?.slabs || [], grossEarnings) ||
            roundPayrollAmount(statutoryRuleSet?.professionalTax?.defaultAmount, 0);
    const filteredTemplateDeductions = resolvedPlan
        ? []
        : (
            statutoryProfessionalTax > 0
                ? templateDeductions.filter((deduction) => !isProfessionalTaxName(deduction?.name || deduction?.label || deduction?.componentName))
                : templateDeductions
        );

    if (pfEnabled) {
        const pfWage = pfWageRestriction
            ? Math.min(basicAmount, pfWageLimit)
            : basicAmount;
        const epfAmount = roundPayrollAmount((pfWage * roundPayrollAmount(statutoryRuleSet?.pf?.employeeRate, 12)) / 100, 0);
        snapshot.push({
            name: 'Employee Provident Fund (EPF)',
            amount: epfAmount,
            category: 'EPF'
        });
        total += epfAmount;
    }

    const esiGrossContext = calculateApplicableEsiGross(locationSegments, grossEarnings, totalPayrollDays || 0);
    if (statutoryRuleSet?.esi?.enabled !== false && templateSettings?.includeESI !== false) {
        const esiWageCeiling = roundPayrollAmount(statutoryRuleSet?.esi?.wageCeiling, 21000);
        const esiGrossBase = esiGrossContext.hasExplicitOverride ? esiGrossContext.applicableGross : grossEarnings;
        if (esiGrossBase <= esiWageCeiling && esiGrossBase > 0) {
            const esiAmount = roundPayrollAmount((esiGrossBase * roundPayrollAmount(statutoryRuleSet?.esi?.employeeRate, 0.75)) / 100, 0);
            if (esiAmount > 0) {
                snapshot.push({
                    name: 'Employee State Insurance (ESI)',
                    amount: esiAmount,
                    category: 'ESI'
                });
                total += esiAmount;
            }
        }
    }

    for (const deduction of employeeDeductions) {
        if (isResolvedDeductionStatutory(deduction)) {
            if (deduction.statutoryCategory === 'EPF' || deduction.statutoryCategory === 'ESI' || isStatutoryAutoDeductionName(deduction.name)) {
                continue;
            }
            if (deduction.statutoryCategory === 'TDS') {
                continue;
            }
            if (statutoryProfessionalTax > 0 && isResolvedDeductionProfessionalTax(deduction)) {
                continue;
            }
        }

        const amount = resolveDeductionAmount(deduction, grossEarnings, basicAmount);
        if (amount <= 0) continue;

        snapshot.push({
            name: deduction.name,
            amount,
            category: mapResolvedPreTaxSnapshotCategory(deduction)
        });
        total += amount;
        appliedEmployeeDeductions.push(deduction);
    }

    if (professionalTaxEnabled && statutoryProfessionalTax > 0) {
        snapshot.push({
            name: 'Professional Tax',
            amount: statutoryProfessionalTax,
            category: 'PROFESSIONAL_TAX'
        });
        total += statutoryProfessionalTax;
    }

    const lwfAmount = calculateLwfForSegments(locationSegments, payrollStartDate, totalPayrollDays || 0);
    if (lwfAmount > 0) {
        snapshot.push({
            name: 'Labour Welfare Fund (LWF)',
            amount: lwfAmount,
            category: 'OTHER'
        });
        total += lwfAmount;
    }

    total = appendTemplateDeductions(snapshot, total, filteredTemplateDeductions, 'PRE_TAX', grossEarnings, basicAmount);

    return {
        snapshot,
        total: roundPayrollAmount(total, 0),
        appliedEmployeeDeductions
    };
}

/**
 * Calculate Income Tax (TDS) - Placeholder implementation
 * TODO: Implement proper tax calculation based on:
 * - Tax regime (Old vs New)
 * - Annual income projection
 * - Investments and deductions
 * - Tax slabs
*/

/**
 * Calculate Post-Tax Deductions (Loans, LOP, Advances, Penalties)
 */
async function calculatePostTaxDeductions(
    db,
    tenantId,
    employeeId,
    grossEarnings,
    basicAmount,
    lopDays,
    monthlyBasic,
    daysInMonth,
    payrollStartDate = null,
    payrollEndDate = null,
    dailyRateForLeave = 0,
    templateDeductions = [],
    deductionPlan = null
) {
    const snapshot = [];
    let total = 0;
    const appliedEmployeeDeductions = [];

    // Excess leave deduction: if employee took more than allowed leave in the month, deduct for extra days
    const ALLOWED_LEAVE_DAYS_PER_MONTH = 2; // Configurable: typically 1–2 casual leave days per month
    if (payrollStartDate && payrollEndDate && dailyRateForLeave > 0) {
        try {
            const LeaveRequest = db.model('LeaveRequest');
            const LeavePolicy = db.model('LeavePolicy');
            const requests = await LeaveRequest.find({
                tenant: tenantId,
                employee: employeeId,
                status: 'Approved',
                startDate: { $lte: payrollEndDate },
                endDate: { $gte: payrollStartDate }
            }).lean();
            let totalLeaveDaysInMonth = 0;
            for (const lr of requests) {
                const from = new Date(Math.max(new Date(lr.startDate).getTime(), payrollStartDate.getTime()));
                const to = new Date(Math.min(new Date(lr.endDate).getTime(), payrollEndDate.getTime()));
                const days = Math.max(0, Math.ceil((to - from) / (1000 * 60 * 60 * 24))) + 1;
                totalLeaveDaysInMonth += days;
            }
            let allowed = ALLOWED_LEAVE_DAYS_PER_MONTH;
            try {
                const policy = await LeavePolicy.findOne({ tenant: tenantId }).lean();
                if (policy && policy.rules && policy.rules.length) {
                    const casual = policy.rules.find(r => (r.leaveType || '').toLowerCase().includes('casual'));
                    if (casual && casual.daysPerYear != null) allowed = Math.ceil((casual.daysPerYear || 12) / 12);
                }
            } catch (_) { /* use default */ }
            const excessDays = Math.max(0, totalLeaveDaysInMonth - allowed);
            if (excessDays > 0) {
                const excessAmount = Math.round(dailyRateForLeave * excessDays * 100) / 100;
                snapshot.push({ name: 'Excess Leave Deduction', amount: excessAmount, category: 'EXCESS_LEAVE' });
                total += excessAmount;
            }
        } catch (leaveErr) {
            console.warn('[PAYROLL] Excess leave deduction skip:', leaveErr.message);
        }
    }

    const resolvedPlan = deductionPlan || await getUnifiedEmployeeDeductionPlan(
        db,
        tenantId,
        employeeId,
        payrollStartDate,
        payrollEndDate,
        templateDeductions
    );
    const postTaxDeductions = Array.isArray(resolvedPlan?.postTax)
        ? resolvedPlan.postTax
        : await getResolvedEmployeeDeductions(
            db,
            tenantId,
            employeeId,
            payrollStartDate,
            payrollEndDate,
            'POST_TAX'
        );

    // Calculate LOP (Loss of Pay)
    // ⚠️ FIXED: Disabled LOP deduction here because Basic is already pro-rated based on presentDays in calculateGrossEarnings.
    // Enabling this would cause double deduction (once in pro-ratio, and again here).
    /*
    if (lopDays > 0) {
        const lopAmount = Math.round((monthlyBasic / daysInMonth) * lopDays * 100) / 100;
        snapshot.push({
            name: 'Loss of Pay (LOP)',
            amount: lopAmount,
            category: 'LOP'
        });
        total += lopAmount;
    }
    */

    // Calculate other post-tax deductions
    for (const deduction of postTaxDeductions) {
        const normalizedName = normalizeDeductionName(deduction.name);
        if (normalizedName.includes('lop') || normalizedName.includes('loss of pay')) {
            continue;
        }

        const amount = resolveDeductionAmount(deduction, grossEarnings, basicAmount);
        if (amount > 0) {
            snapshot.push({
                name: deduction.name,
                amount,
                category: mapResolvedPostTaxSnapshotCategory(deduction)
            });
            total += amount;
            appliedEmployeeDeductions.push(deduction);
        }
    }

    total = appendTemplateDeductions(
        snapshot,
        total,
        resolvedPlan ? [] : templateDeductions,
        'POST_TAX',
        grossEarnings,
        basicAmount
    );

    return {
        snapshot,
        total: roundPayrollAmount(total, 0),
        appliedEmployeeDeductions
    };
}

module.exports = {
    getUnifiedEmployeeDeductionPlan,
    runPayroll,
    preflightPayrollRun,
    // Exported for controllers to perform previews and single-employee calculations
    calculateEmployeePayroll
};

