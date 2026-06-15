const mongoose = require('mongoose');

const EmployeeCtcVersionSchema = require('../models/EmployeeCtcVersion');
const EmployeePayrollProfileSchema = require('../models/EmployeePayrollProfile');

const ACTIVE_VERSION_STATUSES = ['ACTIVE', 'SCHEDULED'];
const ACTIVE_PROFILE_STATUSES = ['ACTIVE', 'SCHEDULED'];

function getModel(db, name, schema) {
    try {
        return db.model(name);
    } catch (_err) {
        return db.model(name, schema);
    }
}

function toDate(value, fallback = null) {
    if (!value) return fallback;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? fallback : date;
}

function startOfDay(value) {
    const date = toDate(value, new Date());
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfDay(value) {
    const date = toDate(value, new Date());
    date.setHours(23, 59, 59, 999);
    return date;
}

function dayBefore(value) {
    const date = startOfDay(value);
    date.setDate(date.getDate() - 1);
    date.setHours(23, 59, 59, 999);
    return date;
}

function dayAfter(value) {
    const date = startOfDay(value);
    date.setDate(date.getDate() + 1);
    return date;
}

function normalizeObjectId(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (mongoose.Types.ObjectId.isValid(String(value))) {
        return new mongoose.Types.ObjectId(String(value));
    }
    return value;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    const startA = startOfDay(aStart);
    const endA = aEnd ? endOfDay(aEnd) : new Date('9999-12-31T23:59:59.999Z');
    const startB = startOfDay(bStart);
    const endB = bEnd ? endOfDay(bEnd) : new Date('9999-12-31T23:59:59.999Z');
    return startA <= endB && startB <= endA;
}

function normalizeMoney(value) {
    const amount = parseFloat(String(value ?? 0).replace(/[^0-9.-]+/g, '')) || 0;
    return Math.round(amount * 100) / 100;
}

function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function hasValue(value) {
    return normalizeText(value).length > 0;
}

function pickFirstNonEmpty(...values) {
    for (const value of values) {
        const normalized = normalizeText(value);
        if (normalized) return normalized;
    }
    return '';
}

function isSameObjectId(left, right) {
    if (!left || !right) return false;
    return String(left) === String(right);
}

function normalizeSettings(settings = {}) {
    return {
        includePensionScheme: settings.includePensionScheme !== false,
        includeESI: settings.includeESI !== false,
        pfWageRestriction: settings.pfWageRestriction !== false,
        pfWageLimit: settings.pfWageLimit == null ? 15000 : normalizeMoney(settings.pfWageLimit)
    };
}

function determineTemporalState(effectiveFrom, effectiveTo = null, referenceDate = new Date()) {
    const start = startOfDay(effectiveFrom);
    const end = effectiveTo ? endOfDay(effectiveTo) : null;
    const reference = startOfDay(referenceDate);

    if (end && end < reference) {
        return { status: 'EXPIRED', isActive: false };
    }

    if (start > reference) {
        return { status: 'SCHEDULED', isActive: false };
    }

    return { status: 'ACTIVE', isActive: true };
}

function buildVersionStateFields(effectiveFrom, effectiveTo = null, userId = null, forcedStatus = null) {
    const normalizedForcedStatus = forcedStatus ? String(forcedStatus).toUpperCase() : null;
    const temporalState =
        normalizedForcedStatus === 'INACTIVE'
            ? { status: 'INACTIVE', isActive: false }
            : normalizedForcedStatus === 'EXPIRED'
                ? { status: 'EXPIRED', isActive: false }
                : normalizedForcedStatus === 'SCHEDULED'
                    ? { status: 'SCHEDULED', isActive: false }
                    : normalizedForcedStatus === 'ACTIVE'
                        ? { status: 'ACTIVE', isActive: true }
                        : determineTemporalState(effectiveFrom, effectiveTo);

    return {
        effectiveTo,
        isActive: temporalState.isActive,
        status: temporalState.status,
        updatedBy: userId || undefined
    };
}

function buildProfileStateFields(effectiveFrom, effectiveTo = null, userId = null, forcedStatus = null) {
    const normalizedForcedStatus = forcedStatus ? String(forcedStatus).toUpperCase() : null;
    const temporalState =
        normalizedForcedStatus === 'INACTIVE'
            ? { status: 'INACTIVE' }
            : normalizedForcedStatus === 'EXPIRED'
                ? { status: 'EXPIRED' }
                : normalizedForcedStatus === 'SCHEDULED'
                    ? { status: 'SCHEDULED' }
                    : normalizedForcedStatus === 'ACTIVE'
                        ? { status: 'ACTIVE' }
                        : determineTemporalState(effectiveFrom, effectiveTo);

    return {
        effectiveTo,
        status: temporalState.status,
        updatedBy: userId || undefined
    };
}

function normalizeComponent(component = {}, type = 'EARNING') {
    const monthlyAmount = normalizeMoney(
        component.monthlyAmount ??
        component.monthly ??
        component.amount ??
        component.value ??
        component.componentAmount
    );
    let annualAmount = normalizeMoney(
        component.annualAmount ??
        component.yearlyAmount ??
        component.yearly ??
        component.annual
    );

    if (annualAmount === 0 && monthlyAmount > 0) {
        annualAmount = Math.round(monthlyAmount * 12 * 100) / 100;
    }

    return {
        name: component.name || component.label || component.componentName || type,
        code: component.code || component.key || component.componentCode,
        monthlyAmount,
        annualAmount,
        type: String(component.type || type).toUpperCase(),
        isTaxable: component.isTaxable !== false && component.taxable !== false,
        isProRata: component.isProRata !== false && component.proRata !== false,
        category: component.category || component.deductionCategory,
        amountType: component.amountType || component.calculationType,
        calculationBase: component.calculationBase,
        amountValue: component.amountValue,
        percentage: component.percentage,
        enabled: component.enabled !== false
    };
}

function normalizeComponentsFromSource(source = {}) {
    const components = Array.isArray(source.components) ? source.components : [];
    if (components.length > 0) {
        return components.map(component => normalizeComponent(component, component.type || 'EARNING'));
    }

    const earnings = source.earnings || source.earningsSnapshot || [];
    const deductions = source.deductions || source.employeeDeductions || source.deductionsSnapshot || [];
    const benefits = source.benefits || source.employerBenefits || source.benefitsSnapshot || source.employerContributionsSnapshot || [];

    return [
        ...earnings.map(item => normalizeComponent(item, 'EARNING')),
        ...deductions.map(item => normalizeComponent(item, 'DEDUCTION')),
        ...benefits.map(item => normalizeComponent(item, 'BENEFIT'))
    ];
}

function calculateTotalsFromComponents(components = []) {
    const earningsAnnual = components
        .filter(item => item.type === 'EARNING')
        .reduce((sum, item) => sum + normalizeMoney(item.annualAmount), 0);
    const benefitsAnnual = components
        .filter(item => item.type === 'BENEFIT')
        .reduce((sum, item) => sum + normalizeMoney(item.annualAmount), 0);
    const deductionsAnnual = components
        .filter(item => item.type === 'DEDUCTION')
        .reduce((sum, item) => sum + normalizeMoney(item.annualAmount), 0);

    return {
        grossA: Math.round((earningsAnnual / 12) * 100) / 100,
        grossB: benefitsAnnual,
        grossC: deductionsAnnual,
        totalCTC: earningsAnnual + benefitsAnnual
    };
}

function buildCompensationFromVersion(version) {
    if (!version) return null;

    const plain = typeof version.toObject === 'function' ? version.toObject() : version;
    const components = normalizeComponentsFromSource(plain);
    const computedTotals = calculateTotalsFromComponents(components);
    const totalCTC = normalizeMoney(plain.totalCTC || computedTotals.totalCTC);
    const settings = normalizeSettings(plain.settings || {});

    return {
        _id: plain._id,
        companyId: plain.companyId,
        employeeId: plain.employeeId,
        version: plain.version,
        effectiveFrom: plain.effectiveFrom,
        effectiveTo: plain.effectiveTo,
        status: plain.status,
        revisionType: plain.revisionType,
        reason: plain.reason,
        notes: plain.notes,
        grossA: normalizeMoney(plain.grossA || computedTotals.grossA),
        grossB: normalizeMoney(plain.grossB || computedTotals.grossB),
        grossC: normalizeMoney(plain.grossC || computedTotals.grossC),
        totalCTC,
        components,
        settings,
        _salarySource: {
            source: 'EMPLOYEE_CTC_VERSION',
            sourceId: plain._id,
            version: plain.version,
            effectiveFrom: plain.effectiveFrom,
            effectiveTo: plain.effectiveTo,
            canonical: true
        }
    };
}

function buildSalarySourceSnapshot(compensation) {
    const source = compensation?._salarySource || {};
    return {
        source: source.source || compensation?.source || 'UNKNOWN',
        sourceId: source.sourceId || compensation?._id || null,
        version: source.version || compensation?.version || null,
        effectiveFrom: source.effectiveFrom || compensation?.effectiveFrom || null,
        effectiveTo: source.effectiveTo || compensation?.effectiveTo || null,
        canonical: source.canonical === true,
        status: compensation?.status || null,
        revisionType: compensation?.revisionType || null,
        totalCTC: normalizeMoney(compensation?.totalCTC || 0)
    };
}

function buildPayrollProfileSnapshot(profile) {
    if (!profile) return null;
    const plain = typeof profile.toObject === 'function' ? profile.toObject() : profile;
    return {
        profileId: plain._id,
        legalEntityId: plain.legalEntityId,
        branchId: plain.branchId,
        branchName: plain.branchName,
        workCity: plain.workCity,
        workState: plain.workState,
        country: plain.country,
        payrollRegion: plain.payrollRegion,
        effectiveFrom: plain.effectiveFrom,
        effectiveTo: plain.effectiveTo,
        source: plain.source
    };
}

async function resolveEffectiveSalaryVersion(db, tenantId, employeeId, periodStart, periodEnd) {
    const EmployeeCtcVersion = getModel(db, 'EmployeeCtcVersion', EmployeeCtcVersionSchema);
    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd || periodStart);

    const version = await EmployeeCtcVersion.findOne({
        companyId: tenantId,
        employeeId,
        status: { $in: ACTIVE_VERSION_STATUSES },
        effectiveFrom: { $lte: end },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: start } }
        ]
    }).sort({ effectiveFrom: -1, version: -1 }).lean();

    return buildCompensationFromVersion(version);
}

