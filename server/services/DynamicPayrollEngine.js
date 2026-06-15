const { Parser } = require('expr-eval');

/**
 * Dynamic Payroll Engine (Keka Style)
 * Handles auto/manual calculation, formula execution, and state-wise minimum wage compliance.
 */
class DynamicPayrollEngine {
    /**
     * @param {Object} db - Mongoose database connection for looking up wages/rules
     * @param {Object} config - Tenant configuration
     */
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.parser = new Parser();
    }

    /**
     * Safely evaluate a mathematical formula string.
     */
    evaluateFormula(formulaStr, variables) {
        try {
            // Replace brackets with standard variables. e.g. [BASIC] -> BASIC
            let cleanFormula = formulaStr.replace(/\[([^\]]+)\]/g, '$1');
            return this.parser.evaluate(cleanFormula, variables);
        } catch (err) {
            console.warn(`[DynamicPayrollEngine] Failed to evaluate formula: "${formulaStr}" with vars:`, variables, err.message);
            return 0; // Fallback safely
        }
    }

    /**
     * Fetch Minimum Wage for a given state & category
     */
    async getMinimumWage(tenantId, state, category) {
        if (!state || !category) return null;
        
        const MinimumWage = this.db.model('MinimumWage');
        const wage = await MinimumWage.findOne({
            tenantId,
            state: { $regex: new RegExp(`^${state}$`, 'i') },
            category: { $regex: new RegExp(`^${category}$`, 'i') },
            isActive: true
        }).sort({ effectiveFrom: -1 }).lean();

        return wage ? wage.monthlyAmount : null;
    }

    /**
     * Helper to find a component in lists.
     */
    findComponent(lists, keywords) {
        for (const list of lists) {
            if (!list) continue;
            const found = list.find(c => 
                keywords.some(kw => 
                    c.name?.toLowerCase().includes(kw) || 
                    c.payslipName?.toLowerCase().includes(kw)
                )
            );
            if (found) return found;
        }
        return null;
    }

    /**
     * Generates a salary breakup given CTC and components.
     */
    async generateBreakup({ 
        tenantId,
        enteredCTC, 
        availableEarnings, 
        availableDeductions, 
        availableBenefits,
        state = null,
        jobCategory = 'GENERAL', // 'UNSKILLED', 'SEMI_SKILLED', etc.
        manualOverrides = {} // { "componentId": amount_in_monthly }
    }) {
        const monthlyCTC = Math.round(enteredCTC / 12);
        
        // Output lists
        let computedEarnings = [];
        let computedBenefits = [];
        let computedDeductions = [];

        // 1. Identify Key System Components
        const basicComp = this.findComponent([availableEarnings], ['basic']);
        const specialComp = this.findComponent([availableEarnings], ['special']);
        const hraComp = this.findComponent([availableEarnings], ['hra', 'house rent']);
        
        // Variables Context for Formula Evaluator
        let context = {
            CTC: monthlyCTC,
            BASIC: 0,
            GROSS: 0
        };

        // 2. Pass 1: Calculate Basic Salary
        let basicAmount = 0;
        if (basicComp) {
            if (manualOverrides[basicComp._id]) {
                basicAmount = manualOverrides[basicComp._id];
            } else if (basicComp.calculationType === 'FORMULA' && basicComp.formula) {
                basicAmount = this.evaluateFormula(basicComp.formula, context);
            } else if (basicComp.calculationType === 'PERCENTAGE_OF_CTC' && basicComp.percentage) {
                basicAmount = monthlyCTC * (basicComp.percentage / 100);
            } else if (basicComp.calculationType === 'FLAT_AMOUNT') {
                basicAmount = basicComp.amount || 0;
            } else {
                basicAmount = monthlyCTC * 0.5; // default fallback
            }
        }
        basicAmount = Math.round(basicAmount);

        // 3. Check State-wise Minimum Wage Compliance
        const minWage = await this.getMinimumWage(tenantId, state, jobCategory);
        let wasMinimumWageApplied = false;
        if (minWage && basicAmount < minWage) {
            basicAmount = minWage;
            wasMinimumWageApplied = true;
        }

        context.BASIC = basicAmount;

        // Add Basic to earnings
        if (basicComp) {
            computedEarnings.push({
                ...basicComp,
                calculatedAmount: basicAmount,
                isManual: !!manualOverrides[basicComp._id],
                isMinimumWageAdjusted: wasMinimumWageApplied
            });
        }

        // 4. Pass 2: Calculate other earnings based on CTC & BASIC (excluding Special Allowance)
        let totalEarningsSoFar = basicAmount;

        for (const earning of (availableEarnings || [])) {
            // Skip Basic and Special in this generic pass
            if (earning._id === basicComp?._id || earning._id === specialComp?._id) continue;

            let amount = 0;
            if (manualOverrides[earning._id]) {
                amount = manualOverrides[earning._id];
            } else if (earning.calculationType === 'FORMULA' && earning.formula) {
                amount = this.evaluateFormula(earning.formula, context);
            } else if (earning.calculationType === 'PERCENTAGE_OF_BASIC' && earning.percentage) {
                amount = basicAmount * (earning.percentage / 100);
            } else if (earning.calculationType === 'PERCENTAGE_OF_CTC' && earning.percentage) {
                amount = monthlyCTC * (earning.percentage / 100);
            } else if (earning.calculationType === 'FLAT_AMOUNT') {
                amount = earning.amount || 0;
            }

            amount = Math.round(amount);
            totalEarningsSoFar += amount;
            computedEarnings.push({
                ...earning,
                calculatedAmount: amount,
                isManual: !!manualOverrides[earning._id]
            });
        }

        // 5. Pass 3: Calculate Employer Benefits (PF, ESI) which are part of CTC
        // We need these to balance the CTC before we calculate Special Allowance.
        let totalBenefits = 0;

        for (const benefit of (availableBenefits || [])) {
            let amount = 0;
            if (manualOverrides[benefit._id]) {
                amount = manualOverrides[benefit._id];
            } else {
                // Hardcode logic for statutory or evaluate formula
                if (benefit.calculationType === 'FORMULA' && benefit.formula) {
                    amount = this.evaluateFormula(benefit.formula, context);
                } else if (benefit.calculationType === 'PERCENTAGE_OF_BASIC' && benefit.percentage) {
                    // Note: PF wage boundary logic (capped at 15k)
                    let base = basicAmount;
                    if (benefit.name?.toLowerCase().includes('pf') && base > 15000) {
                        base = 15000; // Capped for PF by default unless overridden
                    }
                    amount = base * (benefit.percentage / 100);
                } else if (benefit.calculationType === 'PERCENTAGE_OF_CTC' && benefit.percentage) {
                    amount = monthlyCTC * (benefit.percentage / 100);
                } else if (benefit.calculationType === 'FLAT_AMOUNT') {
                    amount = benefit.amount || 0;
                }
            }

            amount = Math.round(amount);
            totalBenefits += amount;
            computedBenefits.push({
                ...benefit,
                calculatedAmount: amount,
                isManual: !!manualOverrides[benefit._id]
            });
        }

        // 6. Pass 4: Balance with Special Allowance
        let specialAmount = 0;
        if (specialComp) {
            if (manualOverrides[specialComp._id]) {
                specialAmount = manualOverrides[specialComp._id];
            } else {
                // CTC = Total Earnings + Total Benefits
                // So, Special Allowance = CTC - (Earnings So Far + Benefits)
                specialAmount = monthlyCTC - (totalEarningsSoFar + totalBenefits);
                if (specialAmount < 0) {
                    // CTC is exceeded! In a real system, we either show a warning 
                    // or compress Basic. For now, clamp to 0.
                    specialAmount = 0;
                }
            }
            specialAmount = Math.round(specialAmount);
            totalEarningsSoFar += specialAmount;
            
            computedEarnings.push({
                ...specialComp,
                calculatedAmount: specialAmount,
                isManual: !!manualOverrides[specialComp._id]
            });
        }

        // Now we know the GROSS!
        context.GROSS = totalEarningsSoFar;

        // 7. Pass 5: Deductions (PT, ESI Employee Share, PF Employee Share)
        let totalDeductions = 0;
        for (const deduction of (availableDeductions || [])) {
            let amount = 0;
            if (manualOverrides[deduction._id]) {
                amount = manualOverrides[deduction._id];
            } else {
                if (deduction.calculationType === 'FORMULA' && deduction.formula) {
                    amount = this.evaluateFormula(deduction.formula, context);
                } else if (deduction.calculationType === 'PERCENTAGE_OF_BASIC' && deduction.percentage) {
                    let base = basicAmount;
                    if (deduction.name?.toLowerCase().includes('pf') && base > 15000) {
                        base = 15000;
                    }
                    amount = base * (deduction.percentage / 100);
                } else if (deduction.calculationType === 'PERCENTAGE_OF_CTC' && deduction.percentage) {
                    amount = monthlyCTC * (deduction.percentage / 100);
                } else if (deduction.calculationType === 'FLAT_AMOUNT') {
                    amount = deduction.amount || 0;
                }

                // ESI specific limit logic check
                if (deduction.name?.toLowerCase().includes('esi') && context.GROSS > 21000) {
                    amount = 0; // ESI does not apply if Gross > 21000
                }
            }

            amount = Math.round(amount);
            totalDeductions += amount;
            computedDeductions.push({
                ...deduction,
                calculatedAmount: amount,
                isManual: !!manualOverrides[deduction._id]
            });
        }

        // Return standardized mapped output
        return {
            isValid: true,
            mismatchAmount: Math.abs((totalEarningsSoFar + totalBenefits) - monthlyCTC), // monthly mismatch
            expectedCTC: enteredCTC,
            receivedCTC: Math.round((totalEarningsSoFar + totalBenefits) * 12),
            monthly: {
                grossEarnings: totalEarningsSoFar,
                totalDeductions: totalDeductions,
                netSalary: totalEarningsSoFar - totalDeductions,
                employerContributions: totalBenefits
            },
            annual: {
                ctc: Math.round((totalEarningsSoFar + totalBenefits) * 12)
            },
            earnings: computedEarnings.map(e => ({
                componentId: e._id,
                name: e.name,
                label: e.payslipName || e.name,
                amount: e.calculatedAmount,
                monthly: e.calculatedAmount,
                isManual: e.isManual,
                isMinimumWageAdjusted: e.isMinimumWageAdjusted
            })),
            deductions: computedDeductions.map(d => ({
                componentId: d._id,
                name: d.name,
                label: d.payslipName || d.name,
                amount: d.calculatedAmount,
                monthly: d.calculatedAmount,
                isManual: d.isManual
            })),
            employerContributions: computedBenefits.map(b => ({
                componentId: b._id,
                name: b.name,
                label: b.payslipName || b.name,
                amount: b.calculatedAmount,
                monthly: b.calculatedAmount,
                isManual: b.isManual
            })),
            diagnostics: {
                minWageApplied: wasMinimumWageApplied,
                minWageLimit: minWage
            }
        };
    }
}

module.exports = DynamicPayrollEngine;
