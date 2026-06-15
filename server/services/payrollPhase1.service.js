const crypto = require('crypto');
const CompanyPayrollRuleSchema = require('../models/CompanyPayrollRule');
const PayrollStatutoryRuleSetSchema = require('../models/PayrollStatutoryRuleSet');
const EmployeeTaxProfileSchema = require('../models/EmployeeTaxProfile');
const PayrollInputSnapshotSchema = require('../models/PayrollInputSnapshot');
const PayrollCalculationTraceSchema = require('../models/PayrollCalculationTrace');
const AttendanceSnapshotSchema = require('../models/AttendanceSnapshot');

function getModel(db, modelName, schema) {
    try {
        return db.model(modelName, schema);
    } catch (_err) {
        return db.model(modelName);
    }
}

function toPlain(doc) {
    if (!doc) return null;
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

function normalizeMoney(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
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

function isValidDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function dayBefore(value) {
    const date = startOfDay(value);
    date.setDate(date.getDate() - 1);
    return endOfDay(date);
}

function overlapsPeriod(record = {}, periodStart, periodEnd) {
    const start = startOfDay(record.effectiveFrom || periodStart);
    const end = record.effectiveTo ? endOfDay(record.effectiveTo) : null;
    const targetStart = startOfDay(periodStart);
    const targetEnd = endOfDay(periodEnd || periodStart);
    return start <= targetEnd && (!end || end >= targetStart);
}

function normalizeText(value = '') {
    return String(value || '').trim();
}

function normalizeMatchValue(value = '') {
    return normalizeText(value).toLowerCase();
}

const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z');

const STATUTORY_RULE_PRESETS = Object.freeze({
    IN_GJ_AHMEDABAD_V1: {
        key: 'IN_GJ_AHMEDABAD_V1',
        label: 'India Gujarat Ahmedabad PT Scaffold',
        revision: '1.0.0',
        description: 'Seeds Gujarat state baseline plus Ahmedabad city override with source-tracked professional tax slabs.',
        entries: [
            {
                name: 'Gujarat Professional Tax Baseline',
                code: 'PT_GJ',
                country: 'IN',
                workState: 'Gujarat',
                workCity: '',
                payrollRegion: 'Gujarat',
                professionalTax: {
                    enabled: true,
                    defaultAmount: 200,
                    slabVersion: 1,
                    slabSource: 'PRESET',
                    slabSourceReference: 'GJ_PT_PRESET_V1_BASE',
                    metadata: {
                        jurisdiction: 'Gujarat',
                        level: 'STATE'
                    },
                    slabs: [
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: '',
                            payrollRegion: 'Gujarat',
                            minIncome: 0,
                            maxIncome: 5999,
                            amount: 0,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_BASE',
                            sourceVersion: 1,
                            metadata: { level: 'STATE' }
                        },
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: '',
                            payrollRegion: 'Gujarat',
                            minIncome: 6000,
                            maxIncome: 8999,
                            amount: 80,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_BASE',
                            sourceVersion: 1,
                            metadata: { level: 'STATE' }
                        },
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: '',
                            payrollRegion: 'Gujarat',
                            minIncome: 9000,
                            maxIncome: 11999,
                            amount: 150,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_BASE',
                            sourceVersion: 1,
                            metadata: { level: 'STATE' }
                        },
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: '',
                            payrollRegion: 'Gujarat',
                            minIncome: 12000,
                            maxIncome: null,
                            amount: 200,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_BASE',
                            sourceVersion: 1,
                            metadata: { level: 'STATE' }
                        }
                    ]
                },
                notes: 'Preset scaffold for Gujarat state PT. Validate slab amounts against latest notifications before production filing.'
            },
            {
                name: 'Ahmedabad Professional Tax Override',
                code: 'PT_GJ',
                country: 'IN',
                workState: 'Gujarat',
                workCity: 'Ahmedabad',
                payrollRegion: 'Ahmedabad',
                professionalTax: {
                    enabled: true,
                    defaultAmount: 200,
                    slabVersion: 1,
                    slabSource: 'PRESET',
                    slabSourceReference: 'GJ_PT_PRESET_V1_AHMEDABAD',
                    metadata: {
                        jurisdiction: 'Ahmedabad',
                        level: 'CITY'
                    },
                    slabs: [
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: 'Ahmedabad',
                            payrollRegion: 'Ahmedabad',
                            minIncome: 0,
                            maxIncome: 11999,
                            amount: 0,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_AHMEDABAD',
                            sourceVersion: 1,
                            metadata: { level: 'CITY' }
                        },
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: 'Ahmedabad',
                            payrollRegion: 'Ahmedabad',
                            minIncome: 12000,
                            maxIncome: 14999,
                            amount: 150,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_AHMEDABAD',
                            sourceVersion: 1,
                            metadata: { level: 'CITY' }
                        },
                        {
                            country: 'IN',
                            workState: 'Gujarat',
                            workCity: 'Ahmedabad',
                            payrollRegion: 'Ahmedabad',
                            minIncome: 15000,
                            maxIncome: null,
                            amount: 200,
                            source: 'PRESET',
                            sourceReference: 'GJ_PT_PRESET_V1_AHMEDABAD',
                            sourceVersion: 1,
                            metadata: { level: 'CITY' }
                        }
                    ]
                },
                notes: 'Preset scaffold for Ahmedabad-specific PT automation. Validate city-level applicability before go-live.'
            }
        ]
    }
});

