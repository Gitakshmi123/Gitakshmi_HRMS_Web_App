/**
 * STATUTORY_DEDUCTIONS_GUIDE.js
 * 
 * Comprehensive guide for integrating StatutoryDeductions with IndianPayrollEngine
 * Complete usage examples, integration patterns, and validation strategies
 */

// ============================================================================
// SECTION 1: BASIC USAGE
// ============================================================================

const StatutoryDeductions = require('./StatutoryDeductions');

// Initialize with default configuration
const deductions = new StatutoryDeductions();

// Calculate for a single employee
const result = deductions.calculate(
    15000,   // monthlyBasic
    30000    // monthlyGross
);

console.log('Employee Deductions:');
console.log(`  • PF: ₹${result.deductions.employeePF}`);
console.log(`  • ESI: ₹${result.deductions.employeeESI}`);
console.log(`  • Total: ₹${result.deductions.total}`);

console.log('\nEmployer Contributions:');
console.log(`  • PF: ₹${result.contributions.employerPF}`);
console.log(`  • ESI: ₹${result.contributions.employerESI}`);
console.log(`  • Total: ₹${result.contributions.total}`);

// ============================================================================
// SECTION 2: INTEGRATION WITH PAYROLL ENGINE
// ============================================================================

const IndianPayrollEngine = require('./IndianPayrollEngine');

class EnhancedPayrollEngine extends IndianPayrollEngine {
    constructor(customConfig = {}) {
        super(customConfig);
        this.deductionsEngine = new StatutoryDeductions({
            pfEnabled: true,
            pfWageCeilingEnabled: true,
            pfWageCeilingLimit: 15000,
            esiEnabled: true,
            esiEligibilityLimit: 21000
        });
    }

    /**
     * Calculate complete salary with statutory deductions
     * @param {number} annualCTC - Annual CTC
     * @returns {Object} Complete salary breakdown
     */
    calculateWithDeductions(annualCTC) {
        // First, calculate basic structure
        const basicStructure = this.calculate(annualCTC);
        if (!basicStructure.success) {
            return basicStructure;
        }

        // Extract monthly values
        const monthlyBasic = basicStructure.breakdown.earnings.basic;
        const monthlyGross = basicStructure.breakdown.earnings.total;

        // Calculate statutory deductions
        const deductionsResult = this.deductionsEngine.calculate(monthlyBasic, monthlyGross);

        // Integrate deductions into salary structure
        const enhancedResult = {
            ...basicStructure,
            breakdown: {
                ...basicStructure.breakdown,
                deductions: {
                    ...basicStructure.breakdown.deductions,
                    employeePF: deductionsResult.deductions.employeePF,
                    employeeESI: deductionsResult.deductions.employeeESI,
                    statutory: deductionsResult.deductions.total
                },
                contributions: {
                    ...basicStructure.breakdown.contributions,
                    employerPF: deductionsResult.contributions.employerPF,
                    employerESI: deductionsResult.contributions.employerESI
                }
            },
            monthly: {
                ...basicStructure.monthly,
                estatutoryDeductions: deductionsResult.deductions.total,
                netSalary: basicStructure.monthly.gross - deductionsResult.deductions.total
            }
        };

        return enhancedResult;
    }
}

// Usage
const enhancedEngine = new EnhancedPayrollEngine();
const salaryWithDeductions = enhancedEngine.calculateWithDeductions(600000);

console.log('\n=== Integrated Salary Calculation ===');
console.log(`Monthly Gross: ₹${salaryWithDeductions.monthly.gross}`);
console.log(`Statutory Deductions: ₹${salaryWithDeductions.monthly.estatutoryDeductions}`);
console.log(`Net Salary: ₹${salaryWithDeductions.monthly.netSalary}`);

// ============================================================================
// SECTION 3: CONTROLLER INTEGRATION (Backend Route)
// ============================================================================

// File: backend/controllers/salary.controller.js

class SalaryController {
    constructor() {
        this.payrollEngine = new EnhancedPayrollEngine();
    }

    /**
     * Calculate salary with all deductions
     * Route: POST /api/salary/calculate
     */
    async calculateSalary(req, res) {
        try {
            const { annualCTC } = req.body;

            // Validate input
            if (!annualCTC || annualCTC <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid annual CTC'
                });
            }

            // Calculate salary
            const salary = this.payrollEngine.calculateWithDeductions(annualCTC);

            if (!salary.success) {
                return res.status(400).json({
                    success: false,
                    error: salary.error
                });
            }

