/**
 * StatutoryDeductions.js
 * 
 * Professional Indian Payroll Engine - Statutory Deductions Module
 * Implements Employee PF and Employee ESI calculation with strict legal compliance
 * 
 * Follows:
 * - EPFO (Employee Provident Fund Organization) regulations
 * - ESIC (Employee State Insurance Corporation) guidelines
 * - Indian labor law requirements
 */

const DECIMAL_PLACES = 2;

/**
 * Configuration object for statutory deductions
 * Can be customized per organization or state
 */
const DEFAULT_CONFIG = {
    // Employee Provident Fund (EPF) Configuration
    pfEnabled: true,
    pfWageCeilingEnabled: true,
    pfWageCeilingLimit: 15000,
    pfEmployeeRate: 0.12,  // 12%
    
    // Employee State Insurance (ESI) Configuration
    esiEnabled: true,
    esiEmployeeRate: 0.0075,    // 0.75%
    esiEmployerRate: 0.0325,    // 3.25%
    esiEligibilityLimit: 21000,
    
    // Validation
    validateInputs: true,
    throwOnInvalidInputs: true
};

class StatutoryDeductions {
    /**
     * Constructor
     * @param {Object} config - Custom configuration (merges with defaults)
     */
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this._validateConfiguration();
    }

    /**
     * Validate configuration object
     * @private
     */
    _validateConfiguration() {
        if (typeof this.config.pfEnabled !== 'boolean') {
            throw new Error('pfEnabled must be boolean');
        }
        if (typeof this.config.pfWageCeilingEnabled !== 'boolean') {
            throw new Error('pfWageCeilingEnabled must be boolean');
        }
        if (this.config.pfEmployeeRate < 0 || this.config.pfEmployeeRate > 1) {
            throw new Error('pfEmployeeRate must be between 0 and 1');
        }
        if (this.config.esiEmployeeRate < 0 || this.config.esiEmployeeRate > 1) {
            throw new Error('esiEmployeeRate must be between 0 and 1');
        }
        if (this.config.esiEmployerRate < 0 || this.config.esiEmployerRate > 1) {
            throw new Error('esiEmployerRate must be between 0 and 1');
        }
    }

    /**
     * Precision rounding to 2 decimal places
     * @private
     * @param {number} value - Value to round
     * @returns {number} Rounded value
     */
    _round(value) {
        return Math.round(value * 100) / 100;
    }

    /**
     * Validate input parameters
     * @private
     * @param {number} monthlyBasic - Monthly basic salary
     * @param {number} monthlyGross - Monthly gross salary
     * @throws {Error} If validation fails and throwOnInvalidInputs is true
     */
    _validateInputs(monthlyBasic, monthlyGross) {
        const errors = [];

        if (typeof monthlyBasic !== 'number' || monthlyBasic < 0) {
            errors.push(`monthlyBasic must be a non-negative number, got ${monthlyBasic}`);
        }
        if (typeof monthlyGross !== 'number' || monthlyGross < 0) {
            errors.push(`monthlyGross must be a non-negative number, got ${monthlyGross}`);
        }
        if (monthlyGross < monthlyBasic) {
            errors.push(`monthlyGross (${monthlyGross}) cannot be less than monthlyBasic (${monthlyBasic})`);
        }

        if (errors.length > 0 && this.config.validateInputs) {
            const message = `Validation Error:\n${errors.join('\n')}`;
            if (this.config.throwOnInvalidInputs) {
                throw new Error(message);
            }
            console.warn(message);
        }

        return errors.length === 0;
    }

    /**
     * Calculate Employee PF (Provident Fund)
     * 
     * Rules:
     * - PF must ALWAYS be calculated on BASIC only, never on Gross
     * - If wage ceiling is enabled, cap must be strictly enforced
     * - Rate is always 12% of the base
     * 
     * @param {number} monthlyBasic - Monthly basic salary
     * @returns {Object} { employeePF, employerPF, pfBase, wageCeilingApplied }
     */
    calculatePF(monthlyBasic) {
        // Rule 1: Check if PF is enabled
        if (!this.config.pfEnabled) {
            console.log('[PF] Calculation skipped - PF disabled');
            return {
                employeePF: 0,
                employerPF: 0,
                pfBase: 0,
                wageCeilingApplied: false,
                enabled: false
            };
        }

        // Validate input
        if (typeof monthlyBasic !== 'number' || monthlyBasic < 0) {
            throw new Error(`Invalid monthlyBasic: ${monthlyBasic}`);
        }

        // Rule 2: Determine PF base (apply ceiling if enabled)
        let pfBase = monthlyBasic;
        let wageCeilingApplied = false;

        if (this.config.pfWageCeilingEnabled && monthlyBasic > this.config.pfWageCeilingLimit) {
            pfBase = this.config.pfWageCeilingLimit;
            wageCeilingApplied = true;
            console.log(
                `[PF] Wage ceiling applied: Basic ${monthlyBasic} → ${pfBase}`
            );
        }

        // Rule 3: Calculate Employee PF
        const employeePF = this._round(pfBase * this.config.pfEmployeeRate);

        // Employer PF (same rate as employee)
        const employerPF = this._round(pfBase * this.config.pfEmployeeRate);

        // Rule 4: Validation check
        const maxPF = this._round(this.config.pfWageCeilingLimit * this.config.pfEmployeeRate);
        if (employeePF > maxPF && this.config.pfWageCeilingEnabled) {
            console.warn(
                `[PF] Warning: Employee PF (${employeePF}) exceeds max (${maxPF})`
            );
        }

        console.log(
            `[PF] Base: ${pfBase} | Employee: ${employeePF} | Employer: ${employerPF}`
        );

        return {
            employeePF,
            employerPF,
            pfBase,
            wageCeilingApplied,
            enabled: true
        };
    }

    /**
     * Calculate Employee ESI (Employee State Insurance)
     * 
     * Rules:
     * - ESI must ALWAYS be calculated on GROSS salary
     * - ESI eligibility must be checked BEFORE calculation
     * - If Gross > ₹21,000, employee is NOT eligible for ESI
     * - Rate is 0.75% for employee, 3.25% for employer
     * 
     * @param {number} monthlyGross - Monthly gross salary
     * @returns {Object} { employeeESI, employerESI, eligible, grossUsed }
     */
    calculateESI(monthlyGross) {
        // Rule 1: Check if ESI is enabled
        if (!this.config.esiEnabled) {
            console.log('[ESI] Calculation skipped - ESI disabled');
            return {
                employeeESI: 0,
                employerESI: 0,
                eligible: false,
                grossUsed: 0,
                enabled: false,
                reason: 'ESI disabled in configuration'
            };
        }

        // Validate input
        if (typeof monthlyGross !== 'number' || monthlyGross < 0) {
            throw new Error(`Invalid monthlyGross: ${monthlyGross}`);
        }

        // Rule 2: Check ESI eligibility (Gross <= 21,000)
        if (monthlyGross > this.config.esiEligibilityLimit) {
            console.log(
                `[ESI] Not eligible: Gross (${monthlyGross}) exceeds limit (${this.config.esiEligibilityLimit})`
            );
            return {
                employeeESI: 0,
                employerESI: 0,
                eligible: false,
                grossUsed: monthlyGross,
                enabled: true,
                reason: `Gross salary exceeds ₹${this.config.esiEligibilityLimit} limit`
            };
        }

        // Rule 2 (continued): If eligible, calculate ESI
        const employeeESI = this._round(monthlyGross * this.config.esiEmployeeRate);
        const employerESI = this._round(monthlyGross * this.config.esiEmployerRate);

        // Rule 3: Validation check - ESI must be exactly 0.75% of gross
        const expectedESI = this._round(monthlyGross * 0.0075);
        if (Math.abs(employeeESI - expectedESI) > 0.01) {
            console.warn(
                `[ESI] Calculation discrepancy: Got ${employeeESI}, Expected ${expectedESI}`
            );
        }

        console.log(
            `[ESI] Eligible | Gross: ${monthlyGross} | Employee: ${employeeESI} | Employer: ${employerESI}`
        );

        return {
            employeeESI,
            employerESI,
            eligible: true,
            grossUsed: monthlyGross,
            enabled: true,
            reason: 'Employee eligible for ESI'
        };
    }

    /**
     * Calculate all statutory deductions (PF + ESI)
     * 
     * @param {number} monthlyBasic - Monthly basic salary
     * @param {number} monthlyGross - Monthly gross salary
     * @returns {Object} Complete deduction breakdown
     */
    calculate(monthlyBasic, monthlyGross) {
        // Validate inputs
        if (this.config.validateInputs) {
            this._validateInputs(monthlyBasic, monthlyGross);
        }

        console.log('\n=== STATUTORY DEDUCTIONS CALCULATION ===');
        console.log(`Input | Basic: ${monthlyBasic} | Gross: ${monthlyGross}`);

        // Calculate PF
        const pfResult = this.calculatePF(monthlyBasic);

        // Calculate ESI
        const esiResult = this.calculateESI(monthlyGross);

        // Combined result
        const result = {
            success: true,
            monthly: {
                gross: monthlyGross,
                basic: monthlyBasic
            },
            deductions: {
                employeePF: pfResult.employeePF,
                employeeESI: esiResult.employeeESI,
                total: this._round(pfResult.employeePF + esiResult.employeeESI)
            },
            contributions: {
                employerPF: pfResult.employerPF,
                employerESI: esiResult.employerESI,
                total: this._round(pfResult.employerPF + esiResult.employerESI)
            },
            breakdown: {
                pf: pfResult,
                esi: esiResult
            },
            validation: {
                pfValid: pfResult.employeePF >= 0 && pfResult.employeePF <= 1800,
                esiValid: esiResult.employeeESI >= 0,
                totalValid: (pfResult.employeePF + esiResult.employeeESI) <= monthlyGross
            }
        };

        console.log(`\nSummary:`);
        console.log(`- Employee Deductions: ₹${result.deductions.total}`);
        console.log(`- Employer Contributions: ₹${result.contributions.total}`);
        console.log(`- Validation: ${result.validation.pfValid && result.validation.esiValid ? '✓' : '✗'}`);
        console.log('==========================================\n');

        return result;
    }

    /**
     * Batch calculate deductions for multiple employees
     * 
     * @param {Array} employees - Array of { basic, gross } objects
     * @returns {Array} Array of calculation results
     */
    calculateBatch(employees) {
        if (!Array.isArray(employees)) {
            throw new Error('employees must be an array');
        }

        console.log(`\n[BATCH] Processing ${employees.length} employees...`);
        
        const results = employees.map((emp, index) => {
            try {
                return {
                    index,
                    ...emp,
                    deductions: this.calculate(emp.basic, emp.gross)
                };
            } catch (err) {
                return {
                    index,
                    ...emp,
                    error: err.message,
                    deductions: null
                };
            }
        });

        const successful = results.filter(r => !r.error).length;
        console.log(`[BATCH] Completed: ${successful}/${employees.length} successful\n`);

        return results;
    }

    /**
     * Get current configuration
     * @returns {Object} Current config
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this._validateConfiguration();
        console.log('[CONFIG] Updated statutory deductions configuration');
    }

    /**
     * Generate compliance report
     * @param {number} monthlyBasic - Monthly basic
     * @param {number} monthlyGross - Monthly gross
     * @returns {string} Formatted compliance report
     */
    generateComplianceReport(monthlyBasic, monthlyGross) {
        const result = this.calculate(monthlyBasic, monthlyGross);

        const report = `
╔══════════════════════════════════════════════╗
║    STATUTORY DEDUCTIONS COMPLIANCE REPORT    ║
╚══════════════════════════════════════════════╝

EMPLOYEE PROVIDENT FUND (EPF)
────────────────────────────
• Status: ${result.breakdown.pf.enabled ? '✓ Active' : '✗ Disabled'}
• Basic Salary: ₹${monthlyBasic}
• PF Base: ₹${result.breakdown.pf.pfBase}
• Wage Ceiling Applied: ${result.breakdown.pf.wageCeilingApplied ? 'Yes' : 'No'}
• Employee PF (12%): ₹${result.deductions.employeePF}
• Employer PF (12%): ₹${result.contributions.employerPF}

EMPLOYEE STATE INSURANCE (ESI)
──────────────────────────────
• Status: ${result.breakdown.esi.enabled ? '✓ Active' : '✗ Disabled'}
• Gross Salary: ₹${monthlyGross}
• Eligibility Limit: ₹${this.config.esiEligibilityLimit}
• Eligible: ${result.breakdown.esi.eligible ? 'Yes' : 'No'}
• Reason: ${result.breakdown.esi.reason}
• Employee ESI (0.75%): ₹${result.deductions.employeeESI}
• Employer ESI (3.25%): ₹${result.contributions.employerESI}

MONTHLY SUMMARY
───────────────
• Total Employee Deductions: ₹${result.deductions.total}
• Total Employer Contributions: ₹${result.contributions.total}
• Grand Total (Employee + Employer): ₹${this._round(result.deductions.total + result.contributions.total)}

VALIDATION
──────────
• PF Calculation: ${result.validation.pfValid ? '✓ Valid' : '✗ Invalid'}
• ESI Calculation: ${result.validation.esiValid ? '✓ Valid' : '✗ Invalid'}
• Total Deductions <= Gross: ${result.validation.totalValid ? '✓ Valid' : '✗ Invalid'}

ANNUAL PROJECTION
─────────────────
• Annual Employee PF Deductions: ₹${this._round(result.deductions.employeePF * 12)}
• Annual Employee ESI Deductions: ₹${this._round(result.deductions.employeeESI * 12)}
• Annual Employer PF Contributions: ₹${this._round(result.contributions.employerPF * 12)}
• Annual Employer ESI Contributions: ₹${this._round(result.contributions.employerESI * 12)}

Generated: ${new Date().toISOString()}
`;
        return report;
    }
}

module.exports = StatutoryDeductions;