function normalizeCountry(value = 'IN') {
    const normalized = normalizeText(value || 'IN').toUpperCase();
    return normalized || 'IN';
}

function normalizeScope(scope = {}) {
    return {
        country: normalizeCountry(scope.country || 'IN'),
        workState: normalizeText(scope.workState || ''),
        workCity: normalizeText(scope.workCity || ''),
        payrollRegion: normalizeText(scope.payrollRegion || '')
    };
}

function getScopeQuery(scope = {}) {
    const normalized = normalizeScope(scope);
    return {
        country: normalized.country,
        workState: normalized.workState,
        workCity: normalized.workCity,
        payrollRegion: normalized.payrollRegion
    };
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.trunc(parsed);
}

function normalizeProfessionalTaxSlab(slab = {}, context = {}, index = 0) {
    const scope = normalizeScope({
        country: slab.country || context.scope?.country || 'IN',
        workState: slab.workState || context.scope?.workState || '',
        workCity: slab.workCity || context.scope?.workCity || '',
        payrollRegion: slab.payrollRegion || context.scope?.payrollRegion || ''
    });

    const minIncome = normalizeMoney(slab.minIncome, 0);
    const maxIncome = slab.maxIncome === null || slab.maxIncome === undefined || slab.maxIncome === ''
        ? null
        : normalizeMoney(slab.maxIncome, null);
    const amount = normalizeMoney(slab.amount, 0);
    const effectiveFrom = slab.effectiveFrom ? startOfDay(slab.effectiveFrom) : null;
    const effectiveTo = slab.effectiveTo ? endOfDay(slab.effectiveTo) : null;

    if (maxIncome !== null && maxIncome < minIncome) {
        throw new Error(`Professional tax slab ${index + 1} has maxIncome lower than minIncome`);
    }
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error(`Professional tax slab ${index + 1} has effectiveTo before effectiveFrom`);
    }

    return {
        ...slab,
        ...scope,
        minIncome,
        maxIncome,
        amount,
        displayOrder: Number.isFinite(Number(slab.displayOrder)) ? Number(slab.displayOrder) : index,
        effectiveFrom,
        effectiveTo,
        source: normalizeText(slab.source || context.defaultSlabSource || 'MANUAL').toUpperCase(),
        sourceReference: normalizeText(slab.sourceReference || ''),
        sourceUrl: normalizeText(slab.sourceUrl || ''),
        sourceVersion: normalizePositiveInteger(slab.sourceVersion, 1),
        ruleVersion: normalizePositiveInteger(slab.ruleVersion, context.ruleVersion || 1),
        metadata: slab.metadata && typeof slab.metadata === 'object' ? slab.metadata : {}
    };
}

