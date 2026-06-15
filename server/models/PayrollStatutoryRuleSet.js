const mongoose = require('mongoose');

function normalizeScopeValue(value = '') {
    return String(value || '').trim();
}

function normalizeScopeToken(value = '', fallback = '') {
    const normalized = normalizeScopeValue(value || fallback);
    return normalized.toLowerCase();
}

function normalizeScopeCountry(value = '', fallback = 'IN') {
    const normalized = normalizeScopeValue(value || fallback).toUpperCase();
    return normalized || 'IN';
}

function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfDay(value) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
}

function buildSlabScopeKey(slab = {}, fallbackScope = {}) {
    return [
        normalizeScopeToken(slab.country, fallbackScope.country || 'IN'),
        normalizeScopeToken(slab.workState, fallbackScope.workState || ''),
        normalizeScopeToken(slab.workCity, fallbackScope.workCity || ''),
        normalizeScopeToken(slab.payrollRegion, fallbackScope.payrollRegion || '')
    ].join('|');
}

function normalizeIncomeBoundary(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function slabIncomeOverlaps(left = {}, right = {}) {
    const leftMin = normalizeIncomeBoundary(left.minIncome, 0);
    const leftMax = left.maxIncome === null || left.maxIncome === undefined || left.maxIncome === ''
        ? Number.POSITIVE_INFINITY
        : normalizeIncomeBoundary(left.maxIncome, Number.POSITIVE_INFINITY);
    const rightMin = normalizeIncomeBoundary(right.minIncome, 0);
    const rightMax = right.maxIncome === null || right.maxIncome === undefined || right.maxIncome === ''
        ? Number.POSITIVE_INFINITY
        : normalizeIncomeBoundary(right.maxIncome, Number.POSITIVE_INFINITY);

    return leftMin <= rightMax && rightMin <= leftMax;
}

function slabDateOverlaps(left = {}, right = {}) {
    const leftFrom = left.effectiveFrom ? startOfDay(left.effectiveFrom) : new Date('1900-01-01T00:00:00.000Z');
    const leftTo = left.effectiveTo ? endOfDay(left.effectiveTo) : new Date('9999-12-31T23:59:59.999Z');
    const rightFrom = right.effectiveFrom ? startOfDay(right.effectiveFrom) : new Date('1900-01-01T00:00:00.000Z');
    const rightTo = right.effectiveTo ? endOfDay(right.effectiveTo) : new Date('9999-12-31T23:59:59.999Z');

    return leftFrom <= rightTo && rightFrom <= leftTo;
}

const TaxSlabSchema = new mongoose.Schema({
    minIncome: { type: Number, required: true, default: 0 },
    maxIncome: { type: Number, default: null },
    rate: { type: Number, required: true, default: 0 }
}, { _id: false });

const ProfessionalTaxSlabSchema = new mongoose.Schema({
    country: { type: String, trim: true, default: 'IN' },
    workState: { type: String, trim: true, default: '' },
    workCity: { type: String, trim: true, default: '' },
    payrollRegion: { type: String, trim: true, default: '' },
    minIncome: { type: Number, default: 0 },
    maxIncome: { type: Number, default: null },
    amount: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0 },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    source: {
        type: String,
        enum: ['MANUAL', 'PRESET', 'GOV_NOTIFICATION', 'GOV_PORTAL', 'SYSTEM', 'MIGRATION', 'COMPANY_PAYROLL_RULE'],
        default: 'MANUAL',
        uppercase: true
    },
    sourceReference: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    sourceVersion: { type: Number, min: 1, default: 1 },
    ruleVersion: { type: Number, min: 1, default: 1 },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const PayrollStatutoryRuleSetSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        trim: true,
        uppercase: true
    },
    version: {
        type: Number,
        default: 1,
        min: 1
    },
    effectiveFrom: {
        type: Date,
        required: true,
        index: true
    },
    effectiveTo: {
        type: Date,
        default: null,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'SCHEDULED', 'INACTIVE', 'EXPIRED'],
        default: 'ACTIVE',
        uppercase: true,
        index: true
    },
    source: {
        type: String,
        enum: ['MANUAL', 'COMPANY_PAYROLL_RULE', 'MIGRATION', 'SYSTEM', 'PRESET'],
        default: 'MANUAL'
    },
    country: {
        type: String,
        trim: true,
        default: 'IN'
    },
    workState: {
        type: String,
        trim: true,
        default: ''
    },
    workCity: {
        type: String,
        trim: true,
        default: ''
    },
    payrollRegion: {
        type: String,
        trim: true,
        default: ''
    },
    pf: {
        enabled: { type: Boolean, default: true },
        employeeRate: { type: Number, default: 12 },
        employerRate: { type: Number, default: 12 },
        wageCeiling: { type: Number, default: 15000 },
        capContribution: { type: Boolean, default: true },
        includeInCTC: { type: Boolean, default: true }
    },
    esi: {
        enabled: { type: Boolean, default: true },
        employeeRate: { type: Number, default: 0.75 },
        employerRate: { type: Number, default: 3.25 },
        wageCeiling: { type: Number, default: 21000 },
        includeInCTC: { type: Boolean, default: true }
    },
    gratuity: {
        enabled: { type: Boolean, default: true },
        employerRate: { type: Number, default: 4.81 }
    },
    professionalTax: {
        enabled: { type: Boolean, default: true },
        defaultAmount: { type: Number, default: 200 },
        slabVersion: { type: Number, min: 1, default: 1 },
        slabSource: {
            type: String,
            enum: ['MANUAL', 'PRESET', 'GOV_NOTIFICATION', 'GOV_PORTAL', 'SYSTEM', 'MIGRATION', 'COMPANY_PAYROLL_RULE'],
            default: 'MANUAL',
            uppercase: true
        },
        slabSourceReference: { type: String, trim: true, default: '' },
        slabSourceUrl: { type: String, trim: true, default: '' },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        slabs: {
            type: [ProfessionalTaxSlabSchema],
            default: []
        }
    },
    incomeTax: {
        enabled: { type: Boolean, default: true },
        useEnhancedComputation: { type: Boolean, default: false },
        standardDeduction: { type: Number, default: 0 },
        cessRate: { type: Number, default: 4 },
        rebateLimit: { type: Number, default: 500000 },
        rebateAmount: { type: Number, default: 12500 },
        regimes: {
            old: {
                type: [TaxSlabSchema],
                default: [
                    { minIncome: 0, maxIncome: 250000, rate: 0 },
                    { minIncome: 250000, maxIncome: 500000, rate: 5 },
                    { minIncome: 500000, maxIncome: 1000000, rate: 20 },
                    { minIncome: 1000000, maxIncome: null, rate: 30 }
                ]
            },
            new: {
                type: [TaxSlabSchema],
                default: [
                    { minIncome: 0, maxIncome: 250000, rate: 0 },
                    { minIncome: 250000, maxIncome: 500000, rate: 5 },
                    { minIncome: 500000, maxIncome: 1000000, rate: 20 },
                    { minIncome: 1000000, maxIncome: null, rate: 30 }
                ]
            }
        }
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    preset: {
        key: { type: String, trim: true, uppercase: true, default: '' },
        label: { type: String, trim: true, default: '' },
        revision: { type: String, trim: true, default: '' },
        seededAt: { type: Date, default: null }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    collection: 'payroll_statutory_rule_sets'
});

