const { calculateProratedLeaveForYear } = require('../server/services/leaveManagement.service');

const testCases = [
    {
        name: "Joined before target year (e.g. joined Dec 15th, 2025 for 2026 calculation)",
        yearlyLeave: 7,
        joiningDate: '2025-12-15',
        year: 2026,
        leaveKey: 'CL',
        joiningPayableDays: null, // not relevant since joined in previous year
        expected: 7.00
    },
    {
        name: "Joined Jan 1st, 2026 (joining month has >= 20 payable days)",
        yearlyLeave: 7,
        joiningDate: '2026-01-01',
        year: 2026,
        leaveKey: 'CL',
        joiningPayableDays: 20,
        expected: 7.00
    },
    {
        name: "Joined Jan 15th, 2026 (joining month has < 20 payable days, e.g. 15)",
        yearlyLeave: 7,
        joiningDate: '2026-01-15',
        year: 2026,
        leaveKey: 'CL',
        joiningPayableDays: 15,
        expected: 0.00
    },
    {
        name: "Joined Jun 4th, 2026 (joining month has >= 20 payable days, 7 months remaining: Jun to Dec)",
        yearlyLeave: 7,
        joiningDate: '2026-06-04',
        year: 2026,
        leaveKey: 'CL',
        joiningPayableDays: 22,
        expected: 4.08 // 7 * 7 / 12 = 4.08333... rounded to 2 decimals -> 4.08
    },
    {
        name: "Joined Jun 15th, 2026 (joining month has < 20 payable days)",
        yearlyLeave: 7,
        joiningDate: '2026-06-15',
        year: 2026,
        leaveKey: 'CL',
        joiningPayableDays: 10,
        expected: 0.00
    },
    {
        name: "Joined Aug 1st, 2026 (joining month has >= 20 payable days, 5 months remaining: Aug to Dec)",
        yearlyLeave: 7,
        joiningDate: '2026-08-01',
        year: 2026,
        leaveKey: 'CL',
        joiningPayableDays: 21,
        expected: 2.92 // 7 * 5 / 12 = 2.91666... rounded to 2 decimals -> 2.92
    },
    {
        name: "Joined Aug 1st, 2026 for SL (joining month has >= 20 payable days)",
        yearlyLeave: 7,
        joiningDate: '2026-08-01',
        year: 2026,
        leaveKey: 'SL',
        joiningPayableDays: 21,
        expected: 2.92
    },
    {
        name: "Non-CL/SL leave type (e.g. EL) should use standard integer rounding and not be affected by 20-day rule",
        yearlyLeave: 12,
        joiningDate: '2026-06-04',
        year: 2026,
        leaveKey: 'EL',
        joiningPayableDays: 5, // < 20, but EL is not affected
        expected: 7 // (12 / 12) * 7 = 7
    }
];

let allPassed = true;

console.log("=== Testing CL/SL Proration Calculations ===\n");

for (const tc of testCases) {
    try {
        const result = calculateProratedLeaveForYear(
            tc.yearlyLeave,
            tc.joiningDate,
            tc.year,
            0,
            tc.leaveKey,
            tc.joiningPayableDays
        );
        const passed = result === tc.expected;
        console.log(`${passed ? '✓' : '✗'} [${tc.leaveKey}] ${tc.name}`);
        console.log(`   Inputs: DOJ=${tc.joiningDate}, TargetYear=${tc.year}, YearlyLeave=${tc.yearlyLeave}, JoiningPayableDays=${tc.joiningPayableDays}`);
        console.log(`   Result: ${result} | Expected: ${tc.expected}`);
        if (!passed) allPassed = false;
    } catch (e) {
        console.error(`✗ Error in "${tc.name}":`, e.message);
        allPassed = false;
    }
    console.log();
}

if (allPassed) {
    console.log("SUCCESS: All proration test cases passed perfectly!");
    process.exit(0);
} else {
    console.error("FAILURE: Some test cases did not match expected values.");
    process.exit(1);
}
