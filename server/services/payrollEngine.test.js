/**
 * ============================================
 * PAYROLL ENGINE TEST SUITE
 * ============================================
 * 
 * Comprehensive test cases for Indian Payroll Engine
 */

const IndianPayrollEngine = require('./IndianPayrollEngine');

const engine = new IndianPayrollEngine();

// ============================================
// TEST CASE 1: Standard Salary (₹500,000 CTC)
// ============================================
console.log('\n' + '='.repeat(70));
console.log('TEST CASE 1: Standard Salary - ₹500,000 Annual CTC');
console.log('='.repeat(70));

const result1 = engine.calculate(500000);
console.log('\nFinal Result:', JSON.stringify(result1, null, 2));

// ============================================
// TEST CASE 2: High Salary (₹1,500,000 CTC)
// ============================================
console.log('\n' + '='.repeat(70));
console.log('TEST CASE 2: High Salary - ₹1,500,000 Annual CTC');
console.log('='.repeat(70));

const result2 = engine.calculate(1500000);
console.log('\nFinal Result:', JSON.stringify(result2, null, 2));

// ============================================
// TEST CASE 3: Entry-Level Salary (₹300,000 CTC)
// ============================================
console.log('\n' + '='.repeat(70));
console.log('TEST CASE 3: Entry-Level Salary - ₹300,000 Annual CTC');
console.log('='.repeat(70));

const result3 = engine.calculate(300000);
console.log('\nFinal Result:', JSON.stringify(result3, null, 2));

// ============================================
// TEST CASE 4: Tax Breakdown
// ============================================
console.log('\n' + '='.repeat(70));
console.log('TEST CASE 4: Tax Breakdown Analysis');
console.log('='.repeat(70));

const taxableIncome = 750000;
const taxBreakdown = engine.getTaxBreakdown(taxableIncome);
console.log(`\nTaxable Income: ₹${taxableIncome}`);
console.log('Tax Breakdown:', JSON.stringify(taxBreakdown, null, 2));

// ============================================
// VALIDATION CHECK
// ============================================
console.log('\n' + '='.repeat(70));
console.log('VALIDATION CHECK');
console.log('='.repeat(70));

const testCases = [
    { ctc: 300000, name: '₹3 Lakh' },
    { ctc: 500000, name: '₹5 Lakh' },
    { ctc: 1000000, name: '₹10 Lakh' },
    { ctc: 2000000, name: '₹20 Lakh' }
];

console.log('\nRunning validation across multiple salary levels:\n');
testCases.forEach(test => {
    const result = engine.calculate(test.ctc);
    console.log(`${test.name}:`);
    console.log(`  ✓ Monthly Gross: ₹${result.monthlyGross}`);
    console.log(`  ✓ Monthly Net: ₹${result.monthlyNetSalary}`);
    console.log(`  ✓ Monthly Deductions: ₹${result.monthlyDeductions}`);
    console.log(`  ✓ CTC Match: ${result.validation.ctcMatch ? '✓ PASS' : '✗ FAIL'}`);
    console.log();
});

// ============================================
// BATCH CALCULATION
// ============================================
console.log('\n' + '='.repeat(70));
console.log('BATCH CALCULATION EXAMPLE');
console.log('='.repeat(70));

const employees = [
    { id: 'EMP001', name: 'Rajesh Kumar', annualCTC: 600000 },
    { id: 'EMP002', name: 'Priya Singh', annualCTC: 800000 },
    { id: 'EMP003', name: 'Amit Patel', annualCTC: 1200000 }
];

const batchResults = engine.calculateBatch(employees);
console.log('\nBatch Results:');
batchResults.forEach(emp => {
    console.log(`\n${emp.name} (${emp.employeeId}):`);
    console.log(`  CTC: ₹${emp.salary.annualCTC}`);
    console.log(`  Monthly Gross: ₹${emp.salary.monthlyGross}`);
    console.log(`  Monthly Net: ₹${emp.salary.monthlyNetSalary}`);
});

module.exports = { engine, testCases };
