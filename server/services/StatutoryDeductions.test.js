/**
 * StatutoryDeductions.test.js
 * 
 * Test suite for statutory deductions calculations
 * Verifies compliance with EPF and ESI rules
 */

const StatutoryDeductions = require('./StatutoryDeductions');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║    STATUTORY DEDUCTIONS TEST SUITE                          ║');
console.log('║    Testing Indian EPF & ESI Calculation Rules               ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Test 1: Basic salary with wage ceiling applied
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: High Basic Salary (Wage Ceiling Applied)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine1 = new StatutoryDeductions();
const result1 = engine1.calculate(20000, 41667);

console.log('Scenario: High basic salary above ceiling (₹20,000) with Gross > ESI limit');
console.log('Expected:');
console.log('  • PF Base applied: ₹15,000 (ceiling limit)');
console.log('  • Employee PF: ₹1,800 (15,000 × 0.12)');
console.log('  • Employer PF: ₹1,800 (same rate)');
console.log('  • ESI: ₹0 (Gross ₹41,667 > ESI limit ₹21,000 = NOT eligible)');
console.log('\nActual:');
console.log(`  • Employee PF: ₹${result1.deductions.employeePF}`);
console.log(`  • Employer PF: ₹${result1.contributions.employerPF}`);
console.log(`  • Employee ESI: ₹${result1.deductions.employeeESI}`);
console.log(`  • Employer ESI: ₹${result1.contributions.employerESI}`);
console.log(`  • Total Employee Deductions: ₹${result1.deductions.total}`);

const test1Pass = 
    result1.deductions.employeePF === 1800 &&
    result1.contributions.employerPF === 1800 &&
    result1.deductions.employeeESI === 0;

console.log(`\nResult: ${test1Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 2: Entry-level salary without wage ceiling
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: Entry-Level Salary (No Wage Ceiling)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine2 = new StatutoryDeductions();
const result2 = engine2.calculate(8333.33, 16666.67);

console.log('Scenario: Entry-level salary below ceiling (₹8,333.33)');
console.log('Expected:');
console.log('  • PF Base: ₹8,333.33 (no ceiling applied)');
console.log('  • Employee PF: ₹1,000 (8,333.33 × 0.12)');
console.log('  • Employer PF: ₹1,000 (same rate)');
console.log('  • ESI eligible: Yes (Gross ₹16,666.67 ≤ 21,000)');
console.log('  • Employee ESI: ₹125 (0.75% of 16,666.67)');
console.log('\nActual:');
console.log(`  • Employee PF: ₹${result2.deductions.employeePF}`);
console.log(`  • Employer PF: ₹${result2.contributions.employerPF}`);
console.log(`  • ESI Eligible: ${result2.breakdown.esi.eligible}`);
console.log(`  • Employee ESI: ₹${result2.deductions.employeeESI}`);
console.log(`  • Employer ESI: ₹${result2.contributions.employerESI}`);

const test2Pass = 
    Math.abs(result2.deductions.employeePF - 1000) < 0.01 &&
    result2.breakdown.esi.eligible &&
    Math.abs(result2.deductions.employeeESI - 125) < 0.01;

console.log(`\nResult: ${test2Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 3: High salary - ESI not eligible
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: High Salary (ESI Not Eligible)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine3 = new StatutoryDeductions();
const result3 = engine3.calculate(25000, 50000);

console.log('Scenario: High salary with gross > ESI limit');
console.log('Expected:');
console.log('  • PF Base: ₹15,000 (ceiling applied)');
console.log('  • Employee PF: ₹1,800 (15,000 × 0.12)');
console.log('  • ESI eligible: No (Gross ₹50,000 > ₹21,000 limit)');
console.log('  • Employee ESI: ₹0');
console.log('\nActual:');
console.log(`  • Employee PF: ₹${result3.deductions.employeePF}`);
console.log(`  • ESI Eligible: ${result3.breakdown.esi.eligible}`);
console.log(`  • Employee ESI: ₹${result3.deductions.employeeESI}`);
console.log(`  • Total Deductions: ₹${result3.deductions.total}`);

const test3Pass = 
    result3.deductions.employeePF === 1800 &&
    !result3.breakdown.esi.eligible &&
    result3.deductions.employeeESI === 0;

console.log(`\nResult: ${test3Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 4: Exactly at ESI boundary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 4: ESI Boundary Test (Gross = ₹21,000)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine4 = new StatutoryDeductions();
const result4 = engine4.calculate(14000, 21000);

console.log('Scenario: Gross exactly at ESI eligibility limit');
console.log('Expected:');
console.log('  • ESI eligible: Yes (Gross ₹21,000 = limit is included)');
console.log('  • Employee ESI: ₹157.50 (0.75% of 21,000)');
console.log('\nActual:');
console.log(`  • ESI Eligible: ${result4.breakdown.esi.eligible}`);
console.log(`  • Employee ESI: ₹${result4.deductions.employeeESI}`);
console.log(`  • Employee PF: ₹${result4.deductions.employeePF}`);

const test4Pass = 
    result4.breakdown.esi.eligible &&
    Math.abs(result4.deductions.employeeESI - 157.50) < 0.01;

console.log(`\nResult: ${test4Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 5: PF disabled scenario
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 5: PF Disabled Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine5 = new StatutoryDeductions({ pfEnabled: false });
const result5 = engine5.calculate(10000, 20000);

console.log('Scenario: PF disabled but ESI enabled');
console.log('Expected:');
console.log('  • Employee PF: ₹0');
console.log('  • Employer PF: ₹0');
console.log('  • ESI eligible: Yes');
console.log('  • Employee ESI: ₹150 (0.75% of 20,000)');
console.log('\nActual:');
console.log(`  • Employee PF: ₹${result5.deductions.employeePF}`);
console.log(`  • Employer PF: ₹${result5.contributions.employerPF}`);
console.log(`  • Employee ESI: ₹${result5.deductions.employeeESI}`);

const test5Pass = 
    result5.deductions.employeePF === 0 &&
    result5.contributions.employerPF === 0 &&
    Math.abs(result5.deductions.employeeESI - 150) < 0.01;

console.log(`\nResult: ${test5Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 6: ESI disabled scenario
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 6: ESI Disabled Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine6 = new StatutoryDeductions({ esiEnabled: false });
const result6 = engine6.calculate(10000, 20000);

console.log('Scenario: ESI disabled but PF enabled');
console.log('Expected:');
console.log('  • Employee ESI: ₹0');
console.log('  • Employer ESI: ₹0');
console.log('  • Employee PF: ₹1,200 (10,000 × 0.12)');
console.log('\nActual:');
console.log(`  • Employee ESI: ₹${result6.deductions.employeeESI}`);
console.log(`  • Employer ESI: ₹${result6.contributions.employerESI}`);
console.log(`  • Employee PF: ₹${result6.deductions.employeePF}`);

const test6Pass = 
    result6.deductions.employeeESI === 0 &&
    result6.contributions.employerESI === 0 &&
    result6.deductions.employeePF === 1200;

console.log(`\nResult: ${test6Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 7: Batch processing
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 7: Batch Processing');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine7 = new StatutoryDeductions();
const employees = [
    { basic: 8333.33, gross: 16666.67 },
    { basic: 15000, gross: 41667 },
    { basic: 25000, gross: 50000 }
];

const batchResults = engine7.calculateBatch(employees);

console.log('Scenario: Process 3 employees with different salary levels');
console.log(`\nProcessed: ${batchResults.length} employees`);
console.log(`Successful: ${batchResults.filter(r => !r.error).length}\n`);

batchResults.forEach((r, idx) => {
    console.log(`Employee ${idx + 1}:`);
    console.log(`  • Basic: ₹${r.basic}`);
    console.log(`  • Gross: ₹${r.gross}`);
    console.log(`  • Employee PF: ₹${r.deductions.deductions.employeePF}`);
    console.log(`  • Employee ESI: ₹${r.deductions.deductions.employeeESI}`);
    console.log(`  • Total Deductions: ₹${r.deductions.deductions.total}\n`);
});

const test7Pass = batchResults.length === 3 && batchResults.every(r => !r.error);
console.log(`Result: ${test7Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 8: Precision rounding
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 8: Precision Rounding (2 Decimal Places)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine8 = new StatutoryDeductions();
const result8 = engine8.calculate(12345, 24690);

console.log('Scenario: Decimal precision verification');
console.log('Expected: All values rounded to 2 decimal places');
console.log(`\nActual values (checking decimal places):`);
console.log(`  • Employee PF: ₹${result8.deductions.employeePF} (decimals: ${String(result8.deductions.employeePF).split('.')[1]?.length || 0})`);
console.log(`  • Employee ESI: ₹${result8.deductions.employeeESI} (decimals: ${String(result8.deductions.employeeESI).split('.')[1]?.length || 0})`);
console.log(`  • Total: ₹${result8.deductions.total} (decimals: ${String(result8.deductions.total).split('.')[1]?.length || 0})`);

const hasMaxTwoDecimals = (val) => {
    const str = String(val);
    const decimalPart = str.split('.')[1];
    return !decimalPart || decimalPart.length <= 2;
};

const test8Pass = 
    hasMaxTwoDecimals(result8.deductions.employeePF) &&
    hasMaxTwoDecimals(result8.deductions.employeeESI) &&
    hasMaxTwoDecimals(result8.deductions.total);

console.log(`\nResult: ${test8Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 9: Compliance report generation
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 9: Compliance Report Generation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const engine9 = new StatutoryDeductions();
const report = engine9.generateComplianceReport(15000, 30000);

console.log('Report excerpt:');
const reportLines = report.split('\n').slice(0, 15);
reportLines.forEach(line => console.log(line));

const test9Pass = report.includes('EPF') && report.includes('ESI') && report.includes('VALIDATION');
console.log(`\n... (report continues)`);
console.log(`Result: ${test9Pass ? '✓ PASS' : '✗ FAIL'}\n`);

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const tests = [
    { name: 'High Basic (Wage Ceiling)', pass: test1Pass },
    { name: 'Entry-Level (No Ceiling)', pass: test2Pass },
    { name: 'High Salary (ESI Not Eligible)', pass: test3Pass },
    { name: 'ESI Boundary Test', pass: test4Pass },
    { name: 'PF Disabled', pass: test5Pass },
    { name: 'ESI Disabled', pass: test6Pass },
    { name: 'Batch Processing', pass: test7Pass },
    { name: 'Precision Rounding', pass: test8Pass },
    { name: 'Compliance Report', pass: test9Pass }
];

let passCount = 0;
tests.forEach((test, idx) => {
    const status = test.pass ? '✓' : '✗';
    console.log(`${idx + 1}. ${status} ${test.name}`);
    if (test.pass) passCount++;
});

console.log(`\nTotal: ${passCount}/${tests.length} tests passed`);
console.log(`Success Rate: ${((passCount / tests.length) * 100).toFixed(2)}%\n`);

if (passCount === tests.length) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  ALL TESTS PASSED ✓                          ║');
    console.log('║         Statutory deductions implementation verified         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
} else {
    console.log('⚠️  Some tests failed. Review implementation.\n');
}
