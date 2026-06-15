/**
 * Test script for Indian Phone Number Regex
 * Run with: node server/tests/validate_phone.test.js
 */

const indianPhoneRe = /^[6-9]\d{9}$/;

const testCases = [
    { phone: '9876543210', expected: true, desc: 'Valid number starting with 9' },
    { phone: '8876543210', expected: true, desc: 'Valid number starting with 8' },
    { phone: '7876543210', expected: true, desc: 'Valid number starting with 7' },
    { phone: '6876543210', expected: true, desc: 'Valid number starting with 6' },
    { phone: '5876543210', expected: false, desc: 'Invalid: Starts with 5' },
    { phone: '987654321', expected: false, desc: 'Invalid: Too short (9 digits)' },
    { phone: '98765432101', expected: false, desc: 'Invalid: Too long (11 digits)' },
    { phone: '987654321a', expected: false, desc: 'Invalid: Contains alpha' },
    { phone: ' 9876543210', expected: false, desc: 'Invalid: Leading space' },
    { phone: '9876543210 ', expected: false, desc: 'Invalid: Trailing space' },
];

console.log('='.repeat(60));
console.log('INDIAN PHONE NUMBER REGEX TEST');
console.log('='.repeat(60));

let passed = 0;
testCases.forEach((tc, idx) => {
    const result = indianPhoneRe.test(tc.phone);
    const status = result === tc.expected ? '✅ PASS' : '❌ FAIL';
    if (result === tc.expected) passed++;
    console.log(`${status} [Test ${idx + 1}]: ${tc.desc} ("${tc.phone}") -> Result: ${result}`);
});

console.log('='.repeat(60));
console.log(`Summary: ${passed}/${testCases.length} tests passed.`);
console.log('='.repeat(60));

if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
