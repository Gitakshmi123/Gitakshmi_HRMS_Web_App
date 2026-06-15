const mongoose = require('mongoose');
const CompanyPayrollRuleSchema = require('../models/CompanyPayrollRule');

const DEFAULT_RULES = Object.freeze({
    basicSalary: { percentageOfCTC: 40, enabled: true },
    hra: { percentageOfBasic: 40, enabled: true },
    conveyance: { type: 'FIXED', value: 1600, enabled: true },
    medical: { type: 'FIXED', value: 1250, enabled: true },
    pf: {
        enabled: true,
        employeeRate: 12,
        employerRate: 12,
        wageCeiling: 15000,
        capContribution: true,
        includeInCTC: true
    },
    esic: {
        enabled: true,
        employeeRate: 0.75,
        employerRate: 3.25,
        wageCeiling: 21000,
        includeInCTC: true
    },
    professionalTax: {
        enabled: true,
        defaultAmount: 200
    },
    locationPolicies: []
});

function getModel(db, modelName, schema) {
    try {
        return db.model(modelName, schema);
    } catch (_err) {
        return db.model(modelName);
    }
}

function cloneDefaultRules() {
    return JSON.parse(JSON.stringify(DEFAULT_RULES));
}

function normalizeText(value = '') {
    return String(value || '').trim();
}

function normalizeMatchValue(value = '') {
    return normalizeText(value).toLowerCase();
}

function normalizeObjectIdString(value = null) {
    if (!value) return '';
    if (value instanceof mongoose.Types.ObjectId) return String(value);
    const raw = String(value).trim();
    return raw || '';
}

function normalizeNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalBoolean(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    return fallback;
}

function normalizeDayList(values = []) {
    const source = Array.isArray(values) ? values : [];
    return [...new Set(source
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))]
        .sort((left, right) => left - right);
}

function sanitizeAllowanceSection(input = {}, defaults = {}) {
    return {
        type: String(input.type || defaults.type || 'FIXED').trim().toUpperCase() === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
        value: normalizeNumber(input.value, defaults.value || 0),
        enabled: input.enabled !== undefined ? input.enabled === true : defaults.enabled !== false
    };
}

function sanitizeLocationPolicy(policy = {}, index = 0) {
    const payrollRegion = normalizeText(policy.payrollRegion);
    const workState = normalizeText(policy.workState);
    const workCity = normalizeText(policy.workCity);
    const legalEntityId = normalizeObjectIdString(policy.legalEntityId || null);
    const branchIds = Array.isArray(policy.branchIds)
        ? [...new Set(policy.branchIds.map((branchId) => normalizeObjectIdString(branchId)).filter(Boolean))]
        : [];
    const country = normalizeText(policy.country || 'IN').toUpperCase() || 'IN';
    const hasSelector = Boolean(payrollRegion || workState || workCity || legalEntityId || branchIds.length > 0);

    if (!hasSelector) {
        return null;
    }

    const weeklyOffMode = normalizeText(policy.weeklyOff?.mode || policy.weeklyOffMode || 'COMPANY_DEFAULT').toUpperCase();
    const supportedWeeklyOffMode = ['COMPANY_DEFAULT', 'SUNDAY', 'SATURDAY_SUNDAY', 'CUSTOM', 'ALTERNATE_SATURDAY'].includes(weeklyOffMode)
        ? weeklyOffMode
        : 'COMPANY_DEFAULT';

    return {
        _id: policy._id,
        name: normalizeText(policy.name) || `Location Policy ${index + 1}`,
        country,
        legalEntityId: legalEntityId || null,
        branchIds,
        payrollRegion,
        workState,
        workCity,
        isMetro: policy.isMetro === true,
        hraPercentageOfBasic: normalizeOptionalNumber(policy.hraPercentageOfBasic),
        professionalTaxAmount: normalizeOptionalNumber(policy.professionalTaxAmount),
        holidayCalendarCode: normalizeText(policy.holidayCalendarCode),
        payCalendarCode: normalizeText(policy.payCalendarCode),
        minimumWageCategory: normalizeText(policy.minimumWageCategory),
        minimumWageMonthlyAmount: normalizeOptionalNumber(policy.minimumWageMonthlyAmount),
        weeklyOff: {
            mode: supportedWeeklyOffMode,
            weeklyOffDays: normalizeDayList(policy.weeklyOff?.weeklyOffDays || policy.weeklyOffDays || []),
            saturdayHalfDayEnabled: policy.weeklyOff?.saturdayHalfDayEnabled === true || policy.saturdayHalfDayEnabled === true
        },
        localAllowance: {
            label: normalizeText(policy.localAllowance?.label || policy.localAllowanceLabel),
            amount: normalizeOptionalNumber(policy.localAllowance?.amount || policy.localAllowanceAmount),
            includedInCtc: policy.localAllowance?.includedInCtc === true || policy.localAllowanceIncludedInCtc === true
        },
        overtimePolicy: {
            enabled: policy.overtimePolicy?.enabled === true || policy.overtimeEnabled === true,
            label: normalizeText(policy.overtimePolicy?.label || policy.overtimeLabel || 'Overtime Pay') || 'Overtime Pay',
            multiplier: normalizeNumber(policy.overtimePolicy?.multiplier || policy.overtimeMultiplier, 1),
            weeklyOffMultiplier: normalizeNumber(policy.overtimePolicy?.weeklyOffMultiplier || policy.overtimeWeeklyOffMultiplier, 1.5),
            holidayMultiplier: normalizeNumber(policy.overtimePolicy?.holidayMultiplier || policy.overtimeHolidayMultiplier, 2),
            fixedHourlyRate: normalizeOptionalNumber(policy.overtimePolicy?.fixedHourlyRate || policy.overtimeFixedHourlyRate)
        },
        statutoryApplicability: {
            esiApplicable: normalizeOptionalBoolean(policy.statutoryApplicability?.esiApplicable ?? policy.esiApplicable, null),
            lwfEnabled: policy.statutoryApplicability?.lwfEnabled === true || policy.lwfEnabled === true,
            lwfEmployeeAmount: normalizeOptionalNumber(policy.statutoryApplicability?.lwfEmployeeAmount || policy.lwfEmployeeAmount),
            lwfEmployerAmount: normalizeOptionalNumber(policy.statutoryApplicability?.lwfEmployerAmount || policy.lwfEmployerAmount),
            lwfDeductionMonth: normalizeOptionalNumber(policy.statutoryApplicability?.lwfDeductionMonth || policy.lwfDeductionMonth)
        },
        enabled: policy.enabled !== false
    };
}

