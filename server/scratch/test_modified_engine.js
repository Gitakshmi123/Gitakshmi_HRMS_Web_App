require('dotenv').config();
const SalaryCalculationEngine = require('../services/salaryCalculationEngine');

// Store original implementation
const originalCalculate = SalaryCalculationEngine.calculateSalary;

// Override with modified calculation
SalaryCalculationEngine.calculateSalary = function({ annualCTC = 0, earnings = [], deductions = [], benefits = [], payrollContext = {}, employeeCategory = 'GENERAL', minWageAmount = 0 }) {
    const ctc = this._safeNum(annualCTC);
    if (ctc <= 0) return this._emptyResult(ctc, payrollContext);

    const ctxRules = this._normalizePayrollContext(payrollContext);
    const monthlyCTC = this._round(ctc / 12);
    
    // 1. Minimum Wage logic
    const effectiveMinWage = this._safeNum(minWageAmount);
    
    // 2. Determine Basic Salary (Dynamic & Custom logic)
    let basicMonthly = 0;
    let basicAnnual = 0;

    const dbBasicComp = earnings.find(e => {
        if (!e) return false;
        const name = (e.name || '').toUpperCase();
        const code = (e.code || '').toUpperCase();
        return code === 'BASIC' || name === 'BASIC' || name === 'BASIC SALARY' || name === 'BASIC PAY';
    });

    if (dbBasicComp && dbBasicComp.calculationType) {
        const calcType = String(dbBasicComp.calculationType || 'PERCENTAGE_OF_CTC').toUpperCase();
        const value = parseFloat(dbBasicComp.value ?? dbBasicComp.percentage ?? dbBasicComp.amount ?? 0) || 0;
        if (calcType.includes('PERCENTAGE_OF_CTC') || calcType.includes('PERCENT_CTC') || (calcType.includes('PERCENT') && !calcType.includes('BASIC'))) {
            basicMonthly = this._round((monthlyCTC * value) / 100);
        } else if (calcType.includes('FIXED') || calcType.includes('FLAT')) {
            basicMonthly = this._round(value);
        } else {
            const halfCTC = this._round(monthlyCTC * 0.5);
            basicMonthly = Math.max(halfCTC, effectiveMinWage);
        }
    } else {
        const halfCTC = this._round(monthlyCTC * 0.5);
        basicMonthly = Math.max(halfCTC, effectiveMinWage);
    }
    basicAnnual = this._round(basicMonthly * 12);

    const workingEarnings = this._withAutoEarnings(earnings, ctxRules);
    const workingBenefits = this._withAutoBenefits(benefits, ctxRules, monthlyCTC);
    const workingDeductions = this._withAutoDeductions(deductions, ctxRules, monthlyCTC);

    const ctx = {
        annualCTC: ctc,
        monthlyCTC,
        basicAnnual,
        basicMonthly,
        grossMonthly: 0,
        grossAnnual: 0,
        payrollContext: ctxRules,
        componentValues: {
            CTC: ctc,
            ANNUAL_CTC: ctc,
            MONTHLY_CTC: monthlyCTC,
            BASIC: basicMonthly,
            BASIC_MONTHLY: basicMonthly,
            BASIC_ANNUAL: basicAnnual
        }
    };

    const result = {
        annualCTC: ctc,
        payrollContext: ctxRules,
        earnings: [],
        deductions: [],
        benefits: [],
        employerContributions: [], // Grouped for Excel-style view
        retirementBenefits: [],    // Gross B components
        totals: {
            grossA: 0,
            grossB: 0,
            totalCTC: ctc,
            netTakeHome: 0
        }
    };

    // 3. Process Basic Salary
    const basicComp = workingEarnings.find(e => this._isBasic(e)) || { name: 'Basic Salary' };
    const basicResult = {
        ...basicComp,
        code: 'BASIC',
        name: basicComp.name || 'Basic Salary',
        calculationType: 'MIN_WAGE_ADJUSTED',
        value: basicMonthly,
        basedOn: 'MW_OR_50PCT',
        monthly: basicMonthly,
        yearly: basicAnnual
    };
    result.earnings.push(basicResult);
    this._setComponentValue(ctx, basicResult);

    let totalFixedEarningsAnnual = basicAnnual;
    let totalEmployerContribAnnual = 0;
    let totalRetirementAnnual = 0;

    // 4. Process Other Earnings (Except Special Allowance)
    workingEarnings
        .filter(e => !this._isBasic(e) && !this._isSpecial(e))
        .forEach(e => {
            const code = this._deriveCode(e);
            // Requirement: IF Basic is set to Minimum Wage (because 50% CTC < MW), 
            // then HRA and Conveyance must be 0.
            if (basicMonthly === effectiveMinWage && (code === 'HOUSE_RENT_ALLOWANCE' || code === 'CONVEYANCE' || code === 'COMPENSATORY_ALLOWANCE')) {
                e.value = 0;
                e.calculationType = 'FIXED';
            }
            const calc = this._processComponent(e, ctx);
            result.earnings.push(calc);
            totalFixedEarningsAnnual += calc.yearly;
            this._setComponentValue(ctx, calc);
        });

    // 5. Process Employer Contributions (Part of Gross A)
    workingBenefits.filter(b => !this._isRetirement(b)).forEach(b => {
        const calc = this._processComponent(b, ctx);
        result.employerContributions.push(calc);
        result.benefits.push(calc);
        totalEmployerContribAnnual += calc.yearly;
        this._setComponentValue(ctx, calc);
    });

    // 6. Process Retirement Benefits (Gross B)
    workingBenefits.filter(b => this._isRetirement(b)).forEach(b => {
        const calc = this._processComponent(b, ctx);
        result.retirementBenefits.push(calc);
        result.benefits.push(calc);
        totalRetirementAnnual += calc.yearly;
        this._setComponentValue(ctx, calc);
    });

    // 7. Auto Balancing Logic (Special Allowance)
    // Final CTC = Gross A + Gross B
    // Gross A = All Earnings + Employer Contributions
    // => All Earnings = Final CTC - Gross B - Employer Contributions
    let saAnnual = this._round(ctc - (totalFixedEarningsAnnual + totalEmployerContribAnnual + totalRetirementAnnual));
    
    // Note: We removed the:
    // if (saAnnual < 0) saAnnual = 0;
    // to allow Special Allowance to go negative to balance the CTC.
    if (saAnnual < 0 && Math.abs(saAnnual) <= 0.05) saAnnual = 0; // Very small float tolerance

    const saMonthly = this._round(saAnnual / 12);
    const saOriginal = workingEarnings.find(e => this._isSpecial(e)) || { name: 'Special Allowance' };
    const specialAllowance = {
        ...saOriginal,
        code: 'SPECIAL_ALLOWANCE',
        name: saOriginal.name || 'Special Allowance',
        calculationType: 'FIXED',
        value: saMonthly,
        basedOn: 'NA',
        monthly: saMonthly,
        yearly: saAnnual,
        isSystemGenerated: true
    };
    result.earnings.push(specialAllowance);
    this._setComponentValue(ctx, specialAllowance);

    const totalEarningsAnnual = totalFixedEarningsAnnual + saAnnual;
    ctx.grossAnnual = totalEarningsAnnual;
    ctx.grossMonthly = this._round(totalEarningsAnnual / 12);
    ctx.componentValues.GROSS = ctx.grossMonthly;
    ctx.componentValues.NET = ctx.grossMonthly;

    // 8. Process Deductions
    let totalDeductionsAnnual = 0;
    workingDeductions.forEach(d => {
        const calc = this._processComponent(d, ctx);
        result.deductions.push(calc);
        totalDeductionsAnnual += calc.yearly;
        this._setComponentValue(ctx, calc);
        ctx.componentValues.NET = this._round(ctx.componentValues.NET - calc.monthly);
    });

    // 9. Final Totals (Excel Style)
    result.totals = {
        grossA_Monthly: this._round((totalEarningsAnnual + totalEmployerContribAnnual) / 12),
        grossA_Yearly: totalEarningsAnnual + totalEmployerContribAnnual,
        grossB_Monthly: this._round(totalRetirementAnnual / 12),
        grossB_Yearly: totalRetirementAnnual,
        totalCTC: ctc,
        deductionMonthly: this._round(totalDeductionsAnnual / 12),
        takeHomeMonthly: this._round((totalEarningsAnnual - totalDeductionsAnnual) / 12),
        takeHomeYearly: totalEarningsAnnual - totalDeductionsAnnual
    };

    return result;
};