function normalizeProfessionalTaxConfiguration(professionalTax = {}, context = {}) {
    const defaultSlabSource = normalizeText(
        professionalTax.slabSource || context.defaultSource || 'MANUAL'
    ).toUpperCase();

    const slabs = Array.isArray(professionalTax.slabs)
        ? professionalTax.slabs.map((slab, index) => normalizeProfessionalTaxSlab(slab, {
            scope: context.scope || {},
            defaultSlabSource,
            ruleVersion: context.ruleVersion || 1
        }, index))
        : [];

    slabs.sort((left, right) => {
        const leftOrder = Number(left.displayOrder || 0);
        const rightOrder = Number(right.displayOrder || 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        const leftMin = Number(left.minIncome || 0);
        const rightMin = Number(right.minIncome || 0);
        if (leftMin !== rightMin) return leftMin - rightMin;
        const leftMax = left.maxIncome === null || left.maxIncome === undefined ? Number.POSITIVE_INFINITY : Number(left.maxIncome);
        const rightMax = right.maxIncome === null || right.maxIncome === undefined ? Number.POSITIVE_INFINITY : Number(right.maxIncome);
        return leftMax - rightMax;
    });

    return {
        ...professionalTax,
        enabled: professionalTax.enabled !== false,
        defaultAmount: normalizeMoney(professionalTax.defaultAmount, 200),
        slabVersion: normalizePositiveInteger(professionalTax.slabVersion, 1),
        slabSource: defaultSlabSource,
        slabSourceReference: normalizeText(professionalTax.slabSourceReference || ''),
        slabSourceUrl: normalizeText(professionalTax.slabSourceUrl || ''),
        metadata: professionalTax.metadata && typeof professionalTax.metadata === 'object' ? professionalTax.metadata : {},
        slabs
    };
}

function normalizePresetInfo(preset = {}) {
    if (!preset || typeof preset !== 'object') return null;
    const key = normalizeText(preset.key || '').toUpperCase();
    if (!key) return null;

    return {
        key,
        label: normalizeText(preset.label || ''),
        revision: normalizeText(preset.revision || ''),
        seededAt: preset.seededAt ? new Date(preset.seededAt) : new Date()
    };
}

function compareRuleCandidates(left, right) {
    if (right.score !== left.score) return right.score - left.score;

    const rightFrom = new Date(right.ruleSet.effectiveFrom || 0).getTime();
    const leftFrom = new Date(left.ruleSet.effectiveFrom || 0).getTime();
    if (rightFrom !== leftFrom) return rightFrom - leftFrom;

    const rightVersion = Number(right.ruleSet.version || 0);
    const leftVersion = Number(left.ruleSet.version || 0);
    if (rightVersion !== leftVersion) return rightVersion - leftVersion;

    const rightUpdated = new Date(right.ruleSet.updatedAt || 0).getTime();
    const leftUpdated = new Date(left.ruleSet.updatedAt || 0).getTime();
    if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated;

    const rightCreated = new Date(right.ruleSet.createdAt || 0).getTime();
    const leftCreated = new Date(left.ruleSet.createdAt || 0).getTime();
    if (rightCreated !== leftCreated) return rightCreated - leftCreated;

    return String(right.ruleSet._id || '').localeCompare(String(left.ruleSet._id || ''));
}

function getStatutoryRulePresetCatalog() {
    return Object.values(STATUTORY_RULE_PRESETS).map((preset) => ({
        key: preset.key,
        label: preset.label,
        revision: preset.revision,
        description: preset.description,
        entryCount: Array.isArray(preset.entries) ? preset.entries.length : 0
    }));
}

function formatPeriodKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function buildFinancialYearLabel(referenceDate = new Date()) {
    const date = new Date(referenceDate);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    if (month >= 4) {
        return `FY${year}-${String(year + 1).slice(-2)}`;
    }
    return `FY${year - 1}-${String(year).slice(-2)}`;
}

function normalizeTraceMessages(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
            const code = item.code ? `[${item.code}] ` : '';
            return `${code}${item.message || JSON.stringify(item)}`;
        }
        return String(item);
    });
}

