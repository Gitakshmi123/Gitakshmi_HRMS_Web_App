function calculateForCtcA(ctcA, minWage) {
    const round0 = (v) => Math.round(v);
    
    const basic = round0(Math.max(minWage, ctcA * 0.5));
    const bonus = ctcA > 21000 ? 0 : round0(minWage * 0.0833);
    
    let pfEmployer = 0;
    if (basic >= 15000) {
        pfEmployer = 1800;
    } else if (basic >= 1) {
        pfEmployer = round0(basic * 0.12);
    }
    
    let esicEmployer = 0;
    if (basic <= 21000 && basic >= 1) { // Book5 uses basic < 21001
        esicEmployer = round0(basic * 0.0325);
    }
    
    const hra = Math.min(
        round0(basic * 0.5),
        Math.max(0, ctcA - (basic + bonus + pfEmployer + esicEmployer))
    );
    
    const conveyance = Math.min(
        round0(basic * 0.15),
        Math.max(0, ctcA - (basic + hra + bonus + pfEmployer + esicEmployer))
    );
    
    const compensatory = Math.max(
        0,
        ctcA - (basic + hra + conveyance + bonus + pfEmployer + esicEmployer)
    );
    
    const actualCtcA = basic + hra + conveyance + compensatory + bonus + pfEmployer + esicEmployer;
    const gross = basic + hra + conveyance + compensatory + bonus;
    
    const gratuity = round0(basic * 0.0481);
    
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
        gross,
        pfEmployer,
        esicEmployer,
        gratuity,
        premium,
        totalCTC
    };
}

const minWage = 13897; 
const targetTotalCTC = 143726; // Book5 total CTC

let low = 0;
let high = targetTotalCTC;
let bestCTC_A = targetTotalCTC;

for (let i = 0; i < 40; i++) {
    let mid = (low + high) / 2;
    let calc = calculateForCtcA(mid, minWage);
    let diff = calc.totalCTC - targetTotalCTC;
    
    if (Math.abs(diff) < 0.01) {
        bestCTC_A = mid;
        break;
    }
    
    if (calc.totalCTC > targetTotalCTC) {
        high = mid;
    } else {
        low = mid;
    }
    bestCTC_A = mid;
}

const breakup = calculateForCtcA(bestCTC_A, minWage);
console.log("Calculated output for Target 143726:");
console.log(JSON.stringify(breakup, null, 2));
