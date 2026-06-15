require('dotenv').config();
const SalaryCalculationEngine = require('../services/salaryCalculationEngine');

// Simulate components that exceed the CTC (Basic = 16000, HRA = 8000, Conveyance = 2400, Compensatory = 2170, Bonus = 1110, Minimum Wage = 6400.32, PF = 1800, ESIC = 520, Gratuity = 770, Leave Encash = 1538)
// Sum = 40708.32 monthly = 488499.84 yearly
// CTC = 413085 (34423.75 monthly)
// Special Allowance should be: 34423.75 - (Basic + HRA + Conveyance + Compensatory + Bonus + Minimum Wage + PF + ESIC + Gratuity + Leave Encash)
// = 34423.75 - 40708.32 = -6284.57 monthly (-75414.84 yearly)

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

console.log('--- NEGATIVE BALANCING SIMULATION ---');
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

// Test with SalaryEngine too to verify both engines balance it
console.log('\n--- TESTING SALARYENGINE ---');
const SalaryEngine = require('../services/salaryEngine');
const template = {
    earnings: [
        { name: 'Basic', code: 'BASIC', calculationType: 'PERCENTAGE_OF_CTC', percentage: 46.48 },
        { name: 'HRA @ 50%', code: 'HOUSE_RENT_ALLOWANCE', calculationType: 'PERCENTAGE_OF_BASIC', percentage: 50 },
        { name: 'Conveyance Allowance @ 15%', code: 'CONVEYANCE', calculationType: 'PERCENTAGE_OF_BASIC', percentage: 15 },
        { name: 'Compensatory Allowance', code: 'COMPENSATORY_ALLOWANCE', calculationType: 'FLAT_AMOUNT', amount: 2170 },
        { name: 'Bonus', code: 'BONUS', calculationType: 'FLAT_AMOUNT', amount: 1110 },
        { name: 'Minimum Wage', code: 'MINIMUM_WAGE', calculationType: 'FLAT_AMOUNT', amount: 6400.32 }
    ],
    employeeDeductions: [],
    employerDeductions: [
        { name: 'PF ( Employer )', code: 'EMPLOYER_PF', calculationType: 'FLAT_AMOUNT', amount: 1800 },
        { name: 'ESIC Employer )', code: 'EMPLOYER_ESI', calculationType: 'FLAT_AMOUNT', amount: 520 },
        { name: 'Gratuity', code: 'GRATUITY', calculationType: 'FLAT_AMOUNT', amount: 770 },
        { name: 'Leave Encashment', code: 'LEAVE_ENCASHMENT', calculationType: 'FLAT_AMOUNT', amount: 1538 }
    ]
};

SalaryEngine.calculate({
    annualCTC: 413085,
    template
}).then(resEngine => {
    console.log('SalaryEngine Earnings:');
    resEngine.earnings.forEach(e => {
        console.log(`  ${e.name.padEnd(25)} Monthly: ${e.monthlyAmount}, Yearly: ${e.annualAmount}`);
    });
    console.log('SalaryEngine Benefits:');
    resEngine.benefits.forEach(b => {
        console.log(`  ${b.name.padEnd(25)} Monthly: ${b.monthlyAmount}, Yearly: ${b.annualAmount}`);
    });
    console.log('SalaryEngine Difference:', resEngine.difference);
    console.log('SalaryEngine Total Cost:', resEngine.totalCost);
}).catch(err => {
    console.error('SalaryEngine error:', err);
});