function buildDefaultStatutoryRuleData(tenantId, companyRules = null) {
    const rules = toPlain(companyRules) || {};
    return {
        tenantId,
        name: 'Default Payroll Statutory Rules',
        code: 'DEFAULT',
        version: 1,
        effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
        effectiveTo: null,
        status: 'ACTIVE',
        source: rules._id ? 'COMPANY_PAYROLL_RULE' : 'SYSTEM',
        country: 'IN',
        workState: '',
        workCity: '',
        payrollRegion: '',
        pf: {
            enabled: rules.pf?.enabled !== false,
            employeeRate: normalizeMoney(rules.pf?.employeeRate, 12),
            employerRate: normalizeMoney(rules.pf?.employerRate, 12),
            wageCeiling: normalizeMoney(rules.pf?.wageCeiling, 15000),
            capContribution: rules.pf?.capContribution !== false,
            includeInCTC: rules.pf?.includeInCTC !== false
        },
        esi: {
            enabled: rules.esic?.enabled !== false,
            employeeRate: normalizeMoney(rules.esic?.employeeRate, 0.75),
            employerRate: normalizeMoney(rules.esic?.employerRate, 3.25),
            wageCeiling: normalizeMoney(rules.esic?.wageCeiling, 21000),
            includeInCTC: rules.esic?.includeInCTC !== false
        },
        gratuity: {
            enabled: true,
            employerRate: 4.81
        },
        professionalTax: {
            enabled: rules.professionalTax?.enabled !== false,
            defaultAmount: normalizeMoney(rules.professionalTax?.defaultAmount, 200),
            slabVersion: 1,
            slabSource: rules._id ? 'COMPANY_PAYROLL_RULE' : 'SYSTEM',
            slabSourceReference: rules._id ? `COMPANY_PAYROLL_RULE:${rules._id}` : '',
            slabSourceUrl: '',
            metadata: {},
            slabs: []
        },
        incomeTax: {
            enabled: true,
            useEnhancedComputation: false,
            standardDeduction: 0,
            cessRate: 4,
            rebateLimit: 500000,
            rebateAmount: 12500,
            regimes: {
                old: [
                    { minIncome: 0, maxIncome: 250000, rate: 0 },
                    { minIncome: 250000, maxIncome: 500000, rate: 5 },
                    { minIncome: 500000, maxIncome: 1000000, rate: 20 },
                    { minIncome: 1000000, maxIncome: null, rate: 30 }
                ],
                new: [
                    { minIncome: 0, maxIncome: 250000, rate: 0 },
                    { minIncome: 250000, maxIncome: 500000, rate: 5 },
                    { minIncome: 500000, maxIncome: 1000000, rate: 20 },
                    { minIncome: 1000000, maxIncome: null, rate: 30 }
                ]
            }
        },
        notes: rules._id ? 'Generated from current company payroll rules for backward-compatible rollout.' : 'System fallback statutory rule set.'
    };
}

function scoreRuleSet(ruleSet = {}, payrollProfile = null) {
    const profile = {
        country: normalizeMatchValue(normalizeCountry(payrollProfile?.country || 'IN')),
        workState: normalizeMatchValue(payrollProfile?.workState),
        workCity: normalizeMatchValue(payrollProfile?.workCity),
        payrollRegion: normalizeMatchValue(payrollProfile?.payrollRegion)
    };
    const rule = {
        country: normalizeMatchValue(normalizeCountry(ruleSet.country || 'IN')),
        workState: normalizeMatchValue(ruleSet.workState),
        workCity: normalizeMatchValue(ruleSet.workCity),
        payrollRegion: normalizeMatchValue(ruleSet.payrollRegion)
    };

    let score = 0;

    if (rule.country) {
        if (rule.country !== profile.country) return -1;
        score += 10;
    }

    if (rule.workState) {
        if (rule.workState !== profile.workState) return -1;
        score += 100;
    }

    if (rule.workCity) {
        if (rule.workCity !== profile.workCity) return -1;
        score += 60;
    }

    if (rule.payrollRegion) {
        if (rule.payrollRegion !== profile.payrollRegion) return -1;
        score += 25;
    }

    return score;
}

async function resolveStatutoryRuleSet(db, tenantId, periodStart, periodEnd, payrollProfile = null, options = {}) {
    const PayrollStatutoryRuleSet = getModel(db, 'PayrollStatutoryRuleSet', PayrollStatutoryRuleSetSchema);
    const CompanyPayrollRule = getModel(db, 'CompanyPayrollRule', CompanyPayrollRuleSchema);
    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd || periodStart);
    const referenceDate = options.referenceDate ? startOfDay(options.referenceDate) : end;

    const dateScopedCandidates = await PayrollStatutoryRuleSet.find({
        tenantId,
        status: { $in: ['ACTIVE', 'SCHEDULED'] },
        effectiveFrom: { $lte: referenceDate },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: referenceDate } }
        ]
    }).lean();

    let matching = dateScopedCandidates
        .map((ruleSet) => ({ ruleSet, score: scoreRuleSet(ruleSet, payrollProfile) }))
        .filter((entry) => entry.score >= 0)
        .sort(compareRuleCandidates);

    if (matching.length === 0) {
        const overlapCandidates = await PayrollStatutoryRuleSet.find({
            tenantId,
            status: { $in: ['ACTIVE', 'SCHEDULED'] },
            effectiveFrom: { $lte: end },
            $or: [
                { effectiveTo: null },
                { effectiveTo: { $exists: false } },
                { effectiveTo: { $gte: start } }
            ]
        }).lean();

        matching = overlapCandidates
            .map((ruleSet) => ({ ruleSet, score: scoreRuleSet(ruleSet, payrollProfile) }))
            .filter((entry) => entry.score >= 0)
            .sort(compareRuleCandidates);
    }

    if (matching.length > 0) {
        return matching[0].ruleSet;
    }

    const companyRules = await CompanyPayrollRule.findOne({ tenantId: String(tenantId) }).lean();
    const fallback = buildDefaultStatutoryRuleData(tenantId, companyRules);

    if (options.createIfMissing === true) {
        const created = await PayrollStatutoryRuleSet.create(fallback);
        return created.toObject();
    }

    return fallback;
}

