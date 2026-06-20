const dayjs = require('dayjs');

exports.validateConflicts = async (tenantDb, assignments) => {
    const LeaveRequest = tenantDb.model('LeaveRequest');
    const Holiday = tenantDb.model('Holiday');
    
    let conflicts = [];

    for (const assignment of assignments) {
        // 1. Leave Conflict Check
        const leaves = await LeaveRequest.find({
            employee: assignment.employeeId,
            status: 'Approved',
            $or: [
                { startDate: { $lte: assignment.endDate }, endDate: { $gte: assignment.startDate } }
            ]
        }).lean();

        if (leaves.length > 0) {
            conflicts.push({
                employeeId: assignment.employeeId,
                weekNo: assignment.weekNo,
                type: 'Leave Conflict',
                message: `Employee has an approved leave from ${dayjs(leaves[0].startDate).format('YYYY-MM-DD')} to ${dayjs(leaves[0].endDate).format('YYYY-MM-DD')}.`
            });
        }

        // 2. Holiday Conflict Check (Optional depending on business rule)
        // Usually shifts on holidays are marked as OT or Holiday Shift
        const holidays = await Holiday.find({
            tenant: assignment.tenant,
            date: { $gte: assignment.startDate, $lte: assignment.endDate }
        }).lean();

        if (holidays.length > 0) {
            conflicts.push({
                employeeId: assignment.employeeId,
                weekNo: assignment.weekNo,
                type: 'Holiday Warning',
                message: `Week includes holiday: ${holidays[0].name}.`
            });
        }
    }

    return conflicts;
};

// Check for Fair Rotation (Continuous Night Shifts)
exports.validateFairRotation = async (tenantDb, assignments, rosterEmployees) => {
    const ShiftMaster = tenantDb.model('ShiftMaster');
    
    // Get night shifts
    const nightShifts = await ShiftMaster.find({
        name: /night/i
    }).lean();
    
    const nightShiftIds = nightShifts.map(s => s._id.toString());
    let warnings = [];

    for (const empId of rosterEmployees) {
        let nightCount = 0;
        
        const empAssignments = assignments
            .filter(a => a.employeeId.toString() === empId.toString())
            .sort((a, b) => a.weekNo - b.weekNo);

        for (const a of empAssignments) {
            if (nightShiftIds.includes(a.shiftId.toString())) {
                nightCount++;
                if (nightCount >= 2) { // 2 continuous weeks of night
                    warnings.push({
                        employeeId: empId,
                        message: `Employee is assigned continuous night shifts (Week ${a.weekNo}). Consider Fair Rotation.`
                    });
                }
            } else {
                nightCount = 0;
            }
        }
    }

    return warnings;
};
