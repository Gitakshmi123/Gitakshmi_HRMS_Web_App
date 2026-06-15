/**
 * Component Key Normalizer
 * 
 * Normalizes all salary component names to standard keys.
 * Handles case variations, spaces, underscores, hyphens.
 * 
 * Usage:
 *   normalizeComponentKey("BASIC SALARY") → "basic"
 *   normalizeComponentKey("Gross_A") → "gross_a"
 *   normalizeComponentKey("hra-amount") → "hra"
 */

const COMPONENT_ALIASES = {
    // Basic Salary
    basic: ['basic', 'basic_salary', 'basic salary', 'bs', 'fixed_basic', 'monthly_basic'],

    // Allowances
    hra: ['hra', 'house rent allowance', 'house_rent_allowance', 'rent_allowance'],
    medical: ['medical', 'medical allowance', 'medical_allowance', 'ma', 'medical_reimbursement'],
    conveyance: ['conveyance', 'conveyance allowance', 'conveyance_allowance'],
    transport: ['transport', 'transportation', 'transport allowance', 'transport_allowance'],
    education: ['education', 'education allowance', 'education_allowance', 'eea'],
    books: ['books', 'books allowance', 'books_allowance'],
    uniform: ['uniform', 'uniform allowance', 'uniform_allowance'],
    mobile: ['mobile', 'mobile allowance', 'mobile_allowance', 'phone'],
    special: ['special', 'special allowance', 'special_allowance', 'sa'],

    // Deductions
    pt: ['pt', 'professional tax', 'professional_tax'],
    pf: ['pf', 'epf', 'employee pf', 'employee_pf', 'provident fund', 'provident_fund'],

    // Employer Contributions
    employer_pf: ['employer_pf', 'employer pf', 'employer_contribution', 'epf_employer'],
    gratuity: ['gratuity', 'gratuity fund', 'gratuity_fund'],
    insurance: ['insurance', 'group insurance', 'group_insurance', 'gi'],

    // Gross Components
    gross_a: ['gross_a', 'grossa', 'gross a', 'gross-a'],
    gross_b: ['gross_b', 'grossb', 'gross b', 'gross-b'],
    gross_c: ['gross_c', 'grossc', 'gross c', 'gross-c'],

    // Total
    total_ctc: ['total_ctc', 'total ctc', 'totalctc', 'ctc', 'total_cost_to_company']
};

/**
 * Normalize a component key to standard form
 * @param {string} input - Raw component name/key
 * @returns {string} - Normalized key (lowercase, underscores)
 */
function normalizeComponentKey(input) {
    if (!input) return null;

    // Convert to lowercase and normalize spaces/hyphens to underscores
    let normalized = input
        .toLowerCase()
        .trim()
        .replace(/[-\s]+/g, '_')  // Replace hyphens and spaces with underscores
        .replace(/_+/g, '_');      // Collapse multiple underscores

    // Check against all aliases
    for (const [standard, aliases] of Object.entries(COMPONENT_ALIASES)) {
        if (aliases.includes(normalized)) {
            return standard;
        }
    }

    // If no match found, return the normalized version as-is
    return normalized;
}

/**
 * Get all variations of a standard component key
 * @param {string} standardKey - Standard key (e.g., "basic", "gross_a")
 * @returns {array} - All variations
 */
function getComponentVariations(standardKey) {
    const key = standardKey?.toLowerCase();
    return COMPONENT_ALIASES[key] || [standardKey];
}

/**
 * Normalize all components in a compensation object
 * @param {object} compensation - Compensation object with components array
 * @returns {object} - Compensation with normalized component names
 */
function normalizeCompensation(compensation) {
    if (!compensation) return compensation;

    const normalized = { ...compensation };

    if (normalized.components && Array.isArray(normalized.components)) {
        normalized.components = normalized.components.map(comp => ({
            ...comp,
            normalizedKey: normalizeComponentKey(comp.name),
            code: comp.code || normalizeComponentKey(comp.name),
            type: comp.type || 'EARNING' // Default to EARNING if missing
        }));
    }

    return normalized;
}

/**
 * Extract component value by flexible key matching
 * Handles all variations: "BASIC SALARY", "basic_salary", "basic-salary"
 * @param {object} compensation - Compensation object
 * @param {string} keyVariation - Any variation of the key
 * @returns {number} - Component monthly amount or 0
 */
function getComponentValue(compensation, keyVariation) {
    if (!compensation || !compensation.components) return 0;

    const standardKey = normalizeComponentKey(keyVariation);
    const component = compensation.components.find(c =>
        normalizeComponentKey(c.name) === standardKey ||
        normalizeComponentKey(c.code) === standardKey
    );

    return component?.monthlyAmount || 0;
}

/**
 * Calculate gross totals with fallback
 * If GrossB or GrossC missing, auto-calculate from components
 * @param {object} compensation - Compensation object
 * @returns {object} - { grossA, grossB, grossC, totalCTC }
 */
function ensureGrossTotals(compensation) {
    if (!compensation) return { grossA: 0, grossB: 0, grossC: 0, totalCTC: 0 };

    let grossA = compensation.grossA || 0;
    let grossB = compensation.grossB || 0;
    let grossC = compensation.grossC || 0;
    let totalCTC = compensation.totalCTC || 0;

    // If Gross B or C missing, auto-calculate from components
    if ((!grossB || !grossC) && compensation.components) {
        const earningsSum = compensation.components
            .filter(c => c.type === 'EARNING')
            .reduce((sum, c) => sum + (c.annualAmount || 0), 0);

        // If both missing, split evenly (this is fallback logic only)
        if (!grossB && !grossC) {
            grossB = Math.round(earningsSum / 2);
            grossC = earningsSum - grossB;
        } else if (!grossB) {
            grossB = earningsSum - (grossC || 0);
        } else if (!grossC) {
            grossC = earningsSum - (grossB || 0);
        }
    }

    // Ensure totalCTC
    if (!totalCTC) {
        totalCTC = (grossA || 0) + (grossB || 0) + (grossC || 0);
    }

    return {
        grossA: Math.max(0, grossA),
        grossB: Math.max(0, grossB),
        grossC: Math.max(0, grossC),
        totalCTC: Math.max(0, totalCTC)
    };
}

module.exports = {
    normalizeComponentKey,
    getComponentVariations,
    normalizeCompensation,
    getComponentValue,
    ensureGrossTotals,
    COMPONENT_ALIASES
};
