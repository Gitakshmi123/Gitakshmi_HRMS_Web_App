/**
 * TDS Service
 * Compatibility-first monthly tax calculation with optional rule-set driven projection.
 */

const DEFAULT_OLD_REGIME_SLABS = [
    { minIncome: 0, maxIncome: 250000, rate: 0 },
    { minIncome: 250000, maxIncome: 500000, rate: 5 },
    { minIncome: 500000, maxIncome: 1000000, rate: 20 },
    { minIncome: 1000000, maxIncome: null, rate: 30 }
];

const DEFAULT_NEW_REGIME_SLABS = [
    { minIncome: 0, maxIncome: 250000, rate: 0 },
    { minIncome: 250000, maxIncome: 500000, rate: 5 },
    { minIncome: 500000, maxIncome: 1000000, rate: 20 },
    { minIncome: 1000000, maxIncome: null, rate: 30 }
];

function normalizeMoney(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
}

function normalizeRegime(value = 'NEW') {
    const normalized = String(value || 'NEW').trim().toUpperCase();
    return normalized === 'OLD' ? 'OLD' : 'NEW';
}

function getDefaultSlabs(regime = 'NEW') {
    return regime === 'OLD' ? DEFAULT_OLD_REGIME_SLABS : DEFAULT_NEW_REGIME_SLABS;
}

function normalizeSlabs(slabs, regime = 'NEW') {
    if (!Array.isArray(slabs) || slabs.length === 0) {
        return getDefaultSlabs(regime);
    }

    return slabs
        .map((slab) => ({
            minIncome: normalizeMoney(slab.minIncome, 0),
            maxIncome: slab.maxIncome === null || slab.maxIncome === undefined || slab.maxIncome === ''
                ? null
                : normalizeMoney(slab.maxIncome, 0),
            rate: normalizeMoney(slab.rate, 0)
        }))
        .sort((left, right) => left.minIncome - right.minIncome);
}

function getFiscalMonthsRemaining(month) {
    const numericMonth = parseInt(month, 10);
    if (!(numericMonth >= 1 && numericMonth <= 12)) {
        return 12;
    }

    const fiscalIndex = numericMonth >= 4 ? numericMonth - 3 : numericMonth + 9;
    return Math.max(1, 13 - fiscalIndex);
}

function getFiscalMonthsElapsedBefore(month) {
    const numericMonth = parseInt(month, 10);
    if (!(numericMonth >= 1 && numericMonth <= 12)) {
        return 0;
    }

    const fiscalIndex = numericMonth >= 4 ? numericMonth - 3 : numericMonth + 9;
    return Math.max(0, fiscalIndex - 1);
}

function calculateAnnualTax(annualTaxable, options = {}) {
    const taxable = normalizeMoney(annualTaxable, 0);
    const cessRate = normalizeMoney(options.cessRate, 4);
    const rebateLimit = normalizeMoney(options.rebateLimit, 500000);
    const rebateAmount = normalizeMoney(options.rebateAmount, 12500);
    const slabs = normalizeSlabs(options.slabs, normalizeRegime(options.regime));

    let incomeTaxBeforeRebate = 0;
    const breakdown = [];

    for (const slab of slabs) {
        const slabStart = slab.minIncome || 0;
        const slabEnd = slab.maxIncome === null ? taxable : Math.min(taxable, slab.maxIncome);
        if (taxable <= slabStart || slabEnd <= slabStart) {
            continue;
        }

        const slabTax = ((slabEnd - slabStart) * (slab.rate || 0)) / 100;
        incomeTaxBeforeRebate += slabTax;
        breakdown.push({
            from: slabStart,
            to: slab.maxIncome,
            rate: slab.rate || 0,
            amount: normalizeMoney(slabTax, 0)
        });
    }

    const rebate = taxable <= rebateLimit
        ? Math.min(normalizeMoney(incomeTaxBeforeRebate, 0), rebateAmount)
        : 0;
    const incomeTax = Math.max(0, normalizeMoney(incomeTaxBeforeRebate - rebate, 0));
    const cess = normalizeMoney((incomeTax * cessRate) / 100, 0);
    const total = normalizeMoney(incomeTax + cess, 0);

    return {
        tax: incomeTax,
        cess,
        total,
        rebate,
        cessRate,
        breakdown
    };
}

