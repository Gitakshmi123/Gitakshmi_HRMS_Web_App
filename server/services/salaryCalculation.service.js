/**
 * Salary Calculation Service
 * Complete salary breakdown calculation for Joining Letters and Payroll
 * 
 * SINGLE SOURCE OF TRUTH for salary calculations
 * 
 * Rules:
 * - All calculations server-side only
 * - Returns complete breakdown including Gross A/B/C, Gratuity, Take Home
 * - Used by: Salary Assignment, Joining Letter, Payroll
 */

/**
 * Calculate complete salary breakdown from SalaryTemplate
 * @param {Object} salaryTemplate - SalaryTemplate document
 * @returns {Object} Complete salary breakdown
 */
function calculateCompleteSalaryBreakdown(salaryTemplate) {
    if (!salaryTemplate) {
        throw new Error('Salary template is required');
    }

    const {
        annualCTC,
        monthlyCTC,
        earnings,
        employerDeductions,
        employeeDeductions,
        settings
    } = salaryTemplate;

    // 1. Find Basic component
    const basicEarning = earnings.find(e => e.name.toLowerCase().includes('basic'));
    if (!basicEarning) {
        throw new Error('Basic salary component is mandatory');
    }
    const basicMonthly = basicEarning.monthlyAmount || 0;
    const basicYearly = basicEarning.annualAmount || 0;

    // 2. Calculate Gross A (Basic + HRA + Allowances, excluding Fixed Allowance)
    // Gross A = Sum of all earnings EXCEPT Fixed Allowance
    const earningsForGrossA = earnings.filter(e => 
        !e.name.toLowerCase().includes('fixed allowance')
    );
    const grossAMonthly = earningsForGrossA.reduce((sum, e) => sum + (e.monthlyAmount || 0), 0);
    const grossAYearly = earningsForGrossA.reduce((sum, e) => sum + (e.annualAmount || 0), 0);

    // Round to 2 decimal places
    const grossAMonthlyRounded = Math.round(grossAMonthly * 100) / 100;
    const grossAYearlyRounded = Math.round(grossAYearly * 100) / 100;

    // 3. Calculate Gratuity (4.8% of Basic - Employer cost only)
    const gratuityMonthly = Math.round((basicMonthly * 0.048) * 100) / 100;
    const gratuityYearly = Math.round((basicYearly * 0.048) * 100) / 100;

    // 4. Calculate Gross B (Gross A + Gratuity + Insurance if applicable)
    // Note: Insurance is optional and may not exist in template
    // For now, assuming no separate insurance field (it's part of employer deductions if applicable)
    const grossBMonthly = grossAMonthlyRounded + gratuityMonthly;
    const grossBYearly = grossAYearlyRounded + gratuityYearly;

    // 5. Calculate Gross C / CTC (Gross B + Employer Contributions)
    // Employer Contributions = EPF, ESI, EDLI, Admin Charges
    const employerContributionsMonthly = employerDeductions.reduce((sum, ed) => sum + (ed.monthlyAmount || 0), 0);
    const employerContributionsYearly = employerDeductions.reduce((sum, ed) => sum + (ed.annualAmount || 0), 0);
    
    const grossCMonthly = grossBMonthly + employerContributionsMonthly;
    const grossCYearly = grossBYearly + employerContributionsYearly;

    // Validate: Gross C should match monthlyCTC/annualCTC (with small tolerance for rounding)
    const tolerance = 1; // Allow 1 rupee difference for rounding
    if (Math.abs(grossCMonthly - monthlyCTC) > tolerance) {
        console.warn(`[SALARY_CALC] Gross C (${grossCMonthly}) does not match monthlyCTC (${monthlyCTC})`);
    }

    // 6. Calculate Take Home (Gross A - Employee Deductions)
    // Employee Deductions = PRE_TAX + POST_TAX (all employee deductions)
    const employeeDeductionsMonthly = employeeDeductions.reduce((sum, ed) => sum + (ed.monthlyAmount || 0), 0);
    const employeeDeductionsYearly = employeeDeductions.reduce((sum, ed) => sum + (ed.annualAmount || 0), 0);
    
    const takeHomeMonthly = Math.round((grossAMonthlyRounded - employeeDeductionsMonthly) * 100) / 100;
    const takeHomeYearly = Math.round((grossAYearlyRounded - employeeDeductionsYearly) * 100) / 100;

    // 7. Prepare earnings array (with monthly and annual amounts)
    const earningsArray = earnings.map(e => ({
        name: e.name,
        monthlyAmount: e.monthlyAmount || 0,
        annualAmount: e.annualAmount || 0
    }));

    // 8. Prepare employer contributions array
    const employerContributionsArray = employerDeductions.map(ed => ({
        name: ed.name,
        monthlyAmount: ed.monthlyAmount || 0,
        annualAmount: ed.annualAmount || 0
    }));

    // 9. Prepare employee deductions array (with category)
    const employeeDeductionsArray = employeeDeductions.map(ed => ({
        name: ed.name,
        monthlyAmount: ed.monthlyAmount || 0,
        annualAmount: ed.annualAmount || 0,
        category: ed.category || 'PRE_TAX'
    }));

    // Return complete breakdown
    return {
        salaryTemplateId: salaryTemplate._id,
        earnings: earningsArray,
        employerContributions: employerContributionsArray,
        employeeDeductions: employeeDeductionsArray,
        grossA: {
            monthly: grossAMonthlyRounded,
            yearly: grossAYearlyRounded
        },
        grossB: {
            monthly: Math.round(grossBMonthly * 100) / 100,
            yearly: Math.round(grossBYearly * 100) / 100
        },
        grossC: {
            monthly: Math.round(grossCMonthly * 100) / 100,
            yearly: Math.round(grossCYearly * 100) / 100
        },
        takeHome: {
            monthly: takeHomeMonthly,
            yearly: takeHomeYearly
        },
        gratuity: {
            monthly: gratuityMonthly,
            yearly: gratuityYearly
        },
        ctc: {
            monthly: monthlyCTC,
            yearly: annualCTC
        },
        calculatedAt: new Date()
    };
}

/**
 * Legacy interface adapter: calculateSalaryStructure
 * Bridges old controller interface to new calculateCompleteSalaryBreakdown
 * @param {Number} annualCTC
 * @param {Array} earningsInput
 * @param {Object} settings
 * @param {Array} deductionsInput
 * @param {Array} benefitsInput
 * @param {Object} tenantDB
 * @param {String} tenantId
 */
async function calculateSalaryStructure(annualCTC, earningsInput, settings, deductionsInput, benefitsInput, tenantDB, tenantId) {
    // Build a mock salary template object from inputs
    const mockTemplate = {
        _id: null,
        annualCTC,
        monthlyCTC: Math.round((annualCTC / 12) * 100) / 100,
        earnings: earningsInput || [],
        employerDeductions: benefitsInput || [],
        employeeDeductions: deductionsInput || [],
        settings: settings || {}
    };

    // Calculate using the new function
    const result = calculateCompleteSalaryBreakdown(mockTemplate);

    // Transform result to match legacy expected structure
    return {
        annualCTC,
        monthlyCTC: result.ctc.monthly,
        earnings: result.earnings || earningsInput || [],
        employerContributions: result.employerContributions || benefitsInput || [],
        employeeDeductions: result.employeeDeductions || deductionsInput || [],
        ...result
    };
}

module.exports = {
    calculateCompleteSalaryBreakdown,
    calculateSalaryStructure
};