function normalizeCompanyPayrollRulesPayload(input = {}, options = {}) {
    const defaults = cloneDefaultRules();
    const rules = typeof input?.toObject === 'function' ? input.toObject() : (input || {});

    const normalized = {
        tenantId: options.tenantId || rules.tenantId,
        basicSalary: {
            percentageOfCTC: normalizeNumber(rules.basicSalary?.percentageOfCTC, defaults.basicSalary.percentageOfCTC),
            enabled: rules.basicSalary?.enabled !== undefined ? rules.basicSalary.enabled === true : defaults.basicSalary.enabled
        },
        hra: {
            percentageOfBasic: normalizeNumber(rules.hra?.percentageOfBasic, defaults.hra.percentageOfBasic),
            enabled: rules.hra?.enabled !== undefined ? rules.hra.enabled === true : defaults.hra.enabled
        },
        conveyance: sanitizeAllowanceSection(rules.conveyance, defaults.conveyance),
        medical: sanitizeAllowanceSection(rules.medical, defaults.medical),
        pf: {
            enabled: rules.pf?.enabled !== undefined ? rules.pf.enabled === true : defaults.pf.enabled,
            employeeRate: normalizeNumber(rules.pf?.employeeRate, defaults.pf.employeeRate),
            employerRate: normalizeNumber(rules.pf?.employerRate, defaults.pf.employerRate),
            wageCeiling: normalizeNumber(rules.pf?.wageCeiling, defaults.pf.wageCeiling),
            capContribution: rules.pf?.capContribution !== undefined ? rules.pf.capContribution === true : defaults.pf.capContribution,
            includeInCTC: rules.pf?.includeInCTC !== undefined ? rules.pf.includeInCTC === true : defaults.pf.includeInCTC
        },
        esic: {
            enabled: rules.esic?.enabled !== undefined ? rules.esic.enabled === true : defaults.esic.enabled,
            employeeRate: normalizeNumber(rules.esic?.employeeRate, defaults.esic.employeeRate),
            employerRate: normalizeNumber(rules.esic?.employerRate, defaults.esic.employerRate),
            wageCeiling: normalizeNumber(rules.esic?.wageCeiling, defaults.esic.wageCeiling),
            includeInCTC: rules.esic?.includeInCTC !== undefined ? rules.esic.includeInCTC === true : defaults.esic.includeInCTC
        },
        professionalTax: {
            enabled: rules.professionalTax?.enabled !== undefined ? rules.professionalTax.enabled === true : defaults.professionalTax.enabled,
            defaultAmount: normalizeNumber(rules.professionalTax?.defaultAmount, defaults.professionalTax.defaultAmount)
        },
        locationPolicies: Array.isArray(rules.locationPolicies)
            ? rules.locationPolicies
                .map((policy, index) => sanitizeLocationPolicy(policy, index))
                .filter(Boolean)
            : defaults.locationPolicies,
        updatedAt: rules.updatedAt || new Date()
    };

    if (rules._id) {
        normalized._id = rules._id;
    }

    return normalized;
}