// Now test with the user's specific scenario (CTC = 413085)
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const db = mongoose.connection.useDb('company_pnr');
        
        // Find salary template or components from DB
        const Earning = db.collection('salarycomponents');
        const Benefit = db.collection('benefitcomponents');
        const Deduction = db.collection('deductioncomponents');
        
        const earnings = await Earning.find({ isActive: { $ne: false } }).toArray();
        const benefits = await Benefit.find({ isActive: { $ne: false } }).toArray();
        const deductions = await Deduction.find({ isActive: { $ne: false } }).toArray();
        
        console.log('Active Earnings in DB count:', earnings.length);
        console.log('Active Benefits in DB count:', benefits.length);
        console.log('Active Deductions in DB count:', deductions.length);

        console.log('Active Earnings details:', earnings.map(e => ({ name: e.name, calculationType: e.calculationType, percentage: e.percentage, amount: e.amount, value: e.value })));
        console.log('Active Benefits details:', benefits.map(b => ({ name: b.name, calculationType: b.calculationType, value: b.value })));
        
        // Let's run preview with these components
        const testPayload = {
            annualCTC: 413085,
            earnings,
            deductions,
            benefits,
            payrollContext: {
                applyStatutory: true,
                locationContext: {
                    country: 'IN',
                    payrollRegion: 'Gujarat',
                    workState: 'Gujarat',
                    workCity: 'Ahmedabad'
                }
            }
        };
        
        const res = SalaryCalculationEngine.calculateSalary(testPayload);
        
        console.log('\n--- CALCULATED SALARY STRUCTURE FOR CTC 413085 ---');
        console.log('Earnings:');
        res.earnings.forEach(e => {
            console.log(`  ${e.name.padEnd(25)} Monthly: ${e.monthly} (${e.calculationType}, value: ${e.value}), Yearly: ${e.yearly}`);
        });
        console.log('Benefits:');
        res.benefits.forEach(b => {
            console.log(`  ${b.name.padEnd(25)} Monthly: ${b.monthly} (${b.calculationType}, value: ${b.value}), Yearly: ${b.yearly}`);
        });
        console.log('Deductions:');
        res.deductions.forEach(d => {
            console.log(`  ${d.name.padEnd(25)} Monthly: ${d.monthly} (${d.calculationType}, value: ${d.value}), Yearly: ${d.yearly}`);
        });
        
        const calculatedCTC = res.earnings.reduce((s, e) => s + e.yearly, 0) + res.benefits.reduce((s, b) => s + b.yearly, 0);
        console.log('\nCalculated CTC Sum:', calculatedCTC);
        console.log('Target CTC:', res.annualCTC);
        console.log('Difference:', calculatedCTC - res.annualCTC);
        console.log('Totals:', JSON.stringify(res.totals, null, 2));

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