function buildStatutoryRuleSnapshot(ruleSet) {
    const plain = toPlain(ruleSet);
    if (!plain) return null;
    return {
        ruleSetId: plain._id || null,
        name: plain.name,
        code: plain.code,
        version: plain.version || 1,
        effectiveFrom: plain.effectiveFrom || null,
        effectiveTo: plain.effectiveTo || null,
        source: plain.source || 'SYSTEM',
        country: plain.country || 'IN',
        workState: plain.workState || '',
        workCity: plain.workCity || '',
        payrollRegion: plain.payrollRegion || '',
        pf: plain.pf || {},
        esi: plain.esi || {},
        gratuity: plain.gratuity || {},
        professionalTax: normalizeProfessionalTaxConfiguration(plain.professionalTax || {}, {
            scope: normalizeScope(plain),
            defaultSource: plain.source || 'SYSTEM',
            ruleVersion: normalizePositiveInteger(plain.version, 1)
        }),
        incomeTax: {
            enabled: plain.incomeTax?.enabled !== false,
            useEnhancedComputation: plain.incomeTax?.useEnhancedComputation === true,
            standardDeduction: normalizeMoney(plain.incomeTax?.standardDeduction, 0),
            cessRate: normalizeMoney(plain.incomeTax?.cessRate, 4),
            rebateLimit: normalizeMoney(plain.incomeTax?.rebateLimit, 500000),
            rebateAmount: normalizeMoney(plain.incomeTax?.rebateAmount, 12500),
            regimes: plain.incomeTax?.regimes || {}
        },
        preset: plain.preset || null
    };
}

async function createStatutoryRuleSet(db, tenantId, data = {}, userId = null) {
    const PayrollStatutoryRuleSet = getModel(db, 'PayrollStatutoryRuleSet', PayrollStatutoryRuleSetSchema);
    const effectiveFrom = startOfDay(data.effectiveFrom || new Date());
    const effectiveTo = data.effectiveTo ? endOfDay(data.effectiveTo) : null;
    const code = normalizeText(data.code || 'DEFAULT').toUpperCase();
    const scope = getScopeQuery(data);
    const closePrevious = data.closePrevious === true;

    if (!isValidDate(effectiveFrom)) {
        throw new Error('Statutory rule set effectiveFrom is invalid');
    }
    if (data.effectiveTo && !isValidDate(effectiveTo)) {
        throw new Error('Statutory rule set effectiveTo is invalid');
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error('Statutory rule set effectiveTo cannot be before effectiveFrom');
    }
    if (!code) {
        throw new Error('Statutory rule set code is required');
    }

    const overlapEnd = effectiveTo || FAR_FUTURE;

    const overlaps = await PayrollStatutoryRuleSet.find({
        tenantId,
        code,
        ...scope,
        status: { $in: ['ACTIVE', 'SCHEDULED'] },
        effectiveFrom: { $lte: overlapEnd },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: effectiveFrom } }
        ]
    }).lean();

    if (overlaps.length > 0 && !closePrevious) {
        throw new Error('Statutory rule set overlaps an existing effective-dated rule set');
    }

    if (overlaps.length > 0 && closePrevious) {
        await Promise.all(overlaps.map((item) => {
            const overlapStart = startOfDay(item.effectiveFrom || effectiveFrom);
            if (overlapStart < effectiveFrom) {
                return PayrollStatutoryRuleSet.updateOne(
                    { _id: item._id },
                    {
                        $set: {
                            effectiveTo: dayBefore(effectiveFrom),
                            status: 'EXPIRED',
                            updatedBy: userId || undefined
                        }
                    }
                );
            }
            return PayrollStatutoryRuleSet.updateOne(
                { _id: item._id },
                {
                    $set: {
                        status: 'INACTIVE',
                        updatedBy: userId || undefined
                    }
                }
            );
        }));
    }

    const latest = await PayrollStatutoryRuleSet.findOne({ tenantId, code, ...scope }).sort({ version: -1 }).select('version').lean();
    const defaultRuleData = buildDefaultStatutoryRuleData(tenantId);
    const source = normalizeText(data.source || (data.preset?.key ? 'PRESET' : defaultRuleData.source)).toUpperCase();
    const version = (latest?.version || 0) + 1;
    const payload = {
        ...defaultRuleData,
        ...data,
        code,
        tenantId,
        version,
        source: source || defaultRuleData.source,
        ...scope,
        status: normalizeText(data.status || defaultRuleData.status || 'ACTIVE').toUpperCase(),
        effectiveFrom,
        effectiveTo,
        pf: {
            ...defaultRuleData.pf,
            ...(data.pf || {})
        },
        esi: {
            ...defaultRuleData.esi,
            ...(data.esi || {})
        },
        gratuity: {
            ...defaultRuleData.gratuity,
            ...(data.gratuity || {})
        },
        professionalTax: normalizeProfessionalTaxConfiguration(
            {
                ...defaultRuleData.professionalTax,
                ...(data.professionalTax || {})
            },
            {
                scope,
                defaultSource: source || defaultRuleData.source,
                ruleVersion: version
            }
        ),
        incomeTax: {
            ...defaultRuleData.incomeTax,
            ...(data.incomeTax || {}),
            regimes: {
                ...(defaultRuleData.incomeTax?.regimes || {}),
                ...(data.incomeTax?.regimes || {})
            }
        },
        preset: normalizePresetInfo(data.preset) || undefined,
        createdBy: userId || undefined
    };
    delete payload.closePrevious;
    delete payload.presetKey;
    delete payload.seedPreset;

    const created = await PayrollStatutoryRuleSet.create(payload);
    return created.toObject();
}

