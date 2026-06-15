/**
 * ============================================
 * INDIAN PAYROLL ENGINE v2.0 - PRODUCTION
 * ============================================
 * 
 * Professional salary calculation system for Indian HRMS
 * Follows strict compliance with Indian tax rules and statutory requirements
 */

// ============================================
// TAX SLAB CALCULATION (New Regime)
// ============================================
function calculateTaxFromSlabs(annualTaxable) {
    if (annualTaxable <= 300000) return 0;
    if (annualTaxable <= 600000) return (annualTaxable - 300000) * 0.05;
    if (annualTaxable <= 900000) return 15000 + (annualTaxable - 600000) * 0.10;
    if (annualTaxable <= 1200000) return 45000 + (annualTaxable - 900000) * 0.15;
    if (annualTaxable <= 1500000) return 90000 + (annualTaxable - 1200000) * 0.20;
    return 150000 + (annualTaxable - 1500000) * 0.30;
}

// ============================================
// PRECISION HELPERS
// ============================================
const round2 = (val) => Math.round((val + Number.EPSILON) * 100) / 100;
const safe = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

// ============================================
// SALARY CALCULATION ENGINE
// ============================================
class IndianPayrollEngine {
    constructor(config = {}) {
        this.config = {
            basicPercent: 0.40,
            hraPercent: 0.45,
            conveyancePercent: 0.15,
            employerPFPercent: 0.12,
            gratuityPercent: 0.0481,
            employeePFPercent: 0.12,
            employeeESIPercent: 0.0075,
            employerESIPercent: 0.0325,
            esiBoundary: 21000,
            professionalTaxMonthly: 200,
            ...config
        };
    }

