function calculateForCtcA(ctcA, minWage) {
    const roundHalf = (v) => Math.round(v * 2) / 2;
    const round0 = (v) => Math.round(v);
    
    // Basic = ROUND(MAX(minWage, ctcA * 50%), 0.5)
    // Wait, the formula in Excel was =ROUND(MAX(F13,G12*50%),0.5). In excel G12 is ctcA. F13 is minWage.
    // Excel's ROUND(..., 0.5) might actually mean rounding to nearest 0.5? No, ROUND(val, 0.5) in Excel rounds to 1 decimal place?
    // Wait! Let's check Excel's ROUND function: ROUND(number, num_digits).
    // Ah! In Excel, ROUND(F14*50%, 0) rounds to 0 decimal places.
    // What is ROUND(MAX(F13, G12*50%), 0.5)? Wait, ROUND(val, 0.5) in Excel is actually not valid num_digits! If num_digits is 0.5, Excel truncates it to 0.
    // Let's check: MAX(13897, 70800 * 50%) = MAX(13897, 35400) = 35400.
    // F14 is 35400. So ROUND(35400, 0.5) was evaluated in Excel. Let's check Excel ROUND behavior for non-integer digits: it truncates 0.5 to 0. So it is just ROUND(..., 0).
    const basic = round0(Math.max(minWage, ctcA * 0.5));
    
    // Bonus = IF(G12 > 21000, 0, F13 * 8.33%)
    const bonus = ctcA > 21000 ? 0 : round0(minWage * 0.0833);
    
    // PF Employer = IF(Basic >= 15000, 1800, IF(AND(Basic <= 15000, Basic >= 1), ROUND(Basic * 12%, 0)))
    let pfEmployer = 0;
    if (basic >= 15000) {
        pfEmployer = 1800;
    } else if (basic >= 1) {
        pfEmployer = round0(basic * 0.12);
    }
    
    // ESIC Employer = IF(Basic >= 21001, 0, IF(AND(Basic <= 21001, Basic >= 1), ROUND(Basic * 3.25%, 0)))
    let esicEmployer = 0;
    if (basic < 21001 && basic >= 1) {
        esicEmployer = round0(basic * 0.0325);
    }
    
    // HRA = MIN(ROUND(Basic * 50%, 0), MAX(0, ctcA - (Basic + Bonus + PF_Employer + ESIC_Employer)))
    const hra = Math.min(
        round0(basic * 0.5),
        Math.max(0, ctcA - (basic + bonus + pfEmployer + esicEmployer))
    );
    
    // Conveyance = MIN(ROUND(Basic * 15%, 0), MAX(0, ctcA - (Basic + HRA + Bonus + PF_Employer + ESIC_Employer)))
    const conveyance = Math.min(
        round0(basic * 0.15),
        Math.max(0, ctcA - (basic + hra + bonus + pfEmployer + esicEmployer))
    );
    
    // Compensatory Allowance = MAX(0, ctcA - (Basic + HRA + Conveyance + Bonus + PF_Employer + ESIC_Employer))
    const compensatory = Math.max(
        0,
        ctcA - (basic + hra + conveyance + bonus + pfEmployer + esicEmployer)
    );
    
    const actualCtcA = basic + hra + conveyance + compensatory + bonus + pfEmployer + esicEmployer;
    
    // Gratuity = ROUND(Basic * 4.81%, 0)
    const gratuity = round0(basic * 0.0481);
    
    // P.A. Policy Premium
    const val1 = actualCtcA >= 20833.33 ? 500000 : actualCtcA * 24;
    const term1 = round0(val1 * 0.0015);
    const val2 = (actualCtcA * 36) + (actualCtcA >= 20833.33 ? (actualCtcA * 24 - 500000) : 0);
    const term2 = round0(val2 * 0.00045);
    const yearlyPremium = term1 + term2;
    const premium = round0(yearlyPremium / 12);
    
    const totalCTC = actualCtcA + gratuity + premium;
    
    return {
        ctcA: actualCtcA,
        basic,
        hra,
        conveyance,
        compensatory,
        bonus,
        pfEmployer,
        esicEmployer,
        gratuity,
        premium,
        totalCTC
    };
}

function solveCtc(targetMonthlyCTC, minWage) {
    let low = 0;
    let high = targetMonthlyCTC;
    let bestCTC_A = targetMonthlyCTC;
    let bestDiff = Infinity;
    
    for (let i = 0; i < 30; i++) {
        let mid = (low + high) / 2;
        let calc = calculateForCtcA(mid, minWage);
        let diff = calc.totalCTC - targetMonthlyCTC;
        
        if (Math.abs(diff) < Math.abs(bestDiff)) {
            bestDiff = diff;
            bestCTC_A = mid;
        }
        
        if (calc.totalCTC > targetMonthlyCTC) {
            high = mid;
        } else {
            low = mid;
        }
    }
    return bestCTC_A;
}

const targetCTC = 72706; // Monthly CTC corresponding to 872473 yearly
const minWage = 13897; // Ahmedabad Skilled Minimum Wage

const solvedCtcA = solveCtc(targetCTC, minWage);
const breakup = calculateForCtcA(solvedCtcA, minWage);

console.log("Target Monthly CTC:", targetCTC);
console.log("Ahmedabad Min Wage:", minWage);
console.log("\nSolved CTC-A Target:", Math.round(solvedCtcA));
console.log("\nBreakup:");
console.log(JSON.stringify(breakup, null, 2));
console.log("\nSum Check: ctcA (" + breakup.ctcA + ") + gratuity (" + breakup.gratuity + ") + premium (" + breakup.premium + ") = " + (breakup.ctcA + breakup.gratuity + breakup.premium));