async function getCompanyPayrollRules(db, tenantId, options = {}) {
    const CompanyPayrollRule = getModel(db, 'CompanyPayrollRule', CompanyPayrollRuleSchema);
    let rules = await CompanyPayrollRule.findOne({ tenantId }).lean();

    if (!rules && options.createIfMissing === true) {
        const created = await CompanyPayrollRule.create(normalizeCompanyPayrollRulesPayload({}, { tenantId }));
        rules = created.toObject();
    }

    return normalizeCompanyPayrollRulesPayload(rules || {}, { tenantId });
}

function policyIncludesBranch(policy = {}, branchId = null) {
    const normalizedBranchId = normalizeObjectIdString(branchId);
    if (!normalizedBranchId) return false;
    const branchIds = Array.isArray(policy.branchIds) ? policy.branchIds.map((item) => normalizeObjectIdString(item)) : [];
    return branchIds.includes(normalizedBranchId);
}

function calculatePolicyMatch(policy = {}, scope = {}) {
    const matchers = [
        {
            key: 'branchIds',
            weight: 200,
            test: () => {
                if (!Array.isArray(policy.branchIds) || policy.branchIds.length === 0) return { matched: false, skip: true };
                return { matched: policyIncludesBranch(policy, scope.branchId), skip: false };
            },
            matchedOn: 'branchId'
        },
        {
            key: 'workCity',
            weight: 100
        },
        {
            key: 'workState',
            weight: 50
        },
        {
            key: 'legalEntityId',
            weight: 30,
            normalize: normalizeObjectIdString
        },
        {
            key: 'payrollRegion',
            weight: 20
        },
        {
            key: 'country',
            weight: 5
        }
    ];

    let score = 0;
    const matchedOn = [];

    for (const matcher of matchers) {
        if (typeof matcher.test === 'function') {
            const result = matcher.test();
            if (result.skip === true) {
                continue;
            }
            if (!result.matched) {
                return null;
            }
            score += matcher.weight;
            matchedOn.push(matcher.matchedOn || matcher.key);
            continue;
        }

        const normalize = matcher.normalize || normalizeMatchValue;
        const policyValue = normalize(policy[matcher.key]);
        if (!policyValue) {
            continue;
        }

        const scopeValue = normalize(scope[matcher.key]);
        if (!scopeValue || scopeValue !== policyValue) {
            return null;
        }

        score += matcher.weight;
        matchedOn.push(matcher.key);
    }

    if (matchedOn.length === 0) {
        return null;
    }

    return {
        policy,
        matchedOn,
        score
    };
}

function materializeWeeklyOffDays(policy = {}, fallback = []) {
    const safePolicy = policy || {};
    const explicitDays = normalizeDayList(safePolicy.weeklyOff?.weeklyOffDays || []);
    if (explicitDays.length > 0) {
        return explicitDays;
    }

    const mode = normalizeText(safePolicy.weeklyOff?.mode || '').toUpperCase();
    if (mode === 'SUNDAY') return [0];
    if (mode === 'SATURDAY_SUNDAY') return [0, 6];
    return normalizeDayList(fallback);
}