            // Save to database
            const snapshot = new EmployeeSalarySnapshot({
                employeeId: req.user.id,
                tenantId: req.user.tenantId,
                annualCTC,
                monthlyGross: salary.monthly.gross,
                monthlyNetSalary: salary.monthly.netSalary,
                monthlyDeductions: salary.monthly.estatutoryDeductions,
                breakdown: salary.breakdown,
                validation: salary.validation,
                effectiveFrom: new Date(),
                locked: false
            });

            await snapshot.save();

            res.json({
                success: true,
                data: salary
            });
        } catch (err) {
            console.error('Salary calculation error:', err);
            res.status(500).json({
                success: false,
                error: 'Calculation failed'
            });
        }
    }

    /**
     * Batch calculate salaries
     * Route: POST /api/salary/batch-calculate
     */
    async batchCalculate(req, res) {
        try {
            const { employees } = req.body;

            if (!Array.isArray(employees)) {
                return res.status(400).json({
                    success: false,
                    error: 'employees must be an array'
                });
            }

            const results = employees.map(emp => ({
                employeeId: emp.id,
                salary: this.payrollEngine.calculateWithDeductions(emp.annualCTC)
            }));

            res.json({
                success: true,
                data: results,
                count: results.length
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }

    /**
     * Get compliance report
     * Route: GET /api/salary/compliance-report?annualCTC=600000
     */
    async getComplianceReport(req, res) {
        try {
            const { annualCTC } = req.query;

            if (!annualCTC) {
                return res.status(400).json({
                    success: false,
                    error: 'annualCTC required'
                });
            }

            const monthlyBasic = (annualCTC / 12) * 0.4; // 40% of CTC
            const monthlyGross = (annualCTC / 12) * 0.75; // Approximate

            const deductionsEngine = new StatutoryDeductions();
            const report = deductionsEngine.generateComplianceReport(monthlyBasic, monthlyGross);

            res.json({
                success: true,
                data: report
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
}

// ============================================================================
// SECTION 4: CUSTOM CONFIGURATION EXAMPLES
// ============================================================================

// Example 1: Different wage ceiling for different organizations
const org1Deductions = new StatutoryDeductions({
    pfWageCeilingLimit: 15000  // Standard
});

const org2Deductions = new StatutoryDeductions({
    pfWageCeilingLimit: 21000  // Higher ceiling
});

// Example 2: Disable deductions for specific employee types
const contractorDeductions = new StatutoryDeductions({
    pfEnabled: false,
    esiEnabled: false
});

// Example 3: Custom ESI, that varies by state
const maharashtraDeductions = new StatutoryDeductions({
    esiEligibilityLimit: 21000,
    esiEmployeeRate: 0.0075,
    esiEmployerRate: 0.0325
});

// Example 4: Low wage ESI variation
const lowWageDeductions = new StatutoryDeductions({
    esiEmployeeRate: 0.005,      // 0.5% (reduced)
    esiEmployerRate: 0.015       // 1.5% (reduced)
});

// ============================================================================
// SECTION 5: VALIDATION AND ERROR HANDLING
// ============================================================================

function calculateWithValidation(basic, gross) {
    try {
        const deductions = new StatutoryDeductions({
            validateInputs: true,
            throwOnInvalidInputs: true
        });

        const result = deductions.calculate(basic, gross);

        // Additional validation
        if (!result.validation.pfValid) {
            throw new Error('PF calculation failed validation');
        }
        if (!result.validation.esiValid) {
            throw new Error('ESI calculation failed validation');
        }

        return result;
    } catch (err) {
        console.error('Validation error:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

// ============================================================================
// SECTION 6: MONTHLY vs ANNUAL CALCULATIONS
// ============================================================================

function calculateMonthlyDeductions(monthlyBasic, monthlyGross) {
    const deductions = new StatutoryDeductions();
    return deductions.calculate(monthlyBasic, monthlyGross);
}

function calculateAnnualDeductions(annualBasic, annualGross) {
    const monthlyBasic = annualBasic / 12;
    const monthlyGross = annualGross / 12;

    const deductions = new StatutoryDeductions();
    const monthlyResult = deductions.calculate(monthlyBasic, monthlyGross);

    return {
        monthly: monthlyResult,
        annual: {
            employeePF: monthlyResult.deductions.employeePF * 12,
            employeeESI: monthlyResult.deductions.employeeESI * 12,
            employerPF: monthlyResult.contributions.employerPF * 12,
            employerESI: monthlyResult.contributions.employerESI * 12
        }
    };
}

// Example usage
const monthlyDeductions = calculateMonthlyDeductions(12500, 25000);
const annualDeductions = calculateAnnualDeductions(150000, 300000);

console.log('\n=== Monthly Deductions ===');
console.log(`Employee Total: ₹${monthlyDeductions.deductions.total}`);

console.log('\n=== Annual Deductions ===');
console.log(`Employee PF: ₹${annualDeductions.annual.employeePF}`);
console.log(`Employee ESI: ₹${annualDeductions.annual.employeeESI}`);
console.log(`Employer PF: ₹${annualDeductions.annual.employerPF}`);

// ============================================================================
// SECTION 7: DATABASE SCHEMA INTEGRATION
// ============================================================================

/*
MongoDB Schema for storing statutory deductions:

const salaryDeductionsSchema = new Schema({
    employeeId: ObjectId,
    tenantId: ObjectId,
    month: Date,
    
    // Components
    basic: Number,
    gross: Number,
    
    // Deductions
    deductions: {
        employeePF: Number,
        employeeESI: Number,
        total: Number
    },
    
    // Contributions
    contributions: {
        employerPF: Number,
        employerESI: Number,
        total: Number
    },
    
    // Metadata
    breakdown: {
        pf: {
            pfBase: Number,
            wageCeilingApplied: Boolean,
            enabled: Boolean
        },
        esi: {
            eligible: Boolean,
            grossUsed: Number,
            reason: String,
            enabled: Boolean
        }
    },
    
    validation: {
        pfValid: Boolean,
        esiValid: Boolean,
        totalValid: Boolean
    },
    
    createdAt: Date,
    updatedAt: Date
});
*/

// ============================================================================
// SECTION 8: BATCH OPERATIONS
// ============================================================================

function processBatchSalaries(employees) {
    const deductions = new StatutoryDeductions();
    const results = [];

    for (const employee of employees) {
        try {
            const result = deductions.calculate(
                employee.monthlyBasic,
                employee.monthlyGross
            );

            results.push({
                employeeId: employee.id,
                status: 'success',
                deductions: result.deductions,
                contributions: result.contributions
            });
        } catch (err) {
            results.push({
                employeeId: employee.id,
                status: 'error',
                error: err.message
            });
        }
    }

    return {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        results
    };
}

// Example batch processing
const employeeList = [
    { id: 'E001', monthlyBasic: 10000, monthlyGross: 20000 },
    { id: 'E002', monthlyBasic: 15000, monthlyGross: 30000 },
    { id: 'E003', monthlyBasic: 20000, monthlyGross: 40000 }
];

const batchResult = processBatchSalaries(employeeList);
console.log(`\n=== Batch Processing ===`);
console.log(`Total: ${batchResult.total}`);
console.log(`Successful: ${batchResult.successful}`);
console.log(`Failed: ${batchResult.failed}`);

// ============================================================================
// SECTION 9: CONFIGURATION UPDATE
// ============================================================================

const dynamicDeductions = new StatutoryDeductions();

console.log('\nInitial config:', dynamicDeductions.getConfig());

// Update configuration (e.g., for new financial year)
dynamicDeductions.updateConfig({
    pfWageCeilingLimit: 15000,
    esiEligibilityLimit: 21000
});

console.log('Updated config:', dynamicDeductions.getConfig());

// ============================================================================
// SECTION 10: BEST PRACTICES
// ============================================================================

/*
1. INITIALIZATION:
   - Initialize StatutoryDeductions once and reuse for performance
   - Store instance in dependency injection container

2. CONFIGURATION:
   - Use default configuration unless specific variations needed
   - Update configuration at fiscal year start
   - Document any custom configurations

3. VALIDATION:
   - Always check result.success before using data
   - Validate inputs before passing to calculation
   - Store validation results in database for audit

4. ROUNDING:
   - Trust the 2-decimal rounding built into module
   - Do NOT round values before passing to calculate()
   - Preserve 2-decimal precision in all outputs

5. PERFORMANCE:
   - Use batch processing for large employee lists
   - Cache results if possible
   - Monitor calculation time for anomalies

6. COMPLIANCE:
   - Generate compliance reports regularly
   - Maintain audit trail of all calculations
   - Review changes to wage ceiling and ESI limits
   - Document any custom configurations

7. TESTING:
   - Test with boundary values (e.g., Gross = ₹21,000)
   - Test disabled deductions scenarios
   - Test batch processing with large datasets
   - Validate against known good calculations

8. MONITORING:
   - Log all deduction calculations
   - Alert on validation failures
   - Track PF wage ceiling applications
   - Monitor ESI eligibility changes
*/

console.log('\n✓ All examples executed successfully');