async function findEffectivePayrollProfileRecord(EmployeePayrollProfile, tenantId, employeeId, periodStart, periodEnd) {
    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd || periodStart);

    return EmployeePayrollProfile.findOne({
        tenantId,
        employeeId,
        status: { $in: ACTIVE_PROFILE_STATUSES },
        effectiveFrom: { $lte: end },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: start } }
        ]
    }).sort({ effectiveFrom: -1 }).lean();
}

async function loadEmployeeForPayrollProfileBackfill(db, tenantId, employeeOrId) {
    if (employeeOrId && typeof employeeOrId === 'object') {
        return employeeOrId;
    }

    const employeeId = employeeOrId;
    if (!employeeId) return null;

    try {
        const Employee = db.model('Employee');
        return Employee.findOne({ _id: employeeId, tenant: tenantId })
            .select('firstName lastName employeeId email joiningDate createdAt branchId branchName bankDetails commAddress permAddress tempAddress workCity workState workLocation')
            .lean();
    } catch (_err) {
        return null;
    }
}

async function loadBranchForPayrollProfileBackfill(db, tenantId, branchId) {
    const normalizedBranchId = normalizeObjectId(branchId);
    if (!normalizedBranchId) return null;

    try {
        const Branch = db.model('Branch');
        return Branch.findOne({
            _id: normalizedBranchId,
            $or: [
                { companyId: tenantId },
                { parentCompanyId: tenantId }
            ]
        }).select('name city state country').lean();
    } catch (_err) {
        return null;
    }
}

function extractEmployeeLocationDetails(employee = {}, branch = null) {
    const workLocation = employee?.workLocation || {};
    const city = pickFirstNonEmpty(
        employee?.workCity,
        workLocation?.city,
        employee?.commAddress?.city,
        employee?.permAddress?.city,
        employee?.tempAddress?.city,
        employee?.bankDetails?.location,
        branch?.city
    );
    const state = pickFirstNonEmpty(
        employee?.workState,
        workLocation?.state,
        employee?.commAddress?.state,
        employee?.permAddress?.state,
        employee?.tempAddress?.state,
        branch?.state
    );
    const country = pickFirstNonEmpty(
        workLocation?.country,
        employee?.commAddress?.country,
        employee?.permAddress?.country,
        employee?.tempAddress?.country,
        branch?.country,
        'India'
    );
    const branchName = pickFirstNonEmpty(
        employee?.branchName,
        branch?.name,
        employee?.bankDetails?.branchName
    );
    const resolvedBranchId = normalizeObjectId(employee?.branchId || branch?._id || null);

    return {
        city,
        state,
        country,
        branchId: resolvedBranchId,
        branchName,
        payrollRegion: state || city || 'DEFAULT',
        hasPolicyLocation: hasValue(state) || hasValue(city)
    };
}