function buildResolvedLocationPolicy(rules = {}, payrollProfile = null) {
    const normalizedRules = normalizeCompanyPayrollRulesPayload(rules, { tenantId: rules.tenantId });
    const scope = {
        country: normalizeText(payrollProfile?.country || 'IN').toUpperCase() || 'IN',
        legalEntityId: normalizeObjectIdString(payrollProfile?.legalEntityId),
        branchId: normalizeObjectIdString(payrollProfile?.branchId),
        payrollRegion: normalizeText(payrollProfile?.payrollRegion),
        workState: normalizeText(payrollProfile?.workState),
        workCity: normalizeText(payrollProfile?.workCity)
    };

    const matchedPolicies = (normalizedRules.locationPolicies || [])
        .filter((policy) => policy && policy.enabled !== false)
        .map((policy) => calculatePolicyMatch(policy, scope))
        .filter(Boolean)
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return right.matchedOn.length - left.matchedOn.length;
        });

    const topMatch = matchedPolicies[0] || null;
    const matchedPolicy = topMatch?.policy || null;
    const overrideSource = payrollProfile?.policyOverrides?.locationPolicy || payrollProfile?.policyOverrides || {};
    const hasProfileOverride = Boolean(overrideSource) && Object.keys(overrideSource || {}).length > 0;

    const resolved = {
        source: topMatch ? 'LOCATION_POLICY' : 'DEFAULT',
        locationRuleId: matchedPolicy?._id || null,
        ruleName: matchedPolicy?.name || 'Company Default',
        matchedOn: topMatch?.matchedOn || [],
        scope,
        isMetro: matchedPolicy?.isMetro === true,
        hra: {
            enabled: normalizedRules.hra.enabled !== false,
            percentageOfBasic: matchedPolicy?.hraPercentageOfBasic ?? normalizedRules.hra.percentageOfBasic
        },
        professionalTax: {
            enabled: normalizedRules.professionalTax.enabled !== false,
            amount: matchedPolicy?.professionalTaxAmount ?? normalizedRules.professionalTax.defaultAmount
        },
        holidayCalendarCode: matchedPolicy?.holidayCalendarCode || '',
        payCalendarCode: matchedPolicy?.payCalendarCode || '',
        weeklyOff: {
            mode: matchedPolicy?.weeklyOff?.mode || 'COMPANY_DEFAULT',
            days: materializeWeeklyOffDays(matchedPolicy, []),
            saturdayHalfDayEnabled: matchedPolicy?.weeklyOff?.saturdayHalfDayEnabled === true
        },
        localAllowance: {
            label: matchedPolicy?.localAllowance?.label || '',
            amount: normalizeOptionalNumber(matchedPolicy?.localAllowance?.amount),
            includedInCtc: matchedPolicy?.localAllowance?.includedInCtc === true
        },
        minimumWage: {
            category: matchedPolicy?.minimumWageCategory || '',
            monthlyAmount: normalizeOptionalNumber(matchedPolicy?.minimumWageMonthlyAmount)
        },
        overtime: {
            enabled: matchedPolicy?.overtimePolicy?.enabled === true,
            label: matchedPolicy?.overtimePolicy?.label || 'Overtime Pay',
            multiplier: normalizeNumber(matchedPolicy?.overtimePolicy?.multiplier, 1),
            weeklyOffMultiplier: normalizeNumber(matchedPolicy?.overtimePolicy?.weeklyOffMultiplier, 1.5),
            holidayMultiplier: normalizeNumber(matchedPolicy?.overtimePolicy?.holidayMultiplier, 2),
            fixedHourlyRate: normalizeOptionalNumber(matchedPolicy?.overtimePolicy?.fixedHourlyRate)
        },
        statutoryApplicability: {
            esiApplicable: normalizeOptionalBoolean(matchedPolicy?.statutoryApplicability?.esiApplicable, null),
            lwfEnabled: matchedPolicy?.statutoryApplicability?.lwfEnabled === true,
            lwfEmployeeAmount: normalizeOptionalNumber(matchedPolicy?.statutoryApplicability?.lwfEmployeeAmount),
            lwfEmployerAmount: normalizeOptionalNumber(matchedPolicy?.statutoryApplicability?.lwfEmployerAmount),
            lwfDeductionMonth: normalizeOptionalNumber(matchedPolicy?.statutoryApplicability?.lwfDeductionMonth)
        }
    };

    if (hasProfileOverride) {
        resolved.source = 'PAYROLL_PROFILE_OVERRIDE';
        resolved.ruleName = `${resolved.ruleName} (Profile Override)`;

        if (Object.prototype.hasOwnProperty.call(overrideSource, 'isMetro')) {
            resolved.isMetro = overrideSource.isMetro === true;
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'hraPercentageOfBasic')) {
            const overrideHra = normalizeOptionalNumber(overrideSource.hraPercentageOfBasic);
            if (overrideHra !== null) {
                resolved.hra.percentageOfBasic = overrideHra;
            }
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'professionalTaxAmount')) {
            const overridePt = normalizeOptionalNumber(overrideSource.professionalTaxAmount);
            if (overridePt !== null) {
                resolved.professionalTax.amount = overridePt;
            }
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'holidayCalendarCode')) {
            resolved.holidayCalendarCode = normalizeText(overrideSource.holidayCalendarCode);
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'payCalendarCode')) {
            resolved.payCalendarCode = normalizeText(overrideSource.payCalendarCode);
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'minimumWageCategory')) {
            resolved.minimumWage.category = normalizeText(overrideSource.minimumWageCategory);
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'minimumWageMonthlyAmount')) {
            const overrideMinimumWage = normalizeOptionalNumber(overrideSource.minimumWageMonthlyAmount);
            if (overrideMinimumWage !== null) {
                resolved.minimumWage.monthlyAmount = overrideMinimumWage;
            }
        }
        if (
            Object.prototype.hasOwnProperty.call(overrideSource, 'weeklyOffMode') ||
            Object.prototype.hasOwnProperty.call(overrideSource, 'weeklyOffDays') ||
            Object.prototype.hasOwnProperty.call(overrideSource, 'saturdayHalfDayEnabled')
        ) {
            resolved.weeklyOff.mode = normalizeText(overrideSource.weeklyOffMode || resolved.weeklyOff.mode).toUpperCase() || resolved.weeklyOff.mode;
            resolved.weeklyOff.days = materializeWeeklyOffDays({
                weeklyOff: {
                    mode: resolved.weeklyOff.mode,
                    weeklyOffDays: overrideSource.weeklyOffDays || resolved.weeklyOff.days
                }
            }, resolved.weeklyOff.days);
            resolved.weeklyOff.saturdayHalfDayEnabled = overrideSource.saturdayHalfDayEnabled === true || resolved.weeklyOff.saturdayHalfDayEnabled === true;
        }
        if (
            Object.prototype.hasOwnProperty.call(overrideSource, 'localAllowanceAmount') ||
            Object.prototype.hasOwnProperty.call(overrideSource, 'localAllowanceLabel') ||
            Object.prototype.hasOwnProperty.call(overrideSource, 'localAllowanceIncludedInCtc')
        ) {
            resolved.localAllowance.label = normalizeText(overrideSource.localAllowanceLabel || resolved.localAllowance.label);
            const overrideLocalAllowance = normalizeOptionalNumber(overrideSource.localAllowanceAmount);
            if (overrideLocalAllowance !== null) {
                resolved.localAllowance.amount = overrideLocalAllowance;
            }
            if (Object.prototype.hasOwnProperty.call(overrideSource, 'localAllowanceIncludedInCtc')) {
                resolved.localAllowance.includedInCtc = overrideSource.localAllowanceIncludedInCtc === true;
            }
        }
        if (overrideSource.overtimePolicy && typeof overrideSource.overtimePolicy === 'object') {
            resolved.overtime.enabled = overrideSource.overtimePolicy.enabled === true || resolved.overtime.enabled === true;
            resolved.overtime.label = normalizeText(overrideSource.overtimePolicy.label || resolved.overtime.label) || resolved.overtime.label;
            resolved.overtime.multiplier = normalizeNumber(overrideSource.overtimePolicy.multiplier, resolved.overtime.multiplier);
            resolved.overtime.weeklyOffMultiplier = normalizeNumber(overrideSource.overtimePolicy.weeklyOffMultiplier, resolved.overtime.weeklyOffMultiplier);
            resolved.overtime.holidayMultiplier = normalizeNumber(overrideSource.overtimePolicy.holidayMultiplier, resolved.overtime.holidayMultiplier);
            if (Object.prototype.hasOwnProperty.call(overrideSource.overtimePolicy, 'fixedHourlyRate')) {
                resolved.overtime.fixedHourlyRate = normalizeOptionalNumber(overrideSource.overtimePolicy.fixedHourlyRate);
            }
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'esiApplicable')) {
            resolved.statutoryApplicability.esiApplicable = normalizeOptionalBoolean(overrideSource.esiApplicable, resolved.statutoryApplicability.esiApplicable);
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'lwfEnabled')) {
            resolved.statutoryApplicability.lwfEnabled = overrideSource.lwfEnabled === true;
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'lwfEmployeeAmount')) {
            resolved.statutoryApplicability.lwfEmployeeAmount = normalizeOptionalNumber(overrideSource.lwfEmployeeAmount);
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'lwfEmployerAmount')) {
            resolved.statutoryApplicability.lwfEmployerAmount = normalizeOptionalNumber(overrideSource.lwfEmployerAmount);
        }
        if (Object.prototype.hasOwnProperty.call(overrideSource, 'lwfDeductionMonth')) {
            resolved.statutoryApplicability.lwfDeductionMonth = normalizeOptionalNumber(overrideSource.lwfDeductionMonth);
        }
    }

    resolved.hra.percentageOfBasic = normalizeNumber(resolved.hra.percentageOfBasic, normalizedRules.hra.percentageOfBasic);
    resolved.professionalTax.amount = normalizeNumber(resolved.professionalTax.amount, normalizedRules.professionalTax.defaultAmount);

    return resolved;
}

