// CRITICAL FIX: Add this code after line 475 in payroll.service.js
// This fixes the zero salary issue when attendance records are missing

// After the line:
//     employee._id // For logging
// );

// Add this code:

// 🛡️ SAFETY: If no attendance records or presentDays is 0, assume full month present
// This prevents zero salary when attendance is not tracked
if (attendanceRecords.length === 0) {
    console.warn(`⚠️ [ATTENDANCE] No attendance records found for ${employee.firstName}. Assuming full month present.`);
    attendanceSummary.presentDays = attendanceSummary.totalDays;
} else if (attendanceSummary.presentDays === 0) {
    console.warn(`⚠️ [ATTENDANCE] Present days is 0 for ${employee.firstName}. Assuming full month present.`);
    attendanceSummary.presentDays = attendanceSummary.totalDays;
}

console.log(`📊 [FINAL ATTENDANCE] Using Present Days: ${attendanceSummary.presentDays} / ${attendanceSummary.totalDays}`);
