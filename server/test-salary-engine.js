/**
 * Test Script for Salary Calculation Engine
 * Run with: node test-salary-engine.js
 */

const SalaryCalculationEngine = require('./services/salaryCalculationEngine');

console.log('🧪 Testing Salary Calculation Engine\n');
console.log('='.repeat(60));

// Test Case 1: Basic Calculation with Default Components
console.log('\n📊 Test Case 1: CTC ₹600,000 with default components');
console.log('-'.repeat(60));

try {
    const result1 = SalaryCalculationEngine.calculateSalary({
        annualCTC: 600000,
        selectedEarnings: [
            { code: 'HRA', name: 'House Rent Allowance' }
        ],
        selectedDeductions: [
            { code: 'EMPLOYEE_PF', name: 'Employee PF' }
        ],
        selectedBenefits: [
            { code: 'EMPLOYER_PF', name: 'Employer PF' },
            { code: 'GRATUITY', name: 'Gratuity' }
        ]
    });

    console.log('\n✅ Calculation Successful!');
    console.log('\nEarnings:');
    result1.earnings.forEach(e => {
        console.log(`  ${e.name.padEnd(25)} ₹${e.monthlyAmount.toLocaleString('en-IN').padStart(10)} / month`);
    });

    console.log('\nDeductions:');
    result1.deductions.forEach(d => {
        console.log(`  ${d.name.padEnd(25)} ₹${d.monthlyAmount.toLocaleString('en-IN').padStart(10)} / month`);
    });

    console.log('\nEmployer Benefits:');
    result1.employerBenefits.forEach(b => {
        console.log(`  ${b.name.padEnd(25)} ₹${b.monthlyAmount.toLocaleString('en-IN').padStart(10)} / month`);
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Gross Earnings (Monthly):    ₹${result1.grossMonthly.toLocaleString('en-IN')}`);
    console.log(`Total Deductions (Monthly):  ₹${result1.totalDeductionsMonthly.toLocaleString('en-IN')}`);
    console.log(`Net Take-Home (Monthly):     ₹${result1.netTakeHomeMonthly.toLocaleString('en-IN')}`);
    console.log(`Annual CTC:                  ₹${result1.annualCTC.toLocaleString('en-IN')}`);
    console.log('='.repeat(60));

    // Validate
    const validation1 = SalaryCalculationEngine.validateSnapshot(result1);
    if (validation1.valid) {
        console.log('\n✅ Validation: PASSED');
    } else {
        console.log('\n❌ Validation: FAILED');
        console.log('Errors:', validation1.errors);
    }

} catch (error) {
    console.error('\n❌ Test Case 1 Failed:', error.message);
}

// Test Case 2: High Salary (PF Cap Test)
console.log('\n\n📊 Test Case 2: CTC ₹2,400,000 (PF Cap Test)');
console.log('-'.repeat(60));

try {
    const result2 = SalaryCalculationEngine.calculateSalary({
        annualCTC: 2400000,
        selectedEarnings: [
            { code: 'HRA', name: 'House Rent Allowance' }
        ],
        selectedDeductions: [
            { code: 'EMPLOYEE_PF', name: 'Employee PF' }
        ],
        selectedBenefits: [
            { code: 'EMPLOYER_PF', name: 'Employer PF' },
            { code: 'GRATUITY', name: 'Gratuity' }
        ]
    });

    console.log('\n✅ Calculation Successful!');

    // Check PF capping
    const empPF = result2.deductions.find(d => d.code === 'EMPLOYEE_PF');
    const emplPF = result2.employerBenefits.find(b => b.code === 'EMPLOYER_PF');

    console.log('\n🔍 PF Cap Verification:');
    console.log(`  Employee PF: ₹${empPF.monthlyAmount} (should be capped at ₹1,800)`);
    console.log(`  Employer PF: ₹${emplPF.monthlyAmount} (should be capped at ₹1,800)`);

    if (empPF.monthlyAmount === 1800 && emplPF.monthlyAmount === 1800) {
        console.log('  ✅ PF capping working correctly!');
    } else {
        console.log('  ❌ PF capping NOT working!');
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Gross Earnings (Monthly):    ₹${result2.grossMonthly.toLocaleString('en-IN')}`);
    console.log(`Net Take-Home (Monthly):     ₹${result2.netTakeHomeMonthly.toLocaleString('en-IN')}`);
    console.log(`Annual CTC:                  ₹${result2.annualCTC.toLocaleString('en-IN')}`);
    console.log('='.repeat(60));

} catch (error) {
    console.error('\n❌ Test Case 2 Failed:', error.message);
}

// Test Case 3: No Components Selected (Defaults)
console.log('\n\n📊 Test Case 3: CTC ₹800,000 with no components (defaults)');
console.log('-'.repeat(60));

try {
    const result3 = SalaryCalculationEngine.calculateSalary({
        annualCTC: 800000,
        selectedEarnings: [],
        selectedDeductions: [],
        selectedBenefits: []
    });

    console.log('\n✅ Calculation Successful!');
    console.log('\nDefault Components Applied:');
    console.log('  Earnings:', result3.earnings.map(e => e.name).join(', '));
    console.log('  Deductions:', result3.deductions.map(d => d.name).join(', '));
    console.log('  Benefits:', result3.employerBenefits.map(b => b.name).join(', '));

    console.log('\n' + '='.repeat(60));
    console.log(`Net Take-Home (Monthly):     ₹${result3.netTakeHomeMonthly.toLocaleString('en-IN')}`);
    console.log('='.repeat(60));

} catch (error) {
    console.error('\n❌ Test Case 3 Failed:', error.message);
}

// Test Case 4: Invalid Input
console.log('\n\n📊 Test Case 4: Invalid Input (Negative CTC)');
console.log('-'.repeat(60));

try {
    const result4 = SalaryCalculationEngine.calculateSalary({
        annualCTC: -100000,
        selectedEarnings: [],
        selectedDeductions: [],
        selectedBenefits: []
    });
    console.log('\n❌ Should have thrown an error!');
} catch (error) {
    console.log('\n✅ Correctly rejected invalid input');
    console.log(`   Error: ${error.message}`);
}

console.log('\n\n' + '='.repeat(60));
console.log('🎉 All Tests Completed!');
console.log('='.repeat(60));