function buildAutoBackfillProfilePayload(tenantId, employee = {}, location = {}, periodStart, periodEnd) {
    const effectiveFrom = startOfDay(
        periodStart ||
        employee?.joiningDate ||
        employee?.createdAt ||
        new Date()
    );

    return {
        tenantId,
        employeeId: employee._id,
        legalEntityId: tenantId,
        branchId: location.branchId || null,
        branchName: location.branchName || '',
        workCity: location.city || '',
        workState: location.state || '',
        country: location.country || 'India',
        payrollRegion: location.payrollRegion || location.state || location.city || 'DEFAULT',
        effectiveFrom,
        effectiveTo: periodEnd || null,
        source: 'SYSTEM',
        notes: 'Auto-backfilled from employee work location/address during payroll profile resolution'
    };
}

async function autoBackfillPayrollProfile(db, tenantId, employeeOrId, periodStart, periodEnd, options = {}) {
    const EmployeePayrollProfile = getModel(db, 'EmployeePayrollProfile', EmployeePayrollProfileSchema);
    const employeeId = employeeOrId?._id || employeeOrId;

    if (!employeeId) {
        return {
            profile: null,
            created: false,
            reason: 'MISSING_EMPLOYEE_ID'
        };
    }

    const existingEffectiveProfile = await findEffectivePayrollProfileRecord(
        EmployeePayrollProfile,
        tenantId,
        employeeId,
        periodStart,
        periodEnd
    );
    if (existingEffectiveProfile) {
        return {
            profile: existingEffectiveProfile,
            created: false,
            reason: 'EXISTING_PROFILE'
        };
    }

    const employee = await loadEmployeeForPayrollProfileBackfill(db, tenantId, options.employee || employeeOrId);
    if (!employee) {
        return {
            profile: null,
            created: false,
            reason: 'MISSING_EMPLOYEE_CONTEXT'
        };
    }

    const branch = await loadBranchForPayrollProfileBackfill(db, tenantId, employee.branchId);
    const location = extractEmployeeLocationDetails(employee, branch);
    if (!location.hasPolicyLocation) {
        return {
            profile: null,
            created: false,
            reason: 'MISSING_LOCATION_FIELDS'
        };
    }

    const activeProfiles = await EmployeePayrollProfile.find({
        tenantId,
        employeeId: employee._id,
        status: { $in: ACTIVE_PROFILE_STATUSES }
    }).sort({ effectiveFrom: 1 }).lean();
    const gap = findGapCoveringPeriod(activeProfiles, periodStart, periodEnd, ACTIVE_PROFILE_STATUSES);
    const nextRecord = gap?.nextRecordId
        ? activeProfiles.find((item) => isSameObjectId(item._id, gap.nextRecordId))
        : null;
    let effectiveFrom = startOfDay(
        gap?.gapStart ||
        periodStart ||
        employee?.joiningDate ||
        employee?.createdAt ||
        new Date()
    );
    const joiningDate = toDate(employee?.joiningDate || employee?.createdAt);
    if (joiningDate && effectiveFrom < startOfDay(joiningDate)) {
        effectiveFrom = startOfDay(joiningDate);
    }
    const periodEndSafe = endOfDay(periodEnd || periodStart);
    if (effectiveFrom > periodEndSafe) {
        return {
            profile: null,
            created: false,
            reason: 'EFFECTIVE_FROM_AFTER_PERIOD'
        };
    }
    const effectiveTo = nextRecord?.effectiveFrom ? dayBefore(nextRecord.effectiveFrom) : null;

    if (effectiveTo && endOfDay(effectiveTo) < startOfDay(effectiveFrom)) {
        return {
            profile: null,
            created: false,
            reason: 'INVALID_EFFECTIVE_RANGE'
        };
    }

    const payload = buildAutoBackfillProfilePayload(
        tenantId,
        employee,
        location,
        effectiveFrom,
        effectiveTo
    );

    const duplicateFilter = {
        tenantId,
        employeeId: employee._id,
        status: { $in: ACTIVE_PROFILE_STATUSES },
        effectiveFrom: payload.effectiveFrom,
        workCity: payload.workCity,
        workState: payload.workState,
        payrollRegion: payload.payrollRegion
    };
    if (payload.effectiveTo) {
        duplicateFilter.effectiveTo = payload.effectiveTo;
    } else {
        duplicateFilter.$or = [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } }
        ];
    }

    const duplicate = await EmployeePayrollProfile.findOne(duplicateFilter).lean();
    if (duplicate) {
        return {
            profile: duplicate,
            created: false,
            reason: 'IDEMPOTENT_REUSE'
        };
    }

    try {
        await createPayrollProfile(db, tenantId, employee._id, payload, options.userId || null);
        const resolved = await findEffectivePayrollProfileRecord(
            EmployeePayrollProfile,
            tenantId,
            employee._id,
            periodStart,
            periodEnd
        );

        return {
            profile: resolved || null,
            created: Boolean(resolved),
            reason: resolved ? 'CREATED' : 'CREATED_OUTSIDE_PERIOD'
        };
    } catch (error) {
        const resolved = await findEffectivePayrollProfileRecord(
            EmployeePayrollProfile,
            tenantId,
            employee._id,
            periodStart,
            periodEnd
        );
        if (resolved) {
            return {
                profile: resolved,
                created: false,
                reason: 'RACE_REUSED'
            };
        }
        if (options.failOnError === true) {
            throw error;
        }
        return {
            profile: null,
            created: false,
            reason: 'BACKFILL_FAILED',
            error: error.message
        };
    }
}