PayrollStatutoryRuleSetSchema.pre('validate', function(next) {
    if (this.status) {
        this.status = String(this.status).toUpperCase();
    }
    if (this.source) {
        this.source = String(this.source).toUpperCase();
    }

    this.country = normalizeScopeCountry(this.country, 'IN');
    this.workState = normalizeScopeValue(this.workState);
    this.workCity = normalizeScopeValue(this.workCity);
    this.payrollRegion = normalizeScopeValue(this.payrollRegion);

    if (this.effectiveFrom) {
        const from = new Date(this.effectiveFrom);
        if (isNaN(from.getTime())) {
            return next(new Error('Statutory rule set effectiveFrom is invalid'));
        }
    }

    if (this.effectiveTo) {
        const to = new Date(this.effectiveTo);
        if (isNaN(to.getTime())) {
            return next(new Error('Statutory rule set effectiveTo is invalid'));
        }
    }

    if (this.effectiveFrom && this.effectiveTo) {
        const from = new Date(this.effectiveFrom);
        const to = new Date(this.effectiveTo);
        if (to < from) {
            return next(new Error('Statutory rule set effectiveTo cannot be before effectiveFrom'));
        }
    }

    if (this.professionalTax) {
        this.professionalTax.slabVersion = Math.max(1, Number(this.professionalTax.slabVersion || 1));
        if (this.professionalTax.slabSource) {
            this.professionalTax.slabSource = String(this.professionalTax.slabSource).toUpperCase();
        }
        if (this.professionalTax.metadata === null || this.professionalTax.metadata === undefined) {
            this.professionalTax.metadata = {};
        }
    }

    const slabs = Array.isArray(this.professionalTax?.slabs) ? this.professionalTax.slabs : [];
    for (let index = 0; index < slabs.length; index += 1) {
        const slab = slabs[index];
        slab.country = normalizeScopeCountry(slab.country, this.country || 'IN');
        slab.workState = normalizeScopeValue(slab.workState || this.workState);
        slab.workCity = normalizeScopeValue(slab.workCity || this.workCity);
        slab.payrollRegion = normalizeScopeValue(slab.payrollRegion || this.payrollRegion);
        slab.displayOrder = Number.isFinite(Number(slab.displayOrder)) ? Number(slab.displayOrder) : index;
        slab.minIncome = normalizeIncomeBoundary(slab.minIncome, 0);
        slab.maxIncome = slab.maxIncome === null || slab.maxIncome === undefined || slab.maxIncome === ''
            ? null
            : normalizeIncomeBoundary(slab.maxIncome, null);
        slab.amount = normalizeIncomeBoundary(slab.amount, 0);
        slab.sourceVersion = Math.max(1, Number(slab.sourceVersion || 1));
        slab.ruleVersion = Math.max(1, Number(slab.ruleVersion || this.version || 1));
        slab.source = String(slab.source || this.professionalTax?.slabSource || this.source || 'MANUAL').toUpperCase();
        if (slab.metadata === null || slab.metadata === undefined) {
            slab.metadata = {};
        }

        if (!Number.isFinite(slab.minIncome) || slab.minIncome < 0) {
            return next(new Error(`Professional tax slab ${index + 1} has invalid minIncome`));
        }
        if (slab.maxIncome !== null && (!Number.isFinite(slab.maxIncome) || slab.maxIncome < slab.minIncome)) {
            return next(new Error(`Professional tax slab ${index + 1} has invalid maxIncome`));
        }
        if (!Number.isFinite(slab.amount) || slab.amount < 0) {
            return next(new Error(`Professional tax slab ${index + 1} has invalid amount`));
        }

        if (slab.effectiveFrom) {
            const slabFrom = new Date(slab.effectiveFrom);
            if (isNaN(slabFrom.getTime())) {
                return next(new Error(`Professional tax slab ${index + 1} has invalid effectiveFrom`));
            }
        }

        if (slab.effectiveTo) {
            const slabTo = new Date(slab.effectiveTo);
            if (isNaN(slabTo.getTime())) {
                return next(new Error(`Professional tax slab ${index + 1} has invalid effectiveTo`));
            }
        }

        if (slab.effectiveFrom && slab.effectiveTo) {
            const slabFrom = new Date(slab.effectiveFrom);
            const slabTo = new Date(slab.effectiveTo);
            if (slabTo < slabFrom) {
                return next(new Error(`Professional tax slab ${index + 1} effectiveTo cannot be before effectiveFrom`));
            }
        }
    }

    for (let leftIndex = 0; leftIndex < slabs.length; leftIndex += 1) {
        const left = slabs[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < slabs.length; rightIndex += 1) {
            const right = slabs[rightIndex];
            const sameScope = buildSlabScopeKey(left, this) === buildSlabScopeKey(right, this);
            if (!sameScope) continue;
            if (!slabDateOverlaps(left, right)) continue;
            if (!slabIncomeOverlaps(left, right)) continue;

            return next(new Error(
                `Professional tax slabs ${leftIndex + 1} and ${rightIndex + 1} overlap for the same scope/effective dates`
            ));
        }
    }

    next();
});

PayrollStatutoryRuleSetSchema.index({ tenantId: 1, status: 1, effectiveFrom: -1 });
PayrollStatutoryRuleSetSchema.index({ tenantId: 1, workState: 1, payrollRegion: 1, effectiveFrom: -1 });
PayrollStatutoryRuleSetSchema.index({ tenantId: 1, country: 1, workState: 1, workCity: 1, payrollRegion: 1, effectiveFrom: -1 });
PayrollStatutoryRuleSetSchema.index({ tenantId: 1, code: 1, version: -1 }, { unique: false });
PayrollStatutoryRuleSetSchema.index({ tenantId: 1, code: 1, country: 1, workState: 1, workCity: 1, payrollRegion: 1, version: -1 }, { unique: false });

module.exports = PayrollStatutoryRuleSetSchema;