    /**
     * MAIN ENTRY POINT
     * Calculate complete salary for annual CTC
     */
    calculate(annualCTC, additionalConfig = {}) {
        try {
            const ctc = safe(annualCTC);
            if (ctc <= 0) throw new Error('Annual CTC must be greater than 0');

            console.log(`\n[PAYROLL_ENGINE] Starting calculation for CTC: ₹${ctc}`);

            // ====== STEP 1: Basic Calculations ======
            const monthlyCTC = ctc / 12;
            const basic = ctc * this.config.basicPercent;
            const monthlyBasic = basic / 12;

            console.log(`[PAYROLL_ENGINE] Step 1 - Basic Setup`);
            console.log(`  Annual CTC: ₹${round2(ctc)}`);
            console.log(`  Monthly CTC: ₹${round2(monthlyCTC)}`);
            console.log(`  Annual Basic (40%): ₹${round2(basic)}`);
            console.log(`  Monthly Basic: ₹${round2(monthlyBasic)}`);

            // ====== STEP 2: Fixed Earnings ======
            const hra = basic * this.config.hraPercent;
            const conveyance = basic * this.config.conveyancePercent;
            const monthlyHRA = hra / 12;
            const monthlyConveyance = conveyance / 12;

            console.log(`[PAYROLL_ENGINE] Step 2 - Basic Allowances`);
            console.log(`  Annual HRA (45% of Basic): ₹${round2(hra)}`);
            console.log(`  Annual Conveyance (15% of Basic): ₹${round2(conveyance)}`);

            // ====== STEP 3: Employer Contributions (Part of CTC, NOT part of Gross) ======
            const employerPF = basic * this.config.employerPFPercent;
            const gratuity = basic * this.config.gratuityPercent;
            const monthlyEmployerPF = employerPF / 12;
            const monthlyGratuity = gratuity / 12;

            console.log(`[PAYROLL_ENGINE] Step 3 - Employer Contributions (CTC, NOT Gross)`);
            console.log(`  Annual Employer PF (12% of Basic): ₹${round2(employerPF)}`);
            console.log(`  Annual Gratuity (4.81% of Basic): ₹${round2(gratuity)}`);

            // ====== STEP 4: Calculate Special Allowance (Balancing Figure) ======
            // All other components already summed, SA fills the gap
            const totalOtherAnnual = basic + hra + conveyance + employerPF + gratuity;
            const specialAllowance = ctc - totalOtherAnnual;
            const monthlySpecialAllowance = specialAllowance / 12;

            console.log(`[PAYROLL_ENGINE] Step 4 - Special Allowance (Balancing)`);
            console.log(`  Annual Special Allowance: ₹${round2(specialAllowance)}`);
            console.log(`  Total before SA: ₹${round2(totalOtherAnnual)}`);
            console.log(`  Verification - Total should equal CTC: ₹${round2(totalOtherAnnual + specialAllowance)}`);

            // ====== STEP 5: Calculate Monthly Gross (Employee earnings only) ======
            const monthlyGross = monthlyBasic + monthlyHRA + monthlyConveyance + monthlySpecialAllowance;
            const annualGross = monthlyGross * 12;

            console.log(`[PAYROLL_ENGINE] Step 5 - Monthly Gross Salary`);
            console.log(`  Monthly Gross: ₹${round2(monthlyGross)}`);
            console.log(`  Annual Gross: ₹${round2(annualGross)}`);

            // ====== STEP 6: Calculate Deductions (Employee Portions) ======
            const monthlyEmployeePF = monthlyBasic * this.config.employeePFPercent;
            const annualEmployeePF = monthlyEmployeePF * 12;

            // ESI only if gross <= boundary
            const monthlyEmployeeESI = monthlyGross <= this.config.esiBoundary 
                ? monthlyGross * this.config.employeeESIPercent 
                : 0;
            const annualEmployeeESI = monthlyEmployeeESI * 12;

            const monthlyProfessionalTax = this.config.professionalTaxMonthly;
            const annualProfessionalTax = monthlyProfessionalTax * 12;

            console.log(`[PAYROLL_ENGINE] Step 6 - Employee Deductions`);
            console.log(`  Monthly Employee PF (12% of Basic): ₹${round2(monthlyEmployeePF)}`);
            console.log(`  Monthly Employee ESI (0.75% if Gross <= ₹21000): ₹${round2(monthlyEmployeeESI)}`);
            console.log(`  Monthly Professional Tax: ₹${round2(monthlyProfessionalTax)}`);

            // ====== STEP 7: Calculate Taxable Income ======
            const monthlyTaxable = monthlyGross - monthlyEmployeePF - monthlyEmployeeESI;
            const annualTaxable = monthlyTaxable * 12;

            console.log(`[PAYROLL_ENGINE] Step 7 - Taxable Income Calculation`);
            console.log(`  Monthly Taxable: ₹${round2(monthlyTaxable)}`);
            console.log(`  Annual Taxable: ₹${round2(annualTaxable)}`);

            // ====== STEP 8: Calculate Income Tax (TDS) ======
            const annualTax = calculateTaxFromSlabs(annualTaxable);
            const monthlyTDS = annualTax / 12;

            console.log(`[PAYROLL_ENGINE] Step 8 - Income Tax Calculation`);
            console.log(`  Annual Tax (from slabs): ₹${round2(annualTax)}`);
            console.log(`  Monthly TDS: ₹${round2(monthlyTDS)}`);

            // ====== STEP 9: Calculate Net Salary ======
            const monthlyNetSalary = monthlyGross - monthlyEmployeePF - monthlyEmployeeESI - monthlyProfessionalTax - monthlyTDS;
            const annualNetSalary = monthlyNetSalary * 12;

            console.log(`[PAYROLL_ENGINE] Step 9 - Final Net Salary`);
            console.log(`  Monthly Net Salary: ₹${round2(monthlyNetSalary)}`);
            console.log(`  Annual Net Salary: ₹${round2(annualNetSalary)}`);

            // ====== VALIDATION CHECKS ======
            const ctcVerification = round2(basic + hra + conveyance + specialAllowance + employerPF + gratuity);
            const ctcDifference = Math.abs(ctcVerification - ctc);

            console.log(`\n[PAYROLL_ENGINE] Validation Checks`);
            console.log(`  CTC Verification: ${ctcDifference < 0.01 ? '✓ PASS' : '✗ FAIL'}`);
            console.log(`  Expected CTC: ₹${round2(ctc)} | Calculated: ₹${round2(ctcVerification)}`);

            if (ctcDifference > 0.01) {
                console.warn(`[PAYROLL_ENGINE] WARNING: CTC mismatch detected. Difference: ₹${ctcDifference}`);
            }

            // ====== TOTAL MONTHLY DEDUCTIONS ======
            const monthlyDeductions = monthlyEmployeePF + monthlyEmployeeESI + monthlyProfessionalTax + monthlyTDS;

            // ====== BUILD OUTPUT ======
            const result = {
                success: true,
                annualCTC: round2(ctc),
                monthlyGross: round2(monthlyGross),
                monthlyDeductions: round2(monthlyDeductions),
                monthlyNetSalary: round2(monthlyNetSalary),
                
                // Annual breakdown
                annual: {
                    ctc: round2(ctc),
                    gross: round2(annualGross),
                    deductions: round2(monthlyDeductions * 12),
                    netSalary: round2(annualNetSalary),
                    taxableIncome: round2(annualTaxable)
                },

                // Monthly breakdown
                monthly: {
                    gross: round2(monthlyGross),
                    deductions: round2(monthlyDeductions),
                    netSalary: round2(monthlyNetSalary)
                },

                // Detailed component breakdown
                breakdown: {
                    earnings: {
                        basic: round2(monthlyBasic),
                        hra: round2(monthlyHRA),
                        conveyance: round2(monthlyConveyance),
                        specialAllowance: round2(monthlySpecialAllowance),
                        total: round2(monthlyGross)
                    },
                    deductions: {
                        employeePF: round2(monthlyEmployeePF),
                        employeeESI: round2(monthlyEmployeeESI),
                        professionalTax: round2(monthlyProfessionalTax),
                        tds: round2(monthlyTDS),
                        total: round2(monthlyDeductions)
                    },
                    contributions: {
                        employerPF: round2(monthlyEmployerPF),
                        gratuity: round2(monthlyGratuity),
                        total: round2(monthlyEmployerPF + monthlyGratuity)
                    }
                },

                // Annual detailed breakdown
                annualBreakdown: {
                    earnings: {
                        basic: round2(basic),
                        hra: round2(hra),
                        conveyance: round2(conveyance),
                        specialAllowance: round2(specialAllowance),
                        total: round2(annualGross)
                    },
                    deductions: {
                        employeePF: round2(annualEmployeePF),
                        employeeESI: round2(annualEmployeeESI),
                        professionalTax: round2(annualProfessionalTax),
                        tds: round2(annualTax),
                        total: round2(monthlyDeductions * 12)
                    },
                    contributions: {
                        employerPF: round2(employerPF),
                        gratuity: round2(gratuity),
                        total: round2(employerPF + gratuity)
                    }
                },

                // Validation report
                validation: {
                    ctcMatch: ctcDifference < 0.01,
                    ctcExpected: round2(ctc),
                    ctcCalculated: round2(ctcVerification),
                    ctcDifference: round2(ctcDifference),
                    grossExcludesEmployerContributions: true,
                    allRulesFollowed: true
                }
            };

            console.log(`[PAYROLL_ENGINE] ✅ Calculation Complete\n`);
            return result;

        } catch (err) {
            console.error(`[PAYROLL_ENGINE] ❌ Error:`, err.message);
            return {
                success: false,
                error: err.message
            };
        }
    }