async function resolvePayrollProfile(db, tenantId, employeeId, periodStart, periodEnd, options = {}) {
    const EmployeePayrollProfile = getModel(db, 'EmployeePayrollProfile', EmployeePayrollProfileSchema);
    const profile = await findEffectivePayrollProfileRecord(
        EmployeePayrollProfile,
        tenantId,
        employeeId,
        periodStart,
        periodEnd
    );

    if (profile) {
        if (options.returnMeta === true) {
            return {
                profile,
                autoBackfilled: false,
                backfill: null
            };
        }
        return profile;
    }

    if (options.autoBackfill === true) {
        const backfillResult = await autoBackfillPayrollProfile(
            db,
            tenantId,
            options.employee || employeeId,
            periodStart,
            periodEnd,
            {
                userId: options.userId || null,
                failOnError: options.failOnBackfillError === true
            }
        );

        if (options.returnMeta === true) {
            return {
                profile: backfillResult.profile || null,
                autoBackfilled: backfillResult.created === true,
                backfill: backfillResult
            };
        }

        return backfillResult.profile || null;
    }

    if (options.returnMeta === true) {
        return {
            profile: null,
            autoBackfilled: false,
            backfill: null
        };
    }

    return null;
}

async function resolvePayrollProfileSegments(db, tenantId, employeeId, periodStart, periodEnd, options = {}) {
    const EmployeePayrollProfile = getModel(db, 'EmployeePayrollProfile', EmployeePayrollProfileSchema);
    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd || periodStart);

    let profiles = await EmployeePayrollProfile.find({
        tenantId,
        employeeId,
        status: { $in: ACTIVE_PROFILE_STATUSES },
        effectiveFrom: { $lte: end },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: start } }
        ]
    }).sort({ effectiveFrom: 1 }).lean();

    let backfill = null;
    let autoBackfilled = false;

    if (profiles.length === 0 && options.autoBackfill === true) {
        backfill = await autoBackfillPayrollProfile(
            db,
            tenantId,
            options.employee || employeeId,
            periodStart,
            periodEnd,
            {
                userId: options.userId || null,
                failOnError: options.failOnBackfillError === true
            }
        );
        autoBackfilled = backfill?.created === true;
        profiles = await EmployeePayrollProfile.find({
            tenantId,
            employeeId,
            status: { $in: ACTIVE_PROFILE_STATUSES },
            effectiveFrom: { $lte: end },
            $or: [
                { effectiveTo: null },
                { effectiveTo: { $exists: false } },
                { effectiveTo: { $gte: start } }
            ]
        }).sort({ effectiveFrom: 1 }).lean();
    }

    const segments = [];
    let cursor = startOfDay(start);

    for (const profile of profiles) {
        const profileStart = startOfDay(profile.effectiveFrom);
        const profileEnd = profile.effectiveTo ? endOfDay(profile.effectiveTo) : endOfDay(end);
        const segmentStart = startOfDay(new Date(Math.max(cursor.getTime(), profileStart.getTime(), start.getTime())));
        const segmentEnd = endOfDay(new Date(Math.min(profileEnd.getTime(), end.getTime())));

        if (segmentEnd < segmentStart) {
            continue;
        }

        if (cursor < segmentStart) {
            segments.push({
                profile: null,
                segmentStart: cursor,
                segmentEnd: dayBefore(segmentStart),
                isGap: true,
                source: 'DEFAULT'
            });
        }

        segments.push({
            profile,
            segmentStart,
            segmentEnd,
            isGap: false,
            source: profile.source || 'MANUAL'
        });

        cursor = dayAfter(segmentEnd);
        if (cursor > end) {
            break;
        }
    }

    if (cursor <= end) {
        segments.push({
            profile: null,
            segmentStart: cursor,
            segmentEnd: end,
            isGap: true,
            source: 'DEFAULT'
        });
    }

    if (options.returnMeta === true) {
        return {
            segments,
            autoBackfilled,
            backfill
        };
    }

    return segments;
}