function getStatutoryRulePresetDefinition(presetKey = '') {
    const normalizedKey = normalizeText(presetKey).toUpperCase();
    if (!normalizedKey) return null;
    return STATUTORY_RULE_PRESETS[normalizedKey] || null;
}

async function seedStatutoryRulePreset(db, tenantId, presetKey, options = {}, userId = null) {
    const preset = getStatutoryRulePresetDefinition(presetKey || options.presetKey);
    if (!preset) {
        throw new Error(`Unsupported statutory preset: ${presetKey || options.presetKey || ''}`);
    }

    const effectiveFrom = startOfDay(options.effectiveFrom || new Date());
    const effectiveTo = options.effectiveTo ? endOfDay(options.effectiveTo) : null;
    const closePrevious = options.closePrevious !== false;

    if (!isValidDate(effectiveFrom)) {
        throw new Error('Preset effectiveFrom is invalid');
    }
    if (options.effectiveTo && !isValidDate(effectiveTo)) {
        throw new Error('Preset effectiveTo is invalid');
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error('Preset effectiveTo cannot be before effectiveFrom');
    }

    const seededRules = [];
    for (const entry of preset.entries || []) {
        const ruleData = {
            ...entry,
            effectiveFrom,
            effectiveTo,
            closePrevious,
            source: 'PRESET',
            status: normalizeText(options.status || entry.status || 'ACTIVE').toUpperCase(),
            preset: {
                key: preset.key,
                label: preset.label,
                revision: preset.revision,
                seededAt: new Date()
            }
        };

        if (options.notes) {
            ruleData.notes = [entry.notes, normalizeText(options.notes)].filter(Boolean).join(' ');
        }

        const created = await createStatutoryRuleSet(db, tenantId, ruleData, userId);
        seededRules.push(created);
    }

    return {
        preset: {
            key: preset.key,
            label: preset.label,
            revision: preset.revision,
            description: preset.description
        },
        seededAt: new Date(),
        effectiveFrom,
        effectiveTo,
        closePrevious,
        createdCount: seededRules.length,
        rules: seededRules
    };
}

async function resolveEmployeeTaxProfile(db, tenantId, employeeId, periodStart, periodEnd) {
    const EmployeeTaxProfile = getModel(db, 'EmployeeTaxProfile', EmployeeTaxProfileSchema);
    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd || periodStart);

    return EmployeeTaxProfile.findOne({
        tenantId,
        employeeId,
        status: { $in: ['ACTIVE', 'SCHEDULED'] },
        effectiveFrom: { $lte: end },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: start } }
        ]
    }).sort({ effectiveFrom: -1, createdAt: -1 }).lean();
}

