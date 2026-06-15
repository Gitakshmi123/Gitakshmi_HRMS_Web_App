const { calculateProratedLeaveForYear, validateJoiningDate } = require('./server/services/leaveManagement.service');

// Mock data from user screenshot
const joiningDate = '2026-02-01'; // 01/02/2026
const year = 2026;
const yearlyLeave = 12;

try {
    const result = calculateProratedLeaveForYear(yearlyLeave, joiningDate, year);
    console.log('Result for joining Feb 1st, 2026:', result);
    
    const janJoin = calculateProratedLeaveForYear(yearlyLeave, '2026-01-01', 2026);
    console.log('Result for joining Jan 1st, 2026:', janJoin);

    const decJoin = calculateProratedLeaveForYear(yearlyLeave, '2026-12-01', 2026);
    console.log('Result for joining Dec 1st, 2026:', decJoin);
} catch (e) {
    console.error(e);
}