async function findLegacySalarySource(db, tenantId, employee) {
    const employeeId = employee?._id || employee?.employeeId || employee;
    if (!employeeId) return null;

    try {
        const EmployeeCompensation = db.model('EmployeeCompensation');
        const compensation = await EmployeeCompensation.findOne({
            employeeId,
            isActive: true,
            status: 'ACTIVE'
        }).sort({ effectiveFrom: -1, createdAt: -1 }).lean();

        if (compensation && normalizeMoney(compensation.totalCTC) > 0) {
            return {
                source: 'EMPLOYEE_COMPENSATION',
                sourceModel: 'EmployeeCompensation',
                sourceRefId: compensation._id,
                data: compensation,
                components: normalizeComponentsFromSource(compensation),
                totalCTC: normalizeMoney(compensation.totalCTC),
                grossA: normalizeMoney(compensation.grossA),
                grossB: normalizeMoney(compensation.grossB),
                grossC: normalizeMoney(compensation.grossC),
                effectiveFrom: compensation.effectiveFrom
            };
        }
    } catch (_err) {
        // Continue through other legacy sources.
    }

    try {
        const EmployeeSalarySnapshot = db.model('EmployeeSalarySnapshot');
        let snapshot = null;

        if (employee?.currentSalarySnapshotId || employee?.salarySnapshotId) {
            snapshot = await EmployeeSalarySnapshot.findById(employee.currentSalarySnapshotId || employee.salarySnapshotId).lean();
        }

        if (!snapshot) {
            snapshot = await EmployeeSalarySnapshot.findOne({
                $or: [
                    { employee: employeeId },
                    { employeeId }
                ]
            }).sort({ effectiveFrom: -1, createdAt: -1 }).lean();
        }

        if (snapshot) {
            const components = normalizeComponentsFromSource(snapshot);
            const totals = calculateTotalsFromComponents(components);
            const totalCTC = normalizeMoney(snapshot.ctc || snapshot.totalCTC || snapshot.annualCTC || totals.totalCTC);

            if (totalCTC > 0) {
                return {
                    source: 'SALARY_SNAPSHOT',
                    sourceModel: 'EmployeeSalarySnapshot',
                    sourceRefId: snapshot._id,
                    data: snapshot,
                    components,
                    totalCTC,
                    grossA: normalizeMoney(snapshot.breakdown?.totalEarnings || snapshot.summary?.grossEarnings || totals.grossA),
                    grossB: normalizeMoney(snapshot.breakdown?.totalBenefits || snapshot.summary?.totalBenefits || totals.grossB),
                    grossC: normalizeMoney(totals.grossC),
                    effectiveFrom: snapshot.effectiveFrom || snapshot.createdAt
                };
            }
        }
    } catch (_err) {
        // Continue through applicant/global sources.
    }

    try {
        const Employee = db.model('Employee');
        const Applicant = db.model('Applicant');
        const person = employee?.email ? employee : await Employee.findById(employeeId).lean();
        const fullName = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
        const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const applicant = await Applicant.findOne({
            $or: [
                { employeeId },
                { _id: employeeId },
                ...(person?.email ? [{ email: person.email }] : []),
                ...(fullName ? [{ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } }] : [])
            ]
        }).populate('salarySnapshotId').lean();

        const snapshot = applicant?.salarySnapshotId || applicant?.salarySnapshot;
        if (snapshot) {
            const components = normalizeComponentsFromSource(snapshot);
            const totals = calculateTotalsFromComponents(components);
            const totalCTC = normalizeMoney(snapshot.ctc || snapshot.totalCTC || snapshot.annualCTC || snapshot.totals?.annualCTC || applicant?.ctc || totals.totalCTC);

            if (totalCTC > 0) {
                return {
                    source: 'SALARY_SNAPSHOT',
                    sourceModel: applicant?.salarySnapshotId ? 'EmployeeSalarySnapshot' : 'Applicant',
                    sourceRefId: snapshot._id || applicant?._id,
                    data: snapshot,
                    components,
                    totalCTC,
                    grossA: normalizeMoney(snapshot.breakdown?.totalEarnings || snapshot.summary?.grossEarnings || snapshot.totals?.grossEarnings || totals.grossA),
                    grossB: normalizeMoney(snapshot.breakdown?.totalBenefits || snapshot.summary?.totalBenefits || snapshot.totals?.employerBenefits || totals.grossB),
                    grossC: normalizeMoney(totals.grossC),
                    effectiveFrom: snapshot.effectiveFrom || snapshot.createdAt || applicant?.joiningDate || person?.joiningDate
                };
            }
        }
    } catch (_err) {
        // Continue through global salary structure.
    }

    try {
        const SalaryStructure = mongoose.models.SalaryStructure || mongoose.model('SalaryStructure');
        const structure = await SalaryStructure.findOne({
            tenantId,
            $or: [
                { employee: employeeId },
                { candidateId: employeeId }
            ],
            status: 'ACTIVE'
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();

        if (structure) {
            const components = normalizeComponentsFromSource(structure);
            const totals = calculateTotalsFromComponents(components);
            const totalCTC = normalizeMoney(structure.totals?.annualCTC || totals.totalCTC);

            if (totalCTC > 0) {
                return {
                    source: 'SALARY_STRUCTURE',
                    sourceModel: 'SalaryStructure',
                    sourceRefId: structure._id,
                    data: structure,
                    components,
                    totalCTC,
                    grossA: normalizeMoney(structure.totals?.grossEarnings || totals.grossA),
                    grossB: normalizeMoney(structure.totals?.employerBenefits || totals.grossB),
                    grossC: normalizeMoney(totals.grossC),
                    effectiveFrom: structure.effectiveFrom || structure.updatedAt || structure.createdAt
                };
            }
        }
    } catch (_err) {
        // No legacy source found.
    }

    return null;
}

function makeVersionPayload(tenantId, employee, legacySource, userId = null) {
    const effectiveFrom = startOfDay(
        legacySource?.effectiveFrom ||
        employee?.joiningDate ||
        employee?.createdAt ||
        new Date()
    );
    const temporalState = determineTemporalState(effectiveFrom, null);

    return {
        companyId: tenantId,
        employeeId: employee._id,
        version: 1,
        effectiveFrom,
        effectiveTo: null,
        grossA: normalizeMoney(legacySource.grossA),
        grossB: normalizeMoney(legacySource.grossB),
        grossC: normalizeMoney(legacySource.grossC),
        totalCTC: normalizeMoney(legacySource.totalCTC),
        components: legacySource.components || [],
        isActive: temporalState.isActive,
        status: temporalState.status,
        source: legacySource.source || 'MIGRATION',
        sourceModel: legacySource.sourceModel,
        sourceRefId: legacySource.sourceRefId,
        revisionType: 'MIGRATION',
        reason: `Migrated from ${legacySource.source || 'legacy payroll source'}`,
        settings: normalizeSettings(legacySource.data?.settings || {}),
        createdBy: userId || undefined
    };
}

function makeProfilePayload(tenantId, employee, userId = null, options = {}) {
    const location = extractEmployeeLocationDetails(employee, options.branch || null);
    const effectiveFrom = startOfDay(options.effectiveFrom || employee?.joiningDate || employee?.createdAt || new Date());
    const effectiveTo = options.effectiveTo ? endOfDay(options.effectiveTo) : null;
    const temporalState = options.status
        ? buildProfileStateFields(effectiveFrom, effectiveTo, userId, options.status)
        : buildProfileStateFields(effectiveFrom, effectiveTo, userId);

    return {
        tenantId,
        employeeId: employee._id,
        legalEntityId: options.legalEntityId || tenantId,
        branchId: options.branchId !== undefined
            ? normalizeObjectId(options.branchId)
            : location.branchId || null,
        branchName: pickFirstNonEmpty(options.branchName, location.branchName),
        workCity: pickFirstNonEmpty(options.workCity, location.city),
        workState: pickFirstNonEmpty(options.workState, location.state),
        country: pickFirstNonEmpty(options.country, location.country, 'India'),
        payrollRegion: pickFirstNonEmpty(options.payrollRegion, location.payrollRegion, location.state, location.city, 'DEFAULT'),
        effectiveFrom,
        effectiveTo,
        status: temporalState.status,
        source: options.source || 'MIGRATION',
        policyOverrides: options.policyOverrides || {},
        notes: options.notes || 'Backfilled from employee record during canonical payroll migration',
        createdBy: userId || undefined
    };
}

async function migrateEmployeeCanonicalData(db, tenantId, employee, options = {}) {
    const EmployeeCtcVersion = getModel(db, 'EmployeeCtcVersion', EmployeeCtcVersionSchema);
    const EmployeePayrollProfile = getModel(db, 'EmployeePayrollProfile', EmployeePayrollProfileSchema);
    const userId = options.userId || null;
    const dryRun = options.dryRun === true;
    const force = options.force === true;

    const result = {
        employeeId: employee._id,
        employeeCode: employee.employeeId,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        salaryVersion: 'SKIPPED',
        payrollProfile: 'SKIPPED',
        issues: []
    };

    const latestVersion = await EmployeeCtcVersion.findOne({
        companyId: tenantId,
        employeeId: employee._id
    }).sort({ version: -1 }).lean();
    const existingVersion = await EmployeeCtcVersion.findOne({
        companyId: tenantId,
        employeeId: employee._id,
        status: { $in: ACTIVE_VERSION_STATUSES }
    }).sort({ effectiveFrom: -1, version: -1 }).lean();

    if (!existingVersion || force) {
        const legacySource = await findLegacySalarySource(db, tenantId, employee);
        if (!legacySource) {
            result.salaryVersion = 'MISSING_SOURCE';
            result.issues.push('No legacy salary source found for migration');
        } else {
            const payload = makeVersionPayload(tenantId, employee, legacySource, userId);
            payload.version = latestVersion ? latestVersion.version + 1 : 1;

            if (dryRun) {
                result.salaryVersion = existingVersion && force ? 'WOULD_CREATE_NEW_VERSION' : 'WOULD_CREATE';
            } else {
                if (force) {
                    const activeVersions = await EmployeeCtcVersion.find({
                        companyId: tenantId,
                        employeeId: employee._id,
                        status: { $in: ACTIVE_VERSION_STATUSES }
                    }).select('_id effectiveFrom effectiveTo').lean();

                    await Promise.all(activeVersions.map((item) => {
                        if (startOfDay(item.effectiveFrom) < payload.effectiveFrom) {
                            return EmployeeCtcVersion.updateOne(
                                { _id: item._id },
                                { $set: buildVersionStateFields(item.effectiveFrom, dayBefore(payload.effectiveFrom), userId) }
                            );
                        }

                        return EmployeeCtcVersion.updateOne(
                            { _id: item._id },
                            { $set: buildVersionStateFields(item.effectiveFrom, item.effectiveTo || null, userId, 'INACTIVE') }
                        );
                    }));
                }

                await EmployeeCtcVersion.create(payload);
                result.salaryVersion = existingVersion && force ? 'CREATED_NEW_VERSION' : 'CREATED';
            }
        }
    }

    const existingProfile = await EmployeePayrollProfile.findOne({
        tenantId,
        employeeId: employee._id,
        status: { $in: ACTIVE_PROFILE_STATUSES }
    }).sort({ effectiveFrom: -1 }).lean();

    if (!existingProfile || force) {
        const payload = makeProfilePayload(tenantId, employee, userId);
        if (dryRun) {
            result.payrollProfile = existingProfile && force ? 'WOULD_CREATE_NEW_PROFILE' : 'WOULD_CREATE';
        } else {
            if (force) {
                const activeProfiles = await EmployeePayrollProfile.find({
                    tenantId,
                    employeeId: employee._id,
                    status: { $in: ACTIVE_PROFILE_STATUSES }
                }).select('_id effectiveFrom effectiveTo').lean();

                await Promise.all(activeProfiles.map((item) => {
                    if (startOfDay(item.effectiveFrom) < payload.effectiveFrom) {
                        return EmployeePayrollProfile.updateOne(
                            { _id: item._id },
                            { $set: buildProfileStateFields(item.effectiveFrom, dayBefore(payload.effectiveFrom), userId) }
                        );
                    }

                    return EmployeePayrollProfile.updateOne(
                        { _id: item._id },
                        { $set: buildProfileStateFields(item.effectiveFrom, item.effectiveTo || null, userId, 'INACTIVE') }
                    );
                }));
            }

            await EmployeePayrollProfile.create(payload);
            result.payrollProfile = existingProfile && force ? 'CREATED_NEW_PROFILE' : 'CREATED';
        }
    }

    return result;
}

async function migrateCanonicalPayrollData(db, tenantId, options = {}) {
    const Employee = db.model('Employee');
    const filter = {
        tenant: tenantId,
        status: { $in: ['Active', 'active', 'ACTIVE'] },
        $or: [
            { payrollLocked: { $exists: false } },
            { payrollLocked: false }
        ]
    };

    const employees = await Employee.find(filter)
        .select('firstName lastName employeeId email joiningDate createdAt bankDetails branchId branchName commAddress permAddress tempAddress currentSalarySnapshotId salarySnapshotId')
        .lean();

    const results = [];
    for (const employee of employees) {
        results.push(await migrateEmployeeCanonicalData(db, tenantId, employee, options));
    }

    return {
        dryRun: options.dryRun === true,
        totalEmployees: employees.length,
        salaryVersionsCreated: results.filter(item => item.salaryVersion === 'CREATED' || item.salaryVersion === 'CREATED_NEW_VERSION').length,
        payrollProfilesCreated: results.filter(item => item.payrollProfile === 'CREATED' || item.payrollProfile === 'CREATED_NEW_PROFILE').length,
        missingSalarySources: results.filter(item => item.salaryVersion === 'MISSING_SOURCE').length,
        results
    };
}

function pushIssue(collection, severity, code, message, extra = {}) {
    collection.push({
        severity,
        code,
        message,
        ...extra
    });
}

function detectRangeIssues(records = [], label, issues, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_VERSION_STATUSES;
    const sorted = records
        .filter(item => activeStatuses.includes(String(item.status || '').toUpperCase()))
        .sort((a, b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom));

    for (let i = 0; i < sorted.length; i += 1) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!next) continue;

        const currentEnd = current.effectiveTo ? endOfDay(current.effectiveTo) : null;
        const nextStart = startOfDay(next.effectiveFrom);

        if (!currentEnd) {
            pushIssue(issues, 'BLOCKER', `${label}_OVERLAP`, `${label.toLowerCase().replace(/_/g, ' ')} has overlapping open-ended records.`, {
                firstRecordId: current._id,
                secondRecordId: next._id
            });
            continue;
        }

        if (currentEnd >= nextStart) {
            pushIssue(issues, 'BLOCKER', `${label}_OVERLAP`, `${label.toLowerCase().replace(/_/g, ' ')} has overlapping effective dates.`, {
                firstRecordId: current._id,
                secondRecordId: next._id
            });
            continue;
        }

        const gapStart = dayAfter(currentEnd);
        if (gapStart < nextStart) {
            pushIssue(issues, 'WARNING', `${label}_GAP`, `${label.toLowerCase().replace(/_/g, ' ')} has a gap between effective-dated records.`, {
                firstRecordId: current._id,
                secondRecordId: next._id,
                gapStart,
                gapEnd: dayBefore(nextStart)
            });
        }
    }
}

