/**
 * Salary Breakup Calculator Service
 * Used for validation and suggestion of salary structures
 */

// Calculate and validate salary breakup against CTC
exports.calculateSalaryBreakup = ({ enteredCTC, earnings, deductions, employerContributions }) => {
    // Helper to get annual amount
    const getAnnual = (item) => {
        const val = Number(item.amount) || Number(item.monthly) || 0;
        return val * 12;
    };

    const totalEarnings = (earnings || []).reduce((sum, e) => sum + getAnnual(e), 0);
    const totalBenefits = (employerContributions || []).reduce((sum, b) => sum + getAnnual(b), 0);
    const totalDeductions = (deductions || []).reduce((sum, d) => sum + getAnnual(d), 0);

    const calculatedCTC = totalEarnings + totalBenefits;
    const mismatch = Math.abs(calculatedCTC - enteredCTC);
    const isValid = mismatch < 50; // Allow small rounding differences

    const monthlyGross = Math.round(totalEarnings / 12);
    const monthlyDeductions = Math.round(totalDeductions / 12);
    const monthlyNet = monthlyGross - monthlyDeductions;
    const monthlyBenefits = Math.round(totalBenefits / 12);

    return {
        isValid,
        mismatchAmount: Math.round(mismatch),
        expectedCTC: enteredCTC,
        receivedCTC: Math.round(calculatedCTC),
        monthly: {
            grossEarnings: monthlyGross,
            totalDeductions: monthlyDeductions,
            netSalary: monthlyNet,
            employerContributions: monthlyBenefits
        },
        annual: {
            ctc: Math.round(calculatedCTC)
        },
        earnings: (earnings || []).map(e => ({
            ...e,
            amount: Math.round((Number(e.amount) || Number(e.monthly) || 0) * 100) / 100
        })),
        deductions: (deductions || []).map(d => ({
            ...d,
            amount: Math.round((Number(d.amount) || Number(d.monthly) || 0) * 100) / 100
        })),
        employerContributions: (employerContributions || []).map(b => ({
            ...b,
            amount: Math.round((Number(b.amount) || Number(b.monthly) || 0) * 100) / 100
        }))
    };
};