function buildTaxProfileSnapshot(profile, referenceDate = new Date()) {
    const plain = toPlain(profile);
    if (!plain) {
        return {
            profileId: null,
            regime: 'NEW',
            financialYearLabel: buildFinancialYearLabel(referenceDate),
            declarations: {},
            projections: {},
            overrides: {},
            proofStatus: 'NOT_SUBMITTED',
            synthetic: true
        };
    }

    return {
        profileId: plain._id || null,
        regime: plain.regime || 'NEW',
        financialYearLabel: plain.financialYearLabel || buildFinancialYearLabel(referenceDate),
        effectiveFrom: plain.effectiveFrom || null,
        effectiveTo: plain.effectiveTo || null,
        declarations: plain.declarations || {},
        projections: plain.projections || {},
        overrides: plain.overrides || {},
        proofStatus: plain.proofStatus || 'NOT_SUBMITTED',
        synthetic: false
    };
}

async function createEmployeeTaxProfile(db, tenantId, employeeId, data = {}, userId = null) {
    const EmployeeTaxProfile = getModel(db, 'EmployeeTaxProfile', EmployeeTaxProfileSchema);
    const effectiveFrom = startOfDay(data.effectiveFrom || new Date());
    const effectiveTo = data.effectiveTo ? endOfDay(data.effectiveTo) : null;

    const overlaps = await EmployeeTaxProfile.find({
        tenantId,
        employeeId,
        status: { $in: ['ACTIVE', 'SCHEDULED'] },
        effectiveFrom: { $lte: effectiveTo || new Date('9999-12-31T00:00:00.000Z') },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: effectiveFrom } }
        ]
    }).lean();

    if (overlaps.length > 0 && data.closePrevious !== true) {
        throw new Error('Employee tax profile overlaps an existing effective-dated tax profile');
    }

    if (overlaps.length > 0 && data.closePrevious === true) {
        await Promise.all(overlaps.map((item) => EmployeeTaxProfile.updateOne(
            { _id: item._id },
            {
                $set: {
                    effectiveTo: dayBefore(effectiveFrom),
                    status: 'EXPIRED',
                    updatedBy: userId || undefined
                }
            }
        )));
    }

    const created = await EmployeeTaxProfile.create({
        tenantId,
        employeeId,
        effectiveFrom,
        effectiveTo,
        status: 'ACTIVE',
        regime: data.regime || 'NEW',
        financialYearLabel: data.financialYearLabel || buildFinancialYearLabel(effectiveFrom),
        declarations: data.declarations || {},
        projections: data.projections || {},
        overrides: data.overrides || {},
        proofStatus: data.proofStatus || 'NOT_SUBMITTED',
        notes: data.notes,
        createdBy: userId || undefined
    });

    return created.toObject();
}