function findGapCoveringPeriod(records = [], periodStart, periodEnd, activeStatuses = ACTIVE_VERSION_STATUSES) {
    const sorted = records
        .filter(item => activeStatuses.includes(String(item.status || '').toUpperCase()))
        .sort((a, b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom));

    if (sorted.length === 0) {
        return null;
    }

    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd || periodStart);

    let previous = null;
    let next = null;

    for (const record of sorted) {
        const recordStart = startOfDay(record.effectiveFrom);
        const recordEnd = record.effectiveTo ? endOfDay(record.effectiveTo) : new Date('9999-12-31T23:59:59.999Z');

        if (recordStart <= end && recordEnd >= start) {
            return null;
        }

        if (recordEnd < start) {
            previous = record;
            continue;
        }

        if (recordStart > end) {
            next = record;
            break;
        }
    }

    return {
        previousRecordId: previous?._id || null,
        nextRecordId: next?._id || null,
        gapStart: previous?.effectiveTo ? dayAfter(previous.effectiveTo) : start,
        gapEnd: next?.effectiveFrom ? dayBefore(next.effectiveFrom) : end
    };
}

async function validateEmployeePayrollData(db, tenantId, employee, periodStart, periodEnd, options = {}) {
    const EmployeeCtcVersion = getModel(db, 'EmployeeCtcVersion', EmployeeCtcVersionSchema);
    const EmployeePayrollProfile = getModel(db, 'EmployeePayrollProfile', EmployeePayrollProfileSchema);
    const employeeId = employee?._id || employee;
    const requirePayrollProfile = options.requirePayrollProfile === true;
    const autoBackfillPayrollProfile = options.autoBackfillPayrollProfile === true;
    const failOnPayrollProfileBackfillError = options.failOnPayrollProfileBackfillError === true;
    const allowLegacyFallback = options.allowLegacyFallback === true;
    const issues = [];
    const warnings = [];

    const [versions, profiles, canonicalSalary] = await Promise.all([
        EmployeeCtcVersion.find({ companyId: tenantId, employeeId }).sort({ effectiveFrom: 1, version: 1 }).lean(),
        EmployeePayrollProfile.find({ tenantId, employeeId }).sort({ effectiveFrom: 1 }).lean(),
        resolveEffectiveSalaryVersion(db, tenantId, employeeId, periodStart, periodEnd)
    ]);
    const payrollProfileResolution = await resolvePayrollProfile(
        db,
        tenantId,
        employeeId,
        periodStart,
        periodEnd,
        {
            employee,
            userId: options.userId || null,
            autoBackfill: autoBackfillPayrollProfile,
            failOnBackfillError: failOnPayrollProfileBackfillError,
            returnMeta: true
        }
    );
    const payrollProfile = payrollProfileResolution?.profile || null;

    detectRangeIssues(versions, 'SALARY_VERSION', issues, { activeStatuses: ACTIVE_VERSION_STATUSES });
    detectRangeIssues(profiles, 'PAYROLL_PROFILE', issues, { activeStatuses: ACTIVE_PROFILE_STATUSES });

    const overlappingSalaryVersions = versions.filter(version =>
        ACTIVE_VERSION_STATUSES.includes(String(version.status || '').toUpperCase()) &&
        rangesOverlap(version.effectiveFrom, version.effectiveTo, periodStart, periodEnd)
    );
    if (overlappingSalaryVersions.length > 1) {
        pushIssue(issues, 'BLOCKER', 'SALARY_VERSION_OVERLAP_FOR_PERIOD', 'More than one salary version is effective in this payroll period.', {
            recordIds: overlappingSalaryVersions.map(item => item._id)
        });
    }

    if (!canonicalSalary) {
        let legacySource = null;
        if (allowLegacyFallback) {
            legacySource = await findLegacySalarySource(db, tenantId, employee);
        }

        if (legacySource) {
            pushIssue(warnings, 'WARNING', 'LEGACY_SALARY_SOURCE_USED', `No canonical salary version found; legacy ${legacySource.source} can be migrated.`, {
                source: legacySource.source,
                sourceRefId: legacySource.sourceRefId
            });
        } else {
            const gap = findGapCoveringPeriod(versions, periodStart, periodEnd, ACTIVE_VERSION_STATUSES);
            pushIssue(issues, 'BLOCKER', 'MISSING_CANONICAL_SALARY_VERSION', 'No effective salary version found for the payroll period.', gap || {});
        }
    }

    if (payrollProfileResolution?.autoBackfilled === true) {
        pushIssue(warnings, 'WARNING', 'PAYROLL_PROFILE_AUTO_BACKFILLED', 'Payroll profile was auto-backfilled from employee location data for this period.', {
            profileId: payrollProfile?._id || null
        });
    }

    if (!payrollProfile) {
        const target = requirePayrollProfile ? issues : warnings;
        const gap = findGapCoveringPeriod(profiles, periodStart, periodEnd, ACTIVE_PROFILE_STATUSES);
        pushIssue(
            target,
            requirePayrollProfile ? 'BLOCKER' : 'WARNING',
            'MISSING_PAYROLL_PROFILE',
            'No effective employee payroll profile found for the payroll period.',
            {
                ...(gap || {}),
                autoBackfillAttempted: autoBackfillPayrollProfile,
                autoBackfillReason: payrollProfileResolution?.backfill?.reason || null
            }
        );
    }

    return {
        employeeId,
        salaryVersion: canonicalSalary ? buildSalarySourceSnapshot(canonicalSalary) : null,
        payrollProfile: buildPayrollProfileSnapshot(payrollProfile),
        issues,
        warnings,
        canCalculate: issues.length === 0
    };
}

