require('dotenv').config();
const SalaryCalculationEngine = require('../services/salaryCalculationEngine');

// Store original isSpecial
const originalIsSpecial = SalaryCalculationEngine._isSpecial;

// Override _isSpecial to ONLY match SPECIAL_ALLOWANCE
SalaryCalculationEngine._isSpecial = function(c) {
    if (!c) return false;
    const name = (c.name || '').toUpperCase();
    const code = (c.code || '').toUpperCase();
    return code === 'SPECIAL_ALLOWANCE' || name === 'SPECIAL ALLOWANCE' || name.includes('BALANCER');
};

const testPayload = {
    annualCTC: 413085,
    earnings: [
        { name: 'Basic', code: 'BASIC', calculationType: 'PERCENTAGE_OF_CTC', value: 46.48 },
        { name: 'HRA @ 50%', code: 'HOUSE_RENT_ALLOWANCE', calculationType: 'PERCENTAGE_OF_BASIC', value: 50 },
        { name: 'Conveyance Allowance @ 15%', code: 'CONVEYANCE', calculationType: 'PERCENTAGE_OF_BASIC', value: 15 },
        { name: 'Compensatory Allowance', code: 'COMPENSATORY_ALLOWANCE', calculationType: 'FIXED', value: 2170 },
        { name: 'Bonus', code: 'BONUS', calculationType: 'FIXED', value: 1110 },
        { name: 'Minimum Wage', code: 'MINIMUM_WAGE', calculationType: 'FIXED', value: 6400.32 },
        { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', calculationType: 'FIXED', value: 0 }
    ],
    deductions: [],
    benefits: [
        { name: 'PF ( Employer )', code: 'EMPLOYER_PF', calculationType: 'FLAT', value: 1800 },
        { name: 'ESIC Employer )', code: 'EMPLOYER_ESI', calculationType: 'FLAT', value: 520 },
        { name: 'Gratuity', code: 'GRATUITY', calculationType: 'FLAT', value: 770 },
        { name: 'Leave Encashment', code: 'LEAVE_ENCASHMENT', calculationType: 'FLAT', value: 1538 }
    ],
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

console.log('--- NEGATIVE BALANCING SIMULATION WITH IS_SPECIAL FIX ---');
console.log('Earnings:');
res.earnings.forEach(e => {
    console.log(`  ${e.name.padEnd(25)} Monthly: ${e.monthly} (${e.calculationType}, value: ${e.value}), Yearly: ${e.yearly}`);
});
console.log('Benefits:');
res.benefits.forEach(b => {
    console.log(`  ${b.name.padEnd(25)} Monthly: ${b.monthly} (${b.calculationType}, value: ${b.value}), Yearly: ${b.yearly}`);
});

const calculatedCTC = res.earnings.reduce((s, e) => s + e.yearly, 0) + res.benefits.reduce((s, b) => s + b.yearly, 0);
console.log('\nCalculated CTC Sum:', calculatedCTC);
console.log('Target CTC:', res.annualCTC);
console.log('Difference:', calculatedCTC - res.annualCTC);
console.log('Totals:', JSON.stringify(res.totals, null, 2));