async function resolvePayrollLocationPolicy(db, tenantId, payrollProfile = null) {
    const rules = await getCompanyPayrollRules(db, tenantId, { createIfMissing: false });
    return buildResolvedLocationPolicy(rules, payrollProfile);
}

function buildLocationPolicySnapshot(policy = null) {
    if (!policy) return null;

    return {
        source: policy.source,
        locationRuleId: policy.locationRuleId || null,
        ruleName: policy.ruleName,
        matchedOn: Array.isArray(policy.matchedOn) ? policy.matchedOn : [],
        country: policy.scope?.country || 'IN',
        legalEntityId: policy.scope?.legalEntityId || null,
        branchId: policy.scope?.branchId || null,
        payrollRegion: policy.scope?.payrollRegion || '',
        workState: policy.scope?.workState || '',
        workCity: policy.scope?.workCity || '',
        isMetro: policy.isMetro === true,
        hraEnabled: policy.hra?.enabled !== false,
        hraPercentageOfBasic: normalizeNumber(policy.hra?.percentageOfBasic, 0),
        professionalTaxEnabled: policy.professionalTax?.enabled !== false,
        professionalTaxAmount: normalizeNumber(policy.professionalTax?.amount, 0),
        holidayCalendarCode: policy.holidayCalendarCode || '',
        payCalendarCode: policy.payCalendarCode || '',
        weeklyOffMode: policy.weeklyOff?.mode || 'COMPANY_DEFAULT',
        weeklyOffDays: normalizeDayList(policy.weeklyOff?.days || []),
        saturdayHalfDayEnabled: policy.weeklyOff?.saturdayHalfDayEnabled === true,
        localAllowanceLabel: policy.localAllowance?.label || '',
        localAllowanceAmount: normalizeOptionalNumber(policy.localAllowance?.amount),
        localAllowanceIncludedInCtc: policy.localAllowance?.includedInCtc === true,
        minimumWageCategory: policy.minimumWage?.category || '',
        minimumWageMonthlyAmount: normalizeOptionalNumber(policy.minimumWage?.monthlyAmount),
        overtimeEnabled: policy.overtime?.enabled === true,
        overtimeLabel: policy.overtime?.label || 'Overtime Pay',
        overtimeMultiplier: normalizeNumber(policy.overtime?.multiplier, 1),
        overtimeWeeklyOffMultiplier: normalizeNumber(policy.overtime?.weeklyOffMultiplier, 1.5),
        overtimeHolidayMultiplier: normalizeNumber(policy.overtime?.holidayMultiplier, 2),
        overtimeFixedHourlyRate: normalizeOptionalNumber(policy.overtime?.fixedHourlyRate),
        esiApplicable: normalizeOptionalBoolean(policy.statutoryApplicability?.esiApplicable, null),
        lwfEnabled: policy.statutoryApplicability?.lwfEnabled === true,
        lwfEmployeeAmount: normalizeOptionalNumber(policy.statutoryApplicability?.lwfEmployeeAmount),
        lwfEmployerAmount: normalizeOptionalNumber(policy.statutoryApplicability?.lwfEmployerAmount),
        lwfDeductionMonth: normalizeOptionalNumber(policy.statutoryApplicability?.lwfDeductionMonth)
    };
}

module.exports = {
    DEFAULT_RULES,
    buildLocationPolicySnapshot,
    buildResolvedLocationPolicy,
    getCompanyPayrollRules,
    normalizeCompanyPayrollRulesPayload,
    resolvePayrollLocationPolicy
};
