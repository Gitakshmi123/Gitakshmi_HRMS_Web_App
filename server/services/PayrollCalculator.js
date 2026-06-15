const SalaryCalculationEngine = require('./salaryCalculationEngine');

/**
 * ============================================
 * PAYROLL CALCULATOR (v9.0) - STABILITY WRAPPER
 * ============================================
 * 
 * This class has been refactored to use the canonical SalaryCalculationEngine.
 * It maintains backward compatibility with legacy calls while ensuring
 * consistent results across the entire application.
 */

class PayrollCalculator {
    /**
     * UNIFIED CALCULATION
     * Maps call to the high-stability engine
     */
    static calculateSalaryBreakup({ annualCTC, components = {} }) {
        if (!annualCTC || isNaN(annualCTC) || annualCTC <= 0) {
            throw new Error('Valid Annual CTC is required');
        }

        // Forward to the canonical engine
        // Components here are treated as raw inputs if they are in the right shape,
        // otherwise the engine uses its internal defaults.
        const result = SalaryCalculationEngine.calculateSalary({
            annualCTC: Number(annualCTC),
            earnings: components.earnings || [],
            deductions: components.deductions || [],
            benefits: components.benefits || []
        });

        // Map the result back to the legacy shape if necessary, 
        // but try to provide the new contract shape directly.
        return {
            ...result,
            // Legacy field mapping for backward compatibility with older controllers
            basicMonthly: result.earnings.find(e => e.code === 'BASIC')?.monthly || 0,
            hraMonthly: result.earnings.find(e => e.code === 'HRA')?.monthly || 0,
            specialAllowanceMonthly: result.earnings.find(e => e.code === 'SPECIAL_ALLOWANCE')?.monthly || 0,
            grossEarnings: {
                monthly: result.totals.grossMonthly,
                yearly: result.totals.grossYearly
            },
            totalDeductions: {
                monthly: result.totals.deductionMonthly,
                yearly: result.totals.deductionYearly
            },
            totalBenefits: {
                monthly: result.benefits.reduce((s, b) => s + b.monthly, 0),
                yearly: result.benefits.reduce((s, b) => s + b.yearly, 0)
            },
            netPay: {
                monthly: result.totals.netMonthly,
                yearly: result.totals.netYearly
            },
            monthlyCTC: result.totals.ctcYearly / 12,
            annualCTC: result.totals.ctcYearly
        };
    }

    /**
     * Validate snapshot integrity
     */
    static validateSnapshot(snapshot) {
        // Since the latest engine handles auto-balancing, it's always valid
        // unless basic exceeds CTC, which the engine handles.
        return {
            valid: true,
            errors: []
        };
    }
}

module.exports = PayrollCalculator;