async function createSalaryVersion(db, tenantId, employeeId, data = {}, userId = null) {
    const EmployeeCtcVersion = getModel(db, 'EmployeeCtcVersion', EmployeeCtcVersionSchema);
    const effectiveFrom = startOfDay(data.effectiveFrom || new Date());
    const effectiveTo = data.effectiveTo ? endOfDay(data.effectiveTo) : null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error('effectiveTo cannot be before effectiveFrom');
    }

    const overlapQuery = {
        companyId: tenantId,
        employeeId,
        status: { $in: ACTIVE_VERSION_STATUSES },
        effectiveFrom: { $lte: effectiveTo || new Date('9999-12-31T23:59:59.999Z') },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: effectiveFrom } }
        ]
    };
    const overlaps = await EmployeeCtcVersion.find(overlapQuery).sort({ effectiveFrom: 1 }).lean();
    if (overlaps.length > 0 && data.closePrevious !== true) {
        throw new Error('Salary version overlaps an existing effective-dated version');
    }

    if (effectiveTo) {
        const unsupportedOverlap = overlaps.find(item => {
            const overlapEnd = item.effectiveTo ? endOfDay(item.effectiveTo) : null;
            return !overlapEnd || overlapEnd > effectiveTo;
        });

        if (unsupportedOverlap) {
            throw new Error('Cannot create a bounded salary version that leaves overlapping active records after effectiveTo. Split the surrounding range first.');
        }
    }

    if (overlaps.length > 0 && data.closePrevious === true) {
        await Promise.all(overlaps.map((item) => {
            const overlapStart = startOfDay(item.effectiveFrom);

            if (overlapStart < effectiveFrom) {
                const closedEffectiveTo = dayBefore(effectiveFrom);
                return EmployeeCtcVersion.updateOne(
                    { _id: item._id },
                    { $set: buildVersionStateFields(item.effectiveFrom, closedEffectiveTo, userId) }
                );
            }

            return EmployeeCtcVersion.updateOne(
                { _id: item._id },
                { $set: buildVersionStateFields(item.effectiveFrom, item.effectiveTo || null, userId, 'INACTIVE') }
            );
        }));
    }

    const latestVersion = await EmployeeCtcVersion.findOne({ companyId: tenantId, employeeId }).sort({ version: -1 }).lean();
    const components = normalizeComponentsFromSource(data);
    const totals = calculateTotalsFromComponents(components);
    const temporalState = data.status
        ? buildVersionStateFields(effectiveFrom, effectiveTo, userId, data.status)
        : buildVersionStateFields(effectiveFrom, effectiveTo, userId);

    return EmployeeCtcVersion.create({
        companyId: tenantId,
        employeeId,
        version: latestVersion ? latestVersion.version + 1 : 1,
        effectiveFrom,
        effectiveTo,
        grossA: normalizeMoney(data.grossA || totals.grossA),
        grossB: normalizeMoney(data.grossB || totals.grossB),
        grossC: normalizeMoney(data.grossC || totals.grossC),
        totalCTC: normalizeMoney(data.totalCTC || data.annualCTC || totals.totalCTC),
        components,
        isActive: data.isActive === false ? false : temporalState.isActive,
        status: temporalState.status,
        source: data.source || 'MANUAL',
        sourceModel: data.sourceModel,
        sourceRefId: data.sourceRefId ? normalizeObjectId(data.sourceRefId) : null,
        salaryTemplateId: data.salaryTemplateId ? normalizeObjectId(data.salaryTemplateId) : null,
        revisionType: data.revisionType || 'REVISION',
        reason: data.reason,
        notes: data.notes,
        settings: normalizeSettings(data.settings || {}),
        createdBy: userId || undefined
    });
}

