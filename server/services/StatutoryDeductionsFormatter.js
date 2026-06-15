/**
 * STATUTORY_DEDUCTIONS_FORMATTER.js
 * 
 * Formats StatutoryDeductions output with proper 'basedOn' values
 * for EmployeeSalarySnapshot schema
 */

/**
 * Convert StatutoryDeductions result to EmployeeSalarySnapshot format
 * 
 * @param {Object} deductionsResult - Output from StatutoryDeductions.calculate()
 * @returns {Array} Formatted employeeDeductions array
 */
function formatStatutoryDeductions(deductionsResult) {
    if (!deductionsResult || !deductionsResult.success === false) {
        return [];
    }

    const formatted = [];

    // Employee PF (based on BASIC salary)
    if (deductionsResult.deductions.employeePF > 0) {
        formatted.push({
            code: 'EMPLOYEE_PF',
            name: 'Employee Provident Fund',
            calculationType: 'PERCENTAGE',
            value: 12, // 12% of basic
            basedOn: 'BASIC', // ✅ PF is calculated on BASIC
            monthlyAmount: deductionsResult.deductions.employeePF,
            yearlyAmount: deductionsResult.deductions.employeePF * 12
        });
    }

    // Employee ESI (based on GROSS salary)
    if (deductionsResult.deductions.employeeESI > 0) {
        formatted.push({
            code: 'EMPLOYEE_ESI',
            name: 'Employee State Insurance',
            calculationType: 'PERCENTAGE',
            value: 0.75, // 0.75% of gross
            basedOn: 'GROSS', // ✅ ESI is calculated on GROSS
            monthlyAmount: deductionsResult.deductions.employeeESI,
            yearlyAmount: deductionsResult.deductions.employeeESI * 12
        });
    }

    // Professional Tax (flat amount)
    if (deductionsResult.deductions.employeeESI !== undefined) {
        formatted.push({
            code: 'PROFESSIONAL_TAX',
            name: 'Professional Tax',
            calculationType: 'FLAT',
            value: 200, // ₹200 per month
            basedOn: 'NA', // Fixed amount
            monthlyAmount: 200,
            yearlyAmount: 2400
        });
    }

    return formatted;
}

/**
 * Format employer contributions for EmployerDeductions or Breakdown
 * 
 * @param {Object} deductionsResult - Output from StatutoryDeductions.calculate()
 * @returns {Array} Formatted employer contributions
 */
function formatEmployerContributions(deductionsResult) {
    if (!deductionsResult || !deductionsResult.contributions) {
        return [];
    }

    const formatted = [];

    // Employer PF
    if (deductionsResult.contributions.employerPF > 0) {
        formatted.push({
            code: 'EMPLOYER_PF',
            name: 'Employer Provident Fund',
            calculationType: 'PERCENTAGE',
            value: 12,
            basedOn: 'BASIC',
            monthlyAmount: deductionsResult.contributions.employerPF,
            yearlyAmount: deductionsResult.contributions.employerPF * 12
        });
    }

    // Employer ESI
    if (deductionsResult.contributions.employerESI > 0) {
        formatted.push({
            code: 'EMPLOYER_ESI',
            name: 'Employer State Insurance',
            calculationType: 'PERCENTAGE',
            value: 3.25,
            basedOn: 'GROSS',
            monthlyAmount: deductionsResult.contributions.employerESI,
            yearlyAmount: deductionsResult.contributions.employerESI * 12
        });
    }

    return formatted;
}

/**
 * Integration Example: Complete Salary Snapshot with Statutory Deductions
 */
class EnhancedSalaryController {
    /**
     * Calculate and save salary with statutory deductions
     */
    static async calculateSalaryWithDeductions(basicStructure, StatutoryDeductions, req) {
        try {
            // Extract monthly base values from basic structure
            const monthlyBasic = basicStructure.breakdown.earnings.basic;
            const monthlyGross = basicStructure.breakdown.earnings.total;

            // Calculate statutory deductions
            const deductionsEngine = new StatutoryDeductions();
            const deductionsResult = deductionsEngine.calculate(monthlyBasic, monthlyGross);

            if (!deductionsResult.success === false) {
                throw new Error('Deduction calculation failed');
            }

            // Format for database
            const formattedDeductions = formatStatutoryDeductions(deductionsResult);
            const formattedContributions = formatEmployerContributions(deductionsResult);

            // Merge with basic structure
            const enrichedSnapshot = {
                ...basicStructure,
                employeeDeductions: [
                    ...(basicStructure.employeeDeductions || []),
                    ...formattedDeductions
                ],
                employerContributions: formattedContributions,
                breakdown: {
                    ...basicStructure.breakdown,
                    totalDeductions: (basicStructure.breakdown.totalDeductions || 0) + deductionsResult.deductions.total
                }
            };

            return enrichedSnapshot;
        } catch (err) {
            console.error('Error calculating salary with deductions:', err);
            return null;
        }
    }
}

module.exports = {
    formatStatutoryDeductions,
    formatEmployerContributions,
    EnhancedSalaryController
};