async function createAttendanceSnapshot(db, tenantId, employeeId, month, year, attendanceSummary = {}) {
    const AttendanceSnapshot = getModel(db, 'AttendanceSnapshot', AttendanceSnapshotSchema);
    const period = formatPeriodKey(year, month);
    const payload = {
        employee: employeeId,
        tenant: tenantId,
        period,
        totalDays: Number(attendanceSummary.totalDays || 0),
        presentDays: Number(attendanceSummary.presentDays || 0),
        absentDays: Math.max(0, Number(attendanceSummary.totalDays || 0) - Number(attendanceSummary.presentDays || 0)),
        leaveDays: Number(attendanceSummary.leaveDays || 0),
        holidays: Number(attendanceSummary.holidayDays || 0),
        weeklyOffs: Number(attendanceSummary.weeklyOffDays || 0),
        lateMarks: Number(attendanceSummary.lateMarks || 0),
        halfDays: Number(attendanceSummary.halfDays || 0)
    };

    return AttendanceSnapshot.findOneAndUpdate(
        { employee: employeeId, period },
        { $set: payload },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
}

function buildInputHash(payload = {}) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function buildVarianceSnapshot(db, tenantId, employeeId, month, year, currentTotals = {}) {
    const Payslip = getModel(db, 'Payslip');
    const currentPeriodValue = year * 100 + month;
    const previousPayslip = await Payslip.findOne({
        tenantId,
        employeeId,
        status: { $ne: 'SUPERSEDED' }
    }).sort({ year: -1, month: -1 }).lean();

    if (!previousPayslip) {
        return {
            hasPrevious: false,
            changed: false
        };
    }

    const previousPeriodValue = (previousPayslip.year || 0) * 100 + (previousPayslip.month || 0);
    if (previousPeriodValue >= currentPeriodValue) {
        return {
            hasPrevious: false,
            changed: false
        };
    }

    const grossDelta = normalizeMoney((currentTotals.grossEarnings || 0) - (previousPayslip.grossEarnings || 0));
    const netDelta = normalizeMoney((currentTotals.netPay || 0) - (previousPayslip.netPay || 0));
    const taxDelta = normalizeMoney((currentTotals.incomeTax || 0) - (previousPayslip.incomeTax || 0));

    return {
        hasPrevious: true,
        previousPayslipId: previousPayslip._id,
        previousMonth: previousPayslip.month,
        previousYear: previousPayslip.year,
        grossDelta,
        netDelta,
        incomeTaxDelta: taxDelta,
        changed: grossDelta !== 0 || netDelta !== 0 || taxDelta !== 0
    };
}

async function persistPayrollArtifacts(db, payload = {}, options = {}) {
    const PayrollInputSnapshot = getModel(db, 'PayrollInputSnapshot', PayrollInputSnapshotSchema);
    const PayrollCalculationTrace = getModel(db, 'PayrollCalculationTrace', PayrollCalculationTraceSchema);
    const mode = options.mode || 'RUN';

    const attendanceSnapshot = await createAttendanceSnapshot(
        db,
        payload.tenantId,
        payload.employeeId,
        payload.month,
        payload.year,
        payload.attendanceSummary || {}
    );

    const inputSnapshot = await PayrollInputSnapshot.create({
        tenantId: payload.tenantId,
        payrollRunId: payload.payrollRunId || null,
        employeeId: payload.employeeId,
        month: payload.month,
        year: payload.year,
        mode,
        inputHash: buildInputHash({
            salarySourceSnapshot: payload.salarySourceSnapshot,
            payrollProfileSnapshot: payload.payrollProfileSnapshot,
            locationPolicySnapshot: payload.locationPolicySnapshot,
            statutoryRuleSnapshot: payload.statutoryRuleSnapshot,
            taxProfileSnapshot: payload.taxProfileSnapshot,
            attendanceSummary: payload.attendanceSummary,
            deductions: payload.deductions,
            adjustments: payload.adjustments,
            phase2Snapshot: payload.phase2Snapshot,
            runMetadata: payload.runMetadata
        }),
        salarySourceSnapshot: payload.salarySourceSnapshot || null,
        payrollProfileSnapshot: payload.payrollProfileSnapshot || null,
        locationPolicySnapshot: payload.locationPolicySnapshot || null,
        statutoryRuleSnapshot: payload.statutoryRuleSnapshot || null,
        taxProfileSnapshot: payload.taxProfileSnapshot || null,
        attendanceSnapshotId: attendanceSnapshot?._id || null,
        attendanceSummary: payload.attendanceSummary || {},
        attendanceRecordCount: payload.attendanceRecordCount || 0,
        deductions: payload.deductions || {},
        adjustments: payload.adjustments || [],
        inputBatchIds: payload.phase2Snapshot?.inputBatchIds || [],
        phase2Snapshot: payload.phase2Snapshot || {},
        runMetadata: payload.runMetadata || {},
        warnings: normalizeTraceMessages(payload.warnings || []),
        generatedBy: options.userId || null
    });

    const calculationTrace = await PayrollCalculationTrace.create({
        tenantId: payload.tenantId,
        payrollRunId: payload.payrollRunId || null,
        employeeId: payload.employeeId,
        month: payload.month,
        year: payload.year,
        inputSnapshotId: inputSnapshot._id,
        mode,
        steps: payload.traceSteps || [],
        summary: payload.summary || {},
        warnings: normalizeTraceMessages(payload.warnings || []),
        errors: normalizeTraceMessages(payload.errors || []),
        generatedBy: options.userId || null
    });

    return {
        attendanceSnapshot,
        inputSnapshot,
        calculationTrace
    };
}

async function attachPayslipToTrace(db, calculationTraceId, payslipId) {
    if (!calculationTraceId || !payslipId) return;
    const PayrollCalculationTrace = getModel(db, 'PayrollCalculationTrace', PayrollCalculationTraceSchema);
    await PayrollCalculationTrace.updateOne(
        { _id: calculationTraceId },
        { $set: { payslipId } }
    );
}

module.exports = {
    attachPayslipToTrace,
    buildFinancialYearLabel,
    buildStatutoryRuleSnapshot,
    buildTaxProfileSnapshot,
    buildVarianceSnapshot,
    createEmployeeTaxProfile,
    createStatutoryRuleSet,
    getStatutoryRulePresetCatalog,
    persistPayrollArtifacts,
    resolveEmployeeTaxProfile,
    resolveStatutoryRuleSet,
    seedStatutoryRulePreset
};
