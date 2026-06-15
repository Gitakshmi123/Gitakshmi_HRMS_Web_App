const SalaryCalculationEngine = require('../services/salaryCalculationEngine');

const testPayload = {
    annualCTC: 413085,
    earnings: [
        { name: 'Basic Salary', code: 'BASIC', calculationType: 'PERCENTAGE_OF_CTC', value: 50 },
        { name: 'House Rent Allowance', code: 'HOUSE_RENT_ALLOWANCE', calculationType: 'PERCENTAGE_OF_BASIC', value: 50 },
        { name: 'Conveyance Allowance', code: 'CONVEYANCE', calculationType: 'FIXED', value: 1600 },
        { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', calculationType: 'FIXED', value: 0 }
    ],
    deductions: [],
    benefits: [
        { name: 'Employer PF', code: 'EMPLOYER_PF', calculationType: 'PERCENTAGE_OF_BASIC', value: 12 },
        { name: 'Gratuity', code: 'GRATUITY', calculationType: 'PERCENTAGE_OF_BASIC', value: 4.81 }
    ]
};

// Modify calculation engine locally (simulation) or run with current code
const res = SalaryCalculationEngine.calculateSalary(testPayload);
console.log('Result earnings:', JSON.stringify(res.earnings, null, 2));
console.log('Result benefits:', JSON.stringify(res.benefits, null, 2));
console.log('Totals:', JSON.stringify(res.totals, null, 2));

const calculatedCTC = res.earnings.reduce((s, e) => s + e.yearly, 0) + res.benefits.reduce((s, b) => s + b.yearly, 0);
console.log('Calculated CTC:', calculatedCTC);
console.log('Difference:', calculatedCTC - 413085);