// Suggest a standard salary structure based on CTC
exports.suggestSalaryBreakup = ({ enteredCTC, availableEarnings, availableDeductions, availableEmployerContributions }) => {
    const monthlyCTC = Math.round(enteredCTC / 12);

    // Helper function to find component by name (case-insensitive)
    const findComponent = (components, ...names) => {
        if (!components || !Array.isArray(components)) return null;
        return components.find(c =>
            names.some(name =>
                c.name?.toLowerCase().includes(name.toLowerCase()) ||
                c.payslipName?.toLowerCase().includes(name.toLowerCase())
            )
        );
    };

    // Find configured components
    const basicComp = findComponent(availableEarnings, 'basic');
    const hraComp = findComponent(availableEarnings, 'hra', 'house rent');
    const specialComp = findComponent(availableEarnings, 'special');
    const pfBenefitComp = findComponent(availableEmployerContributions, 'pf', 'provident fund');
    const pfDeductionComp = findComponent(availableDeductions, 'pf', 'provident fund');
    const ptComp = findComponent(availableDeductions, 'pt', 'professional tax');

    // 🔍 DEBUG: Log found components
    console.log('🔍 DEBUG: Found Basic Component:', basicComp ? {
        name: basicComp.name,
        calculationType: basicComp.calculationType,
        percentage: basicComp.percentage,
        amount: basicComp.amount
    } : 'NOT FOUND');

    // Calculate Basic Salary
    let basic = 0;
    if (basicComp) {
        if (basicComp.calculationType === 'PERCENTAGE_OF_CTC' && basicComp.percentage) {
            basic = Math.round(monthlyCTC * (basicComp.percentage / 100));
            console.log(`🔍 DEBUG: Basic calculated as ${basicComp.percentage}% of CTC: ${basic}`);
        } else if (basicComp.calculationType === 'FLAT_AMOUNT' && basicComp.amount) {
            basic = basicComp.amount;
            console.log(`🔍 DEBUG: Basic set as flat amount: ${basic}`);
        } else {
            // Fallback to 50% if no configuration
            basic = Math.round(monthlyCTC * 0.5);
            console.log(`🔍 DEBUG: Basic fallback to 50%: ${basic}`);
        }
    } else {
        // Fallback to 50% if component not found
        basic = Math.round(monthlyCTC * 0.5);
        console.log(`🔍 DEBUG: Basic component not found, fallback to 50%: ${basic}`);
    }

    // Calculate Employer PF (12% of Basic, capped at 15000 basic)
    let pfWage = Math.min(basic, 15000);
    let employerPF = 0;
    if (pfBenefitComp) {
        if (pfBenefitComp.calculationType === 'PERCENTAGE_OF_BASIC' && pfBenefitComp.percentage) {
            employerPF = Math.round(pfWage * (pfBenefitComp.percentage / 100));
        } else if (pfBenefitComp.calculationType === 'FLAT_AMOUNT' && pfBenefitComp.amount) {
            employerPF = pfBenefitComp.amount;
        } else {
            // Fallback to 12%
            employerPF = Math.round(pfWage * 0.12);
        }
    } else {
        // Fallback to 12%
        employerPF = Math.round(pfWage * 0.12);
    }

    // Calculate HRA
    let hra = 0;
    if (hraComp) {
        if (hraComp.calculationType === 'PERCENTAGE_OF_BASIC' && hraComp.percentage) {
            hra = Math.round(basic * (hraComp.percentage / 100));
        } else if (hraComp.calculationType === 'PERCENTAGE_OF_CTC' && hraComp.percentage) {
            hra = Math.round(monthlyCTC * (hraComp.percentage / 100));
        } else if (hraComp.calculationType === 'FLAT_AMOUNT' && hraComp.amount) {
            hra = hraComp.amount;
        } else {
            // Fallback to 40% of basic
            hra = Math.round(basic * 0.4);
        }
    } else {
        // Fallback to 40% of basic
        hra = Math.round(basic * 0.4);
    }

    // Calculate Special Allowance (remainder to balance CTC)
    // CTC = Basic + HRA + Special + EmployerPF
    let special = monthlyCTC - basic - hra - employerPF;

    if (special < 0) {
        // Adjust Basic to fit
        basic = Math.round(monthlyCTC * 0.4);
        hra = hraComp && hraComp.calculationType === 'PERCENTAGE_OF_BASIC' && hraComp.percentage
            ? Math.round(basic * (hraComp.percentage / 100))
            : Math.round(basic * 0.4);
        pfWage = Math.min(basic, 15000);
        employerPF = pfBenefitComp && pfBenefitComp.calculationType === 'PERCENTAGE_OF_BASIC' && pfBenefitComp.percentage
            ? Math.round(pfWage * (pfBenefitComp.percentage / 100))
            : Math.round(pfWage * 0.12);
        special = monthlyCTC - basic - hra - employerPF;
    }

    // Calculate Employee PF (same as Employer PF)
    let employeePF = employerPF;

    // Calculate Professional Tax
    let pt = 0;
    if (ptComp) {
        if (ptComp.calculationType === 'FLAT_AMOUNT' && ptComp.amount) {
            pt = ptComp.amount;
        } else {
            pt = 200; // Fallback
        }
    } else {
        pt = 200; // Fallback
    }

    // Construct response with actual component data
    const suggestedEarnings = [];
    if (basicComp) {
        suggestedEarnings.push({
            componentId: basicComp._id,
            name: basicComp.name || 'Basic Salary',
            label: basicComp.payslipName || basicComp.name || 'Basic Salary',
            amount: basic,
            monthly: basic
        });
    }

    if (hraComp) {
        suggestedEarnings.push({
            componentId: hraComp._id,
            name: hraComp.name || 'House Rent Allowance',
            label: hraComp.payslipName || hraComp.name || 'House Rent Allowance',
            amount: hra,
            monthly: hra
        });
    }

    if (specialComp && special > 0) {
        suggestedEarnings.push({
            componentId: specialComp._id,
            name: specialComp.name || 'Special Allowance',
            label: specialComp.payslipName || specialComp.name || 'Special Allowance',
            amount: special,
            monthly: special
        });
    }

    const suggestedBenefits = [];
    if (pfBenefitComp) {
        suggestedBenefits.push({
            componentId: pfBenefitComp._id,
            name: pfBenefitComp.name || 'Employer PF',
            label: pfBenefitComp.payslipName || pfBenefitComp.name || 'Employer PF',
            amount: employerPF,
            monthly: employerPF
        });
    }

    const suggestedDeductions = [];
    if (pfDeductionComp) {
        suggestedDeductions.push({
            componentId: pfDeductionComp._id,
            name: pfDeductionComp.name || 'Employee PF',
            label: pfDeductionComp.payslipName || pfDeductionComp.name || 'Employee PF',
            amount: employeePF,
            monthly: employeePF
        });
    }

    if (ptComp) {
        suggestedDeductions.push({
            componentId: ptComp._id,
            name: ptComp.name || 'Professional Tax',
            label: ptComp.payslipName || ptComp.name || 'Professional Tax',
            amount: pt,
            monthly: pt
        });
    }

    return {
        earnings: suggestedEarnings,
        employerContributions: suggestedBenefits,
        deductions: suggestedDeductions,
        totals: {
            monthlyCTC,
            annualCTC: enteredCTC
        }
    };
};