async function createPayrollProfile(db, tenantId, employeeId, data = {}, userId = null) {
    const EmployeePayrollProfile = getModel(db, 'EmployeePayrollProfile', EmployeePayrollProfileSchema);
    const effectiveFrom = startOfDay(data.effectiveFrom || new Date());
    const effectiveTo = data.effectiveTo ? endOfDay(data.effectiveTo) : null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error('effectiveTo cannot be before effectiveFrom');
    }

    const overlapQuery = {
        tenantId,
        employeeId,
        status: { $in: ACTIVE_PROFILE_STATUSES },
        effectiveFrom: { $lte: effectiveTo || new Date('9999-12-31T23:59:59.999Z') },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: effectiveFrom } }
        ]
    };
    const overlaps = await EmployeePayrollProfile.find(overlapQuery).sort({ effectiveFrom: 1 }).lean();
    if (overlaps.length > 0 && data.closePrevious !== true) {
        throw new Error('Payroll profile overlaps an existing effective-dated profile');
    }

    if (effectiveTo) {
        const unsupportedOverlap = overlaps.find(item => {
            const overlapEnd = item.effectiveTo ? endOfDay(item.effectiveTo) : null;
            return !overlapEnd || overlapEnd > effectiveTo;
        });

        if (unsupportedOverlap) {
            throw new Error('Cannot create a bounded payroll profile that leaves overlapping active records after effectiveTo. Split the surrounding range first.');
        }
    }

    if (overlaps.length > 0 && data.closePrevious === true) {
        await Promise.all(overlaps.map((item) => {
            const overlapStart = startOfDay(item.effectiveFrom);

            if (overlapStart < effectiveFrom) {
                const closedEffectiveTo = dayBefore(effectiveFrom);
                return EmployeePayrollProfile.updateOne(
                    { _id: item._id },
                    { $set: buildProfileStateFields(item.effectiveFrom, closedEffectiveTo, userId) }
                );
            }

            return EmployeePayrollProfile.updateOne(
                { _id: item._id },
                { $set: buildProfileStateFields(item.effectiveFrom, item.effectiveTo || null, userId, 'INACTIVE') }
            );
        }));
    }

    const temporalState = data.status
        ? buildProfileStateFields(effectiveFrom, effectiveTo, userId, data.status)
        : buildProfileStateFields(effectiveFrom, effectiveTo, userId);

    return EmployeePayrollProfile.create({
        tenantId,
        employeeId,
        legalEntityId: data.legalEntityId || tenantId,
        branchId: data.branchId ? normalizeObjectId(data.branchId) : null,
        branchName: data.branchName,
        workCity: data.workCity,
        workState: data.workState,
        country: data.country || 'India',
        payrollRegion: data.payrollRegion || data.workState || data.workCity || 'DEFAULT',
        effectiveFrom,
        effectiveTo,
        status: temporalState.status,
        source: data.source || 'MANUAL',
        policyOverrides: data.policyOverrides || {},
        notes: data.notes,
        createdBy: userId || undefined
    });
}

module.exports = {
    ACTIVE_VERSION_STATUSES,
    ACTIVE_PROFILE_STATUSES,
    buildCompensationFromVersion,
    buildPayrollProfileSnapshot,
    buildSalarySourceSnapshot,
    createPayrollProfile,
    createSalaryVersion,
    findLegacySalarySource,
    migrateCanonicalPayrollData,
    migrateEmployeeCanonicalData,
    normalizeComponentsFromSource,
    resolveEffectiveSalaryVersion,
    resolvePayrollProfile,
    resolvePayrollProfileSegments,
    validateEmployeePayrollData
};
