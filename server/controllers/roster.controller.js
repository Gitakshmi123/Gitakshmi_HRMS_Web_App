const EmployeeRosterSchema = require('../models/EmployeeRoster');
const ShiftAssignmentSchema = require('../models/ShiftAssignment');
const EmployeeSchema = require('../models/Employee');
const dayjs = require('dayjs');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        EmployeeRoster: db.model('EmployeeRoster', EmployeeRosterSchema),
        ShiftAssignment: db.model('ShiftAssignment', ShiftAssignmentSchema),
        Employee: db.model('Employee', EmployeeSchema)
    };
};

/**
 * Get monthly roster for employees
 * GET /api/roster
 * Query params: month (YYYY-MM), tenant (optional if using header)
 */
exports.getMonthlyRoster = async (req, res) => {
    try {
        const { EmployeeRoster } = getModels(req);
        
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID required' });
        }

        const { month } = req.query; // format: YYYY-MM
        if (!month) {
            return res.status(400).json({ success: false, message: 'Month parameter (YYYY-MM) is required' });
        }

        const startDate = dayjs(`${month}-01`).startOf('month').toDate();
        const endDate = dayjs(`${month}-01`).endOf('month').toDate();

        const rosters = await EmployeeRoster.find({
            tenant: tenantId,
            date: { $gte: startDate, $lte: endDate }
        })
        .populate('employeeId', 'firstName lastName employeeId profilePic')
        .populate('shiftMasterId', 'name code startTime endTime colorCode')
        .lean();

        res.status(200).json({
            success: true,
            data: rosters
        });
    } catch (error) {
        console.error('[GET_MONTHLY_ROSTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * Auto-Generate Roster based on active Shift Assignments
 * POST /api/roster/generate
 * Body: { month: "YYYY-MM" }
 */
exports.generateRoster = async (req, res) => {
    try {
        const { EmployeeRoster, ShiftAssignment, Employee } = getModels(req);

        const tenantId = req.headers['x-tenant-id'];
        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const { month } = req.body;
        if (!month) return res.status(400).json({ success: false, message: 'Month parameter is required' });

        const startOfMonth = dayjs(`${month}-01`).startOf('month');
        const endOfMonth = startOfMonth.endOf('month');
        const daysInMonth = startOfMonth.daysInMonth();

        // 1. Fetch all active shift assignments
        const assignments = await ShiftAssignment.find({
            tenant: tenantId,
            isActive: true
        }).populate('shiftMasterId').lean();

        if (!assignments.length) {
            return res.status(400).json({ success: false, message: 'No active shift assignments found to generate roster.' });
        }

        // 2. We need a list of active employees
        const employees = await Employee.find({ 
            status: { $in: ['Active', 'active', 'ACTIVE'] },
            $or: [{ mainCompanyId: tenantId }, { tenant: tenantId }]
        }).select('_id departmentId branchId designationId').lean();

        let rosterDocs = [];

        // Simple generation: For each employee, find their highest priority assignment
        for (const emp of employees) {
            let assignedShift = null;

            const empAssign = assignments.find(a => a.entityType === 'Employee' && a.entityId?.toString() === emp._id.toString());
            const deptAssign = assignments.find(a => a.entityType === 'Department' && a.entityId?.toString() === emp.departmentId?.toString());
            const branchAssign = assignments.find(a => a.entityType === 'Branch' && a.entityId?.toString() === emp.branchId?.toString());
            const desigAssign = assignments.find(a => a.entityType === 'Designation' && a.entityId?.toString() === emp.designationId?.toString());
            const companyAssign = assignments.find(a => a.entityType === 'Company');

            assignedShift = empAssign || deptAssign || branchAssign || desigAssign || companyAssign;

            if (assignedShift && assignedShift.shiftMasterId) {
                for (let i = 1; i <= daysInMonth; i++) {
                    const currentDate = startOfMonth.date(i).toDate();
                    
                    rosterDocs.push({
                        tenant: tenantId,
                        employeeId: emp._id,
                        date: currentDate,
                        shiftMasterId: assignedShift.shiftMasterId._id,
                        generatedBy: 'Assignment_Engine',
                        status: 'Published'
                    });
                }
            }
        }

        // Delete existing draft/published roster for this month to prevent duplicates
        await EmployeeRoster.deleteMany({
            tenant: tenantId,
            date: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() },
            generatedBy: 'Assignment_Engine'
        });

        // Insert new
        if (rosterDocs.length > 0) {
            await EmployeeRoster.insertMany(rosterDocs);
        }

        res.status(200).json({
            success: true,
            message: `Successfully generated ${rosterDocs.length} roster entries for ${month}.`,
            count: rosterDocs.length
        });

    } catch (error) {
        console.error('[GENERATE_ROSTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
