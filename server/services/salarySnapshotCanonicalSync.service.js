const canonicalPayroll = require('./canonicalPayroll.service');

function normalizeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function objectId(value) {
    if (!value) return null;
    return value._id || value;
}

function normalizeLocation(snapshot = {}) {
    const context = snapshot.payrollContext || {};
    const location = context.locationContext || {};
    const policy = context.locationPolicySnapshot || {};

    return {
        legalEntityId: location.legalEntityId || policy.legalEntityId || null,
        branchId: location.branchId || policy.branchId || null,
        branchName: location.branchName || '',
        workCity: location.workCity || location.city || policy.workCity || '',
        workState: location.workState || location.state || policy.workState || '',
        country: location.country || policy.country || 'India',
        payrollRegion: location.payrollRegion || policy.payrollRegion || location.workState || location.state || location.workCity || location.city || 'DEFAULT',
        policyOverrides: location.policyOverrides || {}
    };
}

function snapshotComponentToCanonical(item = {}, type) {
    return {
        name: item.name,
        code: item.code,
        monthlyAmount: normalizeMoney(item.monthlyAmount ?? item.monthly ?? 0),
        annualAmount: normalizeMoney(item.yearlyAmount ?? item.yearly ?? 0),
        type,
        isTaxable: item.isTaxable !== false,
        isProRata: item.isProRata !== false,
        category: item.category,
        amountType: item.calculationType,
        calculationBase: item.basedOn,
        amountValue: normalizeMoney(item.value || 0),
        percentage: item.calculationType && String(item.calculationType).toUpperCase().includes('PERCENT')
            ? normalizeMoney(item.value || 0)
            : undefined,
        enabled: item.enabled !== false
    };
}

function buildCanonicalComponents(snapshot = {}) {
    return [
        ...(snapshot.earnings || []).map(item => snapshotComponentToCanonical(item, 'EARNING')),
        ...(snapshot.employeeDeductions || []).map(item => snapshotComponentToCanonical(item, 'DEDUCTION')),
        ...(snapshot.benefits || []).map(item => snapshotComponentToCanonical(item, 'BENEFIT'))
    ];
}

async function loadSnapshot(db, snapshotOrId) {
    if (!snapshotOrId) return null;
    if (snapshotOrId.toObject || snapshotOrId.ctc !== undefined) return snapshotOrId;
    const Snapshot = db.model('EmployeeSalarySnapshot');
    return Snapshot.findById(snapshotOrId);
}

async function syncCanonicalPayrollFromSnapshot(db, tenantId, employeeId, snapshotOrId, userId = null, options = {}) {
    if (!db || !tenantId || !employeeId || !snapshotOrId) {
        return { skipped: true, reason: 'MISSING_REQUIRED_CONTEXT' };
    }

    const snapshot = await loadSnapshot(db, snapshotOrId);
    if (!snapshot) return { skipped: true, reason: 'SNAPSHOT_NOT_FOUND' };

    const effectiveFrom = options.effectiveFrom || snapshot.effectiveFrom || new Date();
    const components = buildCanonicalComponents(snapshot);
    const salaryVersion = await canonicalPayroll.createSalaryVersion(
        db,
        tenantId,
        objectId(employeeId),
        {
            effectiveFrom,
            totalCTC: snapshot.ctc || 0,
            monthlyCTC: snapshot.monthlyCTC || ((snapshot.ctc || 0) / 12),
            components,
            source: 'SALARY_SNAPSHOT',
            sourceModel: 'EmployeeSalarySnapshot',
            sourceRefId: snapshot._id,
            revisionType: 'INITIAL',
            reason: options.reason || 'Salary structure finalized and synced to canonical payroll',
            closePrevious: true
        },
        userId
    );

    const location = normalizeLocation(snapshot);
    let payrollProfile = null;
    if (location.workCity || location.workState || location.payrollRegion) {
        payrollProfile = await canonicalPayroll.createPayrollProfile(
            db,
            tenantId,
            objectId(employeeId),
            {
                ...location,
                effectiveFrom,
                legalEntityId: location.legalEntityId || tenantId,
                source: 'SYSTEM',
                closePrevious: true,
                notes: options.profileNotes || 'Created from finalized salary structure payroll location'
            },
            userId
        );
    }

    return {
        skipped: false,
        salaryVersion,
        payrollProfile
    };
}

module.exports = {
    buildCanonicalComponents,
    syncCanonicalPayrollFromSnapshot
};