function buildProjectionSummary(monthlyTaxable, taxProfile = {}, ruleConfig = {}, regime = 'NEW', context = {}) {
    const declarations = taxProfile.declarations || {};
    const projections = taxProfile.projections || {};
    const overrides = taxProfile.overrides || {};
    const monthsRemaining = getFiscalMonthsRemaining(context.month);
    const monthsElapsedBefore = getFiscalMonthsElapsedBefore(context.month);

    const ytdTaxableIncome = normalizeMoney(
        context.ytdTaxableIncome !== undefined && context.ytdTaxableIncome !== null
            ? context.ytdTaxableIncome
            : projections.ytdTaxableIncome,
        0
    );
    const annualizedFromCurrentPayroll = normalizeMoney(monthlyTaxable * Math.max(1, monthsRemaining), 0);
    const previousEmployerIncome = normalizeMoney(projections.previousEmployerIncome, 0);
    const otherIncome = normalizeMoney(projections.otherIncome, 0);
    const bonusProjection = normalizeMoney(projections.bonusProjection, 0);
    const grossProjection = normalizeMoney(
        ytdTaxableIncome + annualizedFromCurrentPayroll + previousEmployerIncome + otherIncome + bonusProjection,
        0
    );

    const standardDeduction = normalizeMoney(ruleConfig.standardDeduction, 0);
    const declarationBreakdown = {
        section80C: normalizeMoney(declarations.section80C, 0),
        section80CCD1B: normalizeMoney(declarations.section80CCD1B, 0),
        section80D: normalizeMoney(declarations.section80D, 0),
        homeLoanInterest: normalizeMoney(declarations.homeLoanInterest, 0),
        otherExemptions: normalizeMoney(declarations.otherExemptions, 0),
        hraExemption: regime === 'OLD' ? normalizeMoney(declarations.hraExemption, 0) : 0
    };

    const declarationTotal = Object.values(declarationBreakdown)
        .reduce((sum, value) => sum + normalizeMoney(value, 0), 0);
    const overrideAnnualTaxableIncome = overrides.annualTaxableIncome !== undefined && overrides.annualTaxableIncome !== null
        ? normalizeMoney(overrides.annualTaxableIncome, 0)
        : null;

    const computedAnnualTaxable = Math.max(
        0,
        normalizeMoney(grossProjection - standardDeduction - declarationTotal, 0)
    );

    return {
        ytdTaxableIncome,
        monthsElapsedBefore,
        monthsRemaining,
        annualizedFromCurrentPayroll,
        previousEmployerIncome,
        otherIncome,
        bonusProjection,
        grossProjection,
        standardDeduction,
        declarationBreakdown,
        declarationTotal,
        overrideAnnualTaxableIncome,
        annualTaxableIncome: overrideAnnualTaxableIncome !== null
            ? overrideAnnualTaxableIncome
            : computedAnnualTaxable
    };
}

async function calculateMonthlyTDS(monthlyTaxable, employee, opts = {}) {
    const normalizedMonthlyTaxable = normalizeMoney(monthlyTaxable, 0);
    const ruleConfig = opts.ruleSet?.incomeTax || {};
    const taxProfile = opts.taxProfile || {};
    const regime = normalizeRegime(taxProfile.regime || opts.regime || 'NEW');
    const overrideMonthlyTDS = taxProfile.overrides?.monthlyTDS !== undefined && taxProfile.overrides?.monthlyTDS !== null
        ? normalizeMoney(taxProfile.overrides.monthlyTDS, 0)
        : null;
    const enhancedMode = ruleConfig.useEnhancedComputation === true
        || overrideMonthlyTDS !== null
        || normalizeMoney(opts.taxAlreadyDeducted, 0) > 0
        || normalizeMoney(opts.ytdTaxableIncome, 0) > 0;

    if (overrideMonthlyTDS !== null) {
        return {
            monthly: overrideMonthlyTDS,
            annual: normalizeMoney(overrideMonthlyTDS * 12, 0),
            annualTaxable: normalizeMoney(normalizedMonthlyTaxable * 12, 0),
            breakdown: [],
            regime,
            overrideApplied: true,
            incomeTaxBeforeCess: normalizeMoney((overrideMonthlyTDS * 12) / (1 + (normalizeMoney(ruleConfig.cessRate, 4) / 100)), 0),
            cess: normalizeMoney((overrideMonthlyTDS * 12) - ((overrideMonthlyTDS * 12) / (1 + (normalizeMoney(ruleConfig.cessRate, 4) / 100))), 0),
            annualTaxWithCess: normalizeMoney(overrideMonthlyTDS * 12, 0),
            monthsRemaining: getFiscalMonthsRemaining(opts.month)
        };
    }

    const projection = buildProjectionSummary(normalizedMonthlyTaxable, taxProfile, ruleConfig, regime, {
        month: opts.month,
        ytdTaxableIncome: opts.ytdTaxableIncome
    });
    const annualTaxable = enhancedMode
        ? projection.annualTaxableIncome
        : normalizeMoney(normalizedMonthlyTaxable * 12, 0);
    const annualResult = calculateAnnualTax(annualTaxable, {
        slabs: ruleConfig.regimes?.[regime.toLowerCase()],
        cessRate: ruleConfig.cessRate,
        rebateLimit: ruleConfig.rebateLimit,
        rebateAmount: ruleConfig.rebateAmount,
        regime
    });

    const taxAlreadyDeducted = enhancedMode
        ? normalizeMoney(
            opts.taxAlreadyDeducted !== undefined && opts.taxAlreadyDeducted !== null
                ? opts.taxAlreadyDeducted
                : taxProfile.projections?.taxAlreadyDeducted,
            0
        )
        : 0;
    const remainingAnnualTax = Math.max(0, normalizeMoney(annualResult.total - taxAlreadyDeducted, 0));
    const monthsRemaining = enhancedMode ? getFiscalMonthsRemaining(opts.month) : 12;
    const monthly = normalizeMoney(remainingAnnualTax / Math.max(1, monthsRemaining), 0);

    return {
        monthly,
        annual: annualTaxable,
        annualTaxable,
        annualTaxWithCess: annualResult.total,
        remainingAnnualTax,
        breakdown: annualResult.breakdown,
        regime,
        enhancedMode,
        projection,
        incomeTaxBeforeCess: annualResult.tax,
        cess: annualResult.cess,
        rebate: annualResult.rebate,
        taxAlreadyDeducted,
        monthsRemaining
    };
}

module.exports = {
    calculateTDS: calculateMonthlyTDS,
    calculateMonthlyTDS,
    calculateAnnualTax
};