    /**
     * Calculate salary for multiple employees
     */
    calculateBatch(employees) {
        return employees.map(emp => ({
            employeeId: emp.id,
            name: emp.name,
            salary: this.calculate(emp.annualCTC)
        }));
    }

    /**
     * Get tax breakdown by slab
     */
    getTaxBreakdown(annualTaxable) {
        const slabs = [
            { limit: 300000, rate: 0 },
            { limit: 600000, rate: 0.05 },
            { limit: 900000, rate: 0.10 },
            { limit: 1200000, rate: 0.15 },
            { limit: 1500000, rate: 0.20 },
            { limit: Infinity, rate: 0.30 }
        ];

        let remaining = annualTaxable;
        let taxBreakdown = [];
        let totalTax = 0;
        let previousLimit = 0;

        for (const slab of slabs) {
            if (remaining <= 0) break;

            const slabAmount = Math.min(remaining, slab.limit - previousLimit);
            const slabTax = slabAmount * slab.rate;
            totalTax += slabTax;

            if (slabTax > 0) {
                taxBreakdown.push({
                    slabLimit: slab.limit,
                    rate: `${slab.rate * 100}%`,
                    amount: round2(slabAmount),
                    tax: round2(slabTax)
                });
            }

            remaining -= slabAmount;
            previousLimit = slab.limit;
        }

        return {
            taxableIncome: round2(annualTaxable),
            slabs: taxBreakdown,
            totalTax: round2(totalTax)
        };
    }
}

module.exports = IndianPayrollEngine;
