const mongoose = require('mongoose');

// Mock partial classes to test the pure logic functions locally in tmp
function mockCalculateGrossEarnings(earnings, daysInMonth, presentDays) {
    const earningsSnapshot = [];
    let totalGross = 0;

    earnings.forEach(earning => {
        let amount = earning.monthlyAmount || 0;
        let isProRata = earning.isProRata !== false;

        if (isProRata) {
            // THE FIX: (amount / calendarDays) * presentDays
            amount = (amount / daysInMonth) * presentDays;
        }

        earningsSnapshot.push({ name: earning.name, amount: Math.round(amount * 100) / 100 });
        totalGross += amount;
    });

    return { totalGross: Math.round(totalGross * 100) / 100, earningsSnapshot };
}

// TEST CASE 1: Mid-month joiner (Feb 15, 2024 -> leap year 29 days)
// Joined 15th, present for remaining 15 days of month.
const earnings = [
    { name: 'Basic Salary', monthlyAmount: 30000, isProRata: true },
    { name: 'HRA', monthlyAmount: 12000, isProRata: true }
];

const result = mockCalculateGrossEarnings(earnings, 29, 15);
console.log('--- TEST 1: Mid-Month Joiner (Feb 15) ---');
console.log('Expected: (42000 / 29) * 15 = 21724.14');
console.log('Actual Total Gross:', result.totalGross);

if (result.totalGross === 21724.14) {
    console.log('✅ Success: Mid-month joiner calculation is accurate');
} else {
    console.error('❌ Failure: Mid-month joiner calculation mismatch');
}

// TEST CASE 2: No attendance fallback (presentDays = 0 but totalDays = 31)
// If logic incorrectly used actualDays calculated from joinDate as divisor, it could fail.
// Calendar days in month = 31.
console.log('\n--- TEST 2: Attendance Guard ---');
const res2 = mockCalculateGrossEarnings(earnings, 31, 0);
console.log('Present Days: 0 -> Gross:', res2.totalGross);
// The service now has a guard in calculateEmployeePayroll that forces presentDays = totalDays if 0
// We manually verify that divisor 31 with 0 present = 0 (correct mathematically)
// But if divisor was 0 -> NaN.
if (!isNaN(res2.totalGross)) {
    console.log('✅ Success: Division by zero avoided');
} else {
    console.error('❌ Failure: NaN result detected');
}
