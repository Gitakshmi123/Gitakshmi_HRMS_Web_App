const mongoose = require('mongoose');

const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database not initialized.');
    }
    return {
        Employee: req.tenantDB.model('Employee'),
        LeavePolicy: req.tenantDB.model('LeavePolicy'),
        LeaveBalance: req.tenantDB.model('LeaveBalance'),
        LeaveRequest: req.tenantDB.model('LeaveRequest'),
        LeaveLedger: req.tenantDB.model('LeaveLedger'),
        Department: req.tenantDB.model('Department'),
        Branch: req.tenantDB.model('Branch'),
        Grade: req.tenantDB.model('Grade'),
        Designation: req.tenantDB.model('Designation')
    };
};

// Helper: check if HR/Admin
const isHRUser = (role) => true; // Secured at route-level checkPermission middleware

// 2. Policy Assignment Analytics
exports.getPolicyAssignmentAnalytics = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { Employee, LeavePolicy } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);

        const policies = await LeavePolicy.find({ tenant: tenantId, isActive: { $ne: false } }).lean();
        const analytics = [];

        for (const policy of policies) {
            const count = await Employee.countDocuments({
                tenant: tenantId,
                leavePolicy: policy._id,
                status: { $in: ['active', 'Active', 'ACTIVE'] }
            });
            analytics.push({
                policyId: policy._id,
                policyName: policy.name,
                employeeCount: count
            });
        }

        // Count employees with no explicit policy
        const noPolicyCount = await Employee.countDocuments({
            tenant: tenantId,
            leavePolicy: null,
            status: { $in: ['active', 'Active', 'ACTIVE'] }
        });

        analytics.push({
            policyId: 'unassigned',
            policyName: 'Unassigned / Auto Matching',
            employeeCount: noPolicyCount
        });

        res.json(analytics);
    } catch (e) {
        console.error('getPolicyAssignmentAnalytics Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Fetch employees assigned to a specific policy
exports.getEmployeesForPolicy = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { Employee } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const { policyId } = req.params;

        const query = {
            tenant: tenantId,
            status: { $in: ['active', 'Active', 'ACTIVE'] }
        };

        if (policyId === 'unassigned') {
            query.leavePolicy = null;
        } else {
            query.leavePolicy = new mongoose.Types.ObjectId(policyId);
        }

        const employees = await Employee.find(query)
            .select('firstName lastName employeeId department designation grade departmentId designationId gradeId branchId')
            .populate('departmentId', 'name')
            .populate('designationId', 'name')
            .populate('gradeId', 'name code')
            .populate('branchId', 'name')
            .lean();

        const formatted = employees.map(emp => ({
            _id: emp._id,
            name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
            employeeId: emp.employeeId,
            department: emp.departmentId?.name || emp.department || '—',
            designation: emp.designationId?.name || emp.designation || '—',
            grade: emp.gradeId?.code || emp.grade || '—',
            branch: emp.branchId?.name || '—'
        }));

        res.json(formatted);
    } catch (e) {
        console.error('getEmployeesForPolicy Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 3. Leave Balance Analytics (Department Wise)
exports.getLeaveBalanceAnalytics = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveBalance, Employee } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // 1. Build employee filter query based on query params
        const empQuery = {
            tenant: tenantId,
            status: { $in: ['active', 'Active', 'ACTIVE'] }
        };
        if (req.query.branchId) empQuery.branchId = new mongoose.Types.ObjectId(req.query.branchId);
        if (req.query.departmentId) empQuery.departmentId = new mongoose.Types.ObjectId(req.query.departmentId);
        if (req.query.gradeId) empQuery.gradeId = new mongoose.Types.ObjectId(req.query.gradeId);
        if (req.query.designationId) empQuery.designationId = new mongoose.Types.ObjectId(req.query.designationId);

        // 2. Fetch employee IDs matching filters and map them to their departments
        const employees = await Employee.find(empQuery)
            .select('_id department departmentId')
            .populate('departmentId', 'name')
            .lean();

        const empIds = employees.map(e => e._id);
        const empDeptMap = new Map();
        employees.forEach(emp => {
            const deptName = emp.departmentId?.name || emp.department || 'Unassigned';
            empDeptMap.set(emp._id.toString(), deptName);
        });

        // 3. Fetch balances for these employees
        const balances = await LeaveBalance.find({
            tenant: tenantId,
            year,
            employee: { $in: empIds }
        }).lean();

        // 4. Aggregate department-wise CL, SL, EL
        const deptBalances = {}; // { IT: { CL: 0, SL: 0, EL: 0 } }
        balances.forEach(bal => {
            const empIdStr = bal.employee.toString();
            const dept = empDeptMap.get(empIdStr) || 'Unassigned';
            const leaveType = String(bal.leaveType || '').toUpperCase().trim();

            if (!deptBalances[dept]) {
                deptBalances[dept] = { CL: 0, SL: 0, EL: 0, Others: 0 };
            }

            if (leaveType === 'CL') {
                deptBalances[dept].CL += bal.available || 0;
            } else if (leaveType === 'SL' || leaveType === 'SICK LEAVE') {
                deptBalances[dept].SL += bal.available || 0;
            } else if (leaveType === 'EL' || leaveType === 'EARNED LEAVE' || leaveType === 'PL' || leaveType === 'PRIVILEGE LEAVE') {
                deptBalances[dept].EL += bal.available || 0;
            } else {
                deptBalances[dept].Others += bal.available || 0;
            }
        });

        const formatted = Object.keys(deptBalances).map(dept => ({
            department: dept,
            CL: Number(deptBalances[dept].CL.toFixed(2)),
            SL: Number(deptBalances[dept].SL.toFixed(2)),
            EL: Number(deptBalances[dept].EL.toFixed(2)),
            Others: Number(deptBalances[dept].Others.toFixed(2))
        }));

        res.json(formatted);
    } catch (e) {
        console.error('getLeaveBalanceAnalytics Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 4. Leave Utilization Report
exports.getLeaveUtilizationReport = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveBalance, Employee } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Fetch active employee IDs to avoid counting terminated employees' balances
        const activeEmpIds = await Employee.find({
            tenant: tenantId,
            status: { $in: ['active', 'Active', 'ACTIVE'] }
        }).distinct('_id');

        const balances = await LeaveBalance.find({
            tenant: tenantId,
            year,
            employee: { $in: activeEmpIds }
        }).lean();

        const utilization = {};

        balances.forEach(bal => {
            const leaveType = String(bal.leaveType || '').toUpperCase().trim();
            if (!utilization[leaveType]) {
                utilization[leaveType] = { allocated: 0, used: 0, balance: 0 };
            }
            utilization[leaveType].allocated += bal.total || 0;
            utilization[leaveType].used += bal.used || 0;
            utilization[leaveType].balance += bal.available || 0;
        });

        const formatted = Object.keys(utilization).map(type => ({
            leaveType: type,
            allocated: Number(utilization[type].allocated.toFixed(2)),
            used: Number(utilization[type].used.toFixed(2)),
            balance: Number(utilization[type].balance.toFixed(2))
        }));

        res.json(formatted);
    } catch (e) {
        console.error('getLeaveUtilizationReport Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 5. Pending Leave Report
exports.getPendingLeaveReport = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveRequest } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);

        const requests = await LeaveRequest.find({
            tenant: tenantId,
            status: 'Pending'
        })
            .populate({
                path: 'employee',
                select: 'firstName lastName employeeId department departmentId',
                populate: { path: 'departmentId', select: 'name' }
            })
            .sort({ createdAt: 1 })
            .lean();

        const formatted = requests.map(req => {
            const pendingSinceMs = Date.now() - new Date(req.createdAt).getTime();
            const pendingSinceDays = Math.floor(pendingSinceMs / (1000 * 60 * 60 * 24));
            
            return {
                _id: req._id,
                employeeName: req.employee ? `${req.employee.firstName || ''} ${req.employee.lastName || ''}`.trim() : 'Unknown',
                employeeId: req.employee?.employeeId || '—',
                department: req.employee?.departmentId?.name || req.employee?.department || '—',
                leaveType: req.leaveType,
                startDate: req.startDate,
                endDate: req.endDate,
                days: req.daysCount || 0,
                appliedDate: req.createdAt,
                pendingSinceDays: pendingSinceDays
            };
        });

        res.json(formatted);
    } catch (e) {
        console.error('getPendingLeaveReport Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 6. Leave Ledger (Audit Report)
exports.getLeaveLedgerAuditReport = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveLedger } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);

        const query = { tenant: tenantId };
        if (req.query.leaveType && req.query.leaveType !== 'All') {
            query.leaveType = String(req.query.leaveType).toUpperCase();
        }
        if (req.query.actionType && req.query.actionType !== 'All') {
            query.actionType = req.query.actionType;
        }
        if (req.query.year) {
            query.year = parseInt(req.query.year);
        }
        if (req.query.employeeId) {
            query.employee = new mongoose.Types.ObjectId(req.query.employeeId);
        }

        const logs = await LeaveLedger.find(query)
            .populate('employee', 'firstName lastName employeeId')
            .sort({ date: -1, createdAt: -1 })
            .limit(500) // increase limit since employee specific searches might be deeper
            .lean();

        const formatted = logs.map(log => ({
            _id: log._id,
            date: log.date || log.createdAt,
            employeeName: log.employee ? `${log.employee.firstName || ''} ${log.employee.lastName || ''}`.trim() : 'Unknown',
            employeeId: log.employee?.employeeId || '—',
            leaveType: log.leaveType,
            action: log.actionType,
            credit: log.days > 0 ? log.days : 0,
            debit: log.days < 0 ? Math.abs(log.days) : 0,
            previousBalance: log.previousBalance ?? 0,
            newBalance: log.newBalance ?? 0,
            remarks: log.remarks || '—',
            createdBy: log.createdBy || 'System'
        }));

        res.json(formatted);
    } catch (e) {
        console.error('getLeaveLedgerAuditReport Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 7. Monthly Leave Trends
exports.getMonthlyLeaveTrends = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveRequest } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        // Find all requests in this year
        const requests = await LeaveRequest.find({
            tenant: tenantId,
            startDate: { $gte: startDate, $lte: endDate }
        }).select('startDate daysCount status').lean();

        const monthlyCounts = Array(12).fill(0);
        requests.forEach(req => {
            if (req.startDate) {
                const month = new Date(req.startDate).getMonth(); // 0-11
                monthlyCounts[month] += 1; // Count requests
            }
        });

        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const formatted = months.map((month, idx) => ({
            month,
            requests: monthlyCounts[idx]
        }));

        res.json(formatted);
    } catch (e) {
        console.error('getMonthlyLeaveTrends Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 8. High Leave Users
exports.getHighLeaveUsers = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveRequest } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        // Aggregate total approved leave days per employee
        const aggregate = await LeaveRequest.aggregate([
            {
                $match: {
                    tenant: tenantId,
                    status: 'Approved',
                    startDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$employee',
                    totalDays: { $sum: '$daysCount' }
                }
            },
            {
                $sort: { totalDays: -1 }
            },
            {
                $limit: 10
            }
        ]);

        const Employee = req.tenantDB.model('Employee');
        const formatted = [];
        for (const item of aggregate) {
            const emp = await Employee.findById(item._id).select('firstName lastName employeeId departmentId department').populate('departmentId', 'name').lean();
            if (emp) {
                formatted.push({
                    employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                    employeeId: emp.employeeId,
                    department: emp.departmentId?.name || emp.department || '—',
                    totalLeaves: Number(item.totalDays.toFixed(2))
                });
            }
        }

        res.json(formatted);
    } catch (e) {
        console.error('getHighLeaveUsers Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 9. Sick Leave Analysis
exports.getSickLeaveAnalysis = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveRequest } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const minDays = parseFloat(req.query.minDays) || 0;

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        const aggregate = await LeaveRequest.aggregate([
            {
                $match: {
                    tenant: tenantId,
                    status: 'Approved',
                    leaveType: { $in: ['SL', 'Sick Leave', 'SICK LEAVE'] },
                    startDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$employee',
                    totalSL: { $sum: '$daysCount' }
                }
            },
            {
                $match: {
                    totalSL: { $gt: minDays }
                }
            },
            {
                $sort: { totalSL: -1 }
            }
        ]);

        const Employee = req.tenantDB.model('Employee');
        const formatted = [];
        for (const item of aggregate) {
            const emp = await Employee.findById(item._id).select('firstName lastName employeeId department departmentId').populate('departmentId', 'name').lean();
            if (emp) {
                formatted.push({
                    employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                    employeeId: emp.employeeId,
                    department: emp.departmentId?.name || emp.department || '—',
                    totalSL: Number(item.totalSL.toFixed(2))
                });
            }
        }

        res.json(formatted);
    } catch (e) {
        console.error('getSickLeaveAnalysis Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// 10. Leave Liability
exports.getLeaveLiability = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveBalance, Employee } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const activeEmpIds = await Employee.find({
            tenant: tenantId,
            status: { $in: ['active', 'Active', 'ACTIVE'] }
        }).distinct('_id');

        // Liability is typically calculated on Privilege / Earned Leaves (EL/PL)
        const balances = await LeaveBalance.find({
            tenant: tenantId,
            year,
            employee: { $in: activeEmpIds },
            leaveType: { $in: ['EL', 'PL', 'Earned Leave', 'Privilege Leave', 'EARNED LEAVE', 'PRIVILEGE LEAVE'] }
        }).lean();

        const totalELDays = balances.reduce((sum, bal) => sum + (bal.available || 0), 0);

        res.json({
            totalELDays: Number(totalELDays.toFixed(2)),
            activeEmployeesCount: activeEmpIds.length
        });
    } catch (e) {
        console.error('getLeaveLiability Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Excel/CSV Bulk Import for Opening Balances
exports.importOpeningBalances = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { Employee, LeaveBalance, LeaveLedger, LeavePolicy } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);

        const records = req.body;
        if (!Array.isArray(records)) {
            return res.status(400).json({ error: 'Invalid payload. Expected an array of records.' });
        }

        // Get list of valid leave types defined in active policies
        const policies = await LeavePolicy.find({ tenant: tenantId, isActive: true }).lean();
        const validLeaveTypes = new Set();
        policies.forEach(p => {
            if (p.rules) {
                p.rules.forEach(r => {
                    if (r.leaveType) {
                        validLeaveTypes.add(String(r.leaveType).trim().toUpperCase());
                    }
                });
            }
        });

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (let idx = 0; idx < records.length; idx++) {
            const row = records[idx];
            const empCode = String(row.employeeId || '').trim();
            const leaveType = String(row.leaveType || '').toUpperCase().trim();
            const openingBal = parseFloat(row.openingBalance);
            const year = parseInt(row.year) || new Date().getFullYear();

            if (!empCode || !leaveType || isNaN(openingBal) || openingBal < 0) {
                failCount++;
                errors.push(`Row ${idx + 1}: Missing fields or invalid opening balance.`);
                continue;
            }

            // Validate Leave Type
            if (validLeaveTypes.size > 0 && !validLeaveTypes.has(leaveType)) {
                failCount++;
                errors.push(`${empCode} - Invalid Leave Type "${leaveType}" (EMP201)`);
                continue;
            }

            try {
                // Find employee by employeeId (code)
                const employee = await Employee.findOne({ tenant: tenantId, employeeId: empCode });
                if (!employee) {
                    failCount++;
                    errors.push(`${empCode} - Employee Not Found (EMP105)`);
                    continue;
                }

                // Find or create leave balance
                let balance = await LeaveBalance.findOne({
                    tenant: tenantId,
                    employee: employee._id,
                    leaveType,
                    year
                });

                const prevOpening = balance ? (balance.opening ?? 0) : 0;
                const prevTotal = balance ? (balance.total ?? 0) : 0;
                const prevAvailable = balance ? (balance.available ?? 0) : 0;

                if (!balance) {
                    balance = new LeaveBalance({
                        tenant: tenantId,
                        employee: employee._id,
                        leaveType,
                        year,
                        used: 0,
                        pending: 0,
                        accrued: 0
                    });
                }

                balance.opening = openingBal;
                balance.isOpeningManual = true;
                balance.total = openingBal + (balance.accrued || 0);
                balance.available = balance.total - (balance.used || 0) - (balance.pending || 0);

                await balance.save();

                // Log to ledger
                await LeaveLedger.create({
                    tenant: tenantId,
                    employee: employee._id,
                    leaveType,
                    year,
                    actionType: 'Opening',
                    days: openingBal,
                    previousBalance: prevAvailable,
                    newBalance: balance.available,
                    remarks: `Bulk Opening Balance Import (Previous Opening: ${prevOpening})`
                });

                successCount++;
            } catch (err) {
                failCount++;
                errors.push(`Row ${idx + 1}: DB Error for employee "${empCode}": ${err.message}`);
            }
        }

        res.json({
            success: true,
            successCount,
            failCount,
            errors
        });
    } catch (e) {
        console.error('importOpeningBalances Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Get all leave requests report
exports.getAllLeaveRequestsReport = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { LeaveRequest } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        
        const query = { tenant: tenantId };
        
        if (req.query.year) {
            const year = parseInt(req.query.year);
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            query.startDate = { $gte: startDate, $lte: endDate };
        }
        
        if (req.query.leaveType && req.query.leaveType !== 'All') {
            query.leaveType = String(req.query.leaveType).toUpperCase();
        }
        
        if (req.query.status && req.query.status !== 'All') {
            query.status = req.query.status;
        }

        const requests = await LeaveRequest.find(query)
            .populate({
                path: 'employee',
                select: 'firstName lastName employeeId department departmentId branchId',
                populate: [
                    { path: 'departmentId', select: 'name' },
                    { path: 'branchId', select: 'name' }
                ]
            })
            .sort({ createdAt: -1 })
            .lean();

        let filtered = requests;
        if (req.query.branchId || req.query.departmentId) {
            filtered = requests.filter(r => {
                if (!r.employee) return false;
                if (req.query.branchId && String(r.employee.branchId || '') !== String(req.query.branchId)) return false;
                if (req.query.departmentId && String(r.employee.departmentId || '') !== String(req.query.departmentId)) return false;
                return true;
            });
        }

        const formatted = filtered.map(r => ({
            _id: r._id,
            employeeName: r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : 'Unknown',
            employeeId: r.employee?.employeeId || '—',
            department: r.employee?.departmentId?.name || r.employee?.department || '—',
            branch: r.employee?.branchId?.name || '—',
            leaveType: r.leaveType,
            startDate: r.startDate ? new Date(r.startDate).toLocaleDateString('en-GB') : '—',
            endDate: r.endDate ? new Date(r.endDate).toLocaleDateString('en-GB') : '—',
            days: r.daysCount || 0,
            status: r.status,
            appliedDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : '—'
        }));

        res.json(formatted);
    } catch (e) {
        console.error('getAllLeaveRequestsReport Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Get employee leave summary report (allocated, used, available per type)
exports.getEmployeeLeaveSummary = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { Employee, LeaveBalance } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const empQuery = {
            tenant: tenantId,
            status: { $in: ['active', 'Active', 'ACTIVE'] }
        };
        if (req.query.branchId) empQuery.branchId = new mongoose.Types.ObjectId(req.query.branchId);
        if (req.query.departmentId) empQuery.departmentId = new mongoose.Types.ObjectId(req.query.departmentId);

        const employees = await Employee.find(empQuery)
            .select('firstName lastName employeeId department departmentId branchId')
            .populate('departmentId', 'name')
            .populate('branchId', 'name')
            .lean();

        const empIds = employees.map(e => e._id);

        const balances = await LeaveBalance.find({
            tenant: tenantId,
            year,
            employee: { $in: empIds }
        }).lean();

        const empBalancesMap = new Map();
        balances.forEach(bal => {
            const empIdStr = bal.employee.toString();
            const leaveType = String(bal.leaveType || '').toUpperCase().trim();
            
            if (!empBalancesMap.has(empIdStr)) {
                empBalancesMap.set(empIdStr, {
                    CL: { total: 0, used: 0, available: 0 },
                    SL: { total: 0, used: 0, available: 0 },
                    EL: { total: 0, used: 0, available: 0 },
                    Others: { total: 0, used: 0, available: 0 }
                });
            }

            const data = empBalancesMap.get(empIdStr);
            let category = 'Others';
            if (leaveType === 'CL') category = 'CL';
            else if (leaveType === 'SL' || leaveType === 'SICK LEAVE') category = 'SL';
            else if (leaveType === 'EL' || leaveType === 'EARNED LEAVE' || leaveType === 'PL' || leaveType === 'PRIVILEGE LEAVE') category = 'EL';

            data[category].total += bal.total || 0;
            data[category].used += bal.used || 0;
            data[category].available += bal.available || 0;
        });

        const formatted = employees.map(emp => {
            const empIdStr = emp._id.toString();
            const b = empBalancesMap.get(empIdStr) || {
                CL: { total: 0, used: 0, available: 0 },
                SL: { total: 0, used: 0, available: 0 },
                EL: { total: 0, used: 0, available: 0 },
                Others: { total: 0, used: 0, available: 0 }
            };

            return {
                _id: emp._id,
                employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                employeeId: emp.employeeId || '—',
                department: emp.departmentId?.name || emp.department || '—',
                branch: emp.branchId?.name || '—',
                
                clAllocated: Number(b.CL.total.toFixed(2)),
                clUsed: Number(b.CL.used.toFixed(2)),
                clAvailable: Number(b.CL.available.toFixed(2)),

                slAllocated: Number(b.SL.total.toFixed(2)),
                slUsed: Number(b.SL.used.toFixed(2)),
                slAvailable: Number(b.SL.available.toFixed(2)),

                elAllocated: Number(b.EL.total.toFixed(2)),
                elUsed: Number(b.EL.used.toFixed(2)),
                elAvailable: Number(b.EL.available.toFixed(2)),

                othersAllocated: Number(b.Others.total.toFixed(2)),
                othersUsed: Number(b.Others.used.toFixed(2)),
                othersAvailable: Number(b.Others.available.toFixed(2))
            };
        });

        res.json(formatted);
    } catch (e) {
        console.error('getEmployeeLeaveSummary Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Get Master Leave Report (Stats + Sheet Datasets)
exports.getMasterLeaveReport = async (req, res) => {
    try {
        if (!isHRUser(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        const { Employee, LeaveBalance, LeaveLedger, LeavePolicy } = getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // 1. Build employee filter query based on query params
        const empQuery = { tenant: tenantId };
        
        // Employee Status Filter
        if (req.query.employeeStatus === 'Active') {
            empQuery.status = { $in: ['active', 'Active', 'ACTIVE', 'notice', 'Notice', 'Draft', 'draft'] };
        } else if (req.query.employeeStatus === 'Inactive') {
            empQuery.status = { $in: ['resigned', 'Resigned', 'inactive', 'Inactive', 'INACTIVE', 'terminated', 'Terminated'] };
        } else if (req.query.employeeStatus && req.query.employeeStatus !== 'All') {
            empQuery.status = req.query.employeeStatus;
        } else if (req.query.employeeStatus !== 'All') {
            // Default to Active if not specified
            empQuery.status = { $in: ['active', 'Active', 'ACTIVE', 'notice', 'Notice', 'Draft', 'draft'] };
        }

        // Other Employee Filters
        if (req.query.branchId) empQuery.branchId = new mongoose.Types.ObjectId(req.query.branchId);
        if (req.query.departmentId) empQuery.departmentId = new mongoose.Types.ObjectId(req.query.departmentId);
        if (req.query.designationId) empQuery.designationId = new mongoose.Types.ObjectId(req.query.designationId);
        if (req.query.policyId) empQuery.leavePolicy = new mongoose.Types.ObjectId(req.query.policyId);
        if (req.query.employeeId) empQuery._id = new mongoose.Types.ObjectId(req.query.employeeId);

        // Fetch employees matching filters
        const employees = await Employee.find(empQuery)
            .select('firstName lastName employeeId department departmentId designation designationId branchId leavePolicy status isActive')
            .populate('departmentId', 'name')
            .populate('designationId', 'name')
            .populate('branchId', 'name')
            .populate('leavePolicy', 'name rules')
            .lean();

        const empIds = employees.map(e => e._id);

        // 2. Fetch all Policies of this tenant for Sheet 1
        const policies = await LeavePolicy.find({ tenant: tenantId }).populate('departmentIds', 'name').lean();
        
        // Count employees assigned to each policy globally (using active employees)
        const policyEmpCounts = {};
        const allActiveEmps = await Employee.find({ 
            tenant: tenantId, 
            status: { $in: ['active', 'Active', 'ACTIVE', 'notice', 'Notice'] } 
        }).select('leavePolicy').lean();
        allActiveEmps.forEach(e => {
            if (e.leavePolicy) {
                const pid = e.leavePolicy.toString();
                policyEmpCounts[pid] = (policyEmpCounts[pid] || 0) + 1;
            }
        });

        const allDeptsCount = await req.tenantDB.model('Department').countDocuments({ tenant: tenantId });

        // Sheet 1: Policy Summary dataset
        const policySummary = [];
        policies.forEach(p => {
            const rules = p.rules || [];
            const deptsMapped = p.applicableTo === 'All' ? allDeptsCount : (p.applicableTo === 'Department' ? (p.departmentIds?.length || 0) : 0);
            const empsCovered = policyEmpCounts[p._id.toString()] || 0;
            
            rules.forEach(r => {
                policySummary.push({
                    "Policy Name": p.name || 'Unassigned',
                    "Leave Type": r.leaveType || '',
                    "Allocated Days": r.totalPerYear || 0,
                    "Departments Mapped": deptsMapped,
                    "Employees Covered": empsCovered
                });
            });
        });

        // 3. Fetch Balances for the filtered employees and year
        const balanceQuery = {
            tenant: tenantId,
            year,
            employee: { $in: empIds }
        };
        if (req.query.leaveType && req.query.leaveType !== 'All') {
            balanceQuery.leaveType = String(req.query.leaveType).toUpperCase();
        }
        const balances = await LeaveBalance.find(balanceQuery).lean();

        // Stats calculations
        const totalPolicies = policies.length;
        const totalEmployeesCovered = employees.length;
        let totalLeaveAllocated = 0;
        let totalLeaveUsed = 0;
        let totalPendingLeaves = 0;
        let totalBalanceAvailable = 0;

        balances.forEach(b => {
            totalLeaveAllocated += (b.total || 0);
            totalLeaveUsed += (b.used || 0);
            totalPendingLeaves += (b.pending || 0);
            totalBalanceAvailable += (b.available || 0);
        });

        // Sheet 2: Department-wise Analytics dataset
        const deptGroup = {};
        employees.forEach(e => {
            const deptName = e.departmentId?.name || e.department || 'Unassigned';
            if (!deptGroup[deptName]) {
                deptGroup[deptName] = {
                    emps: [],
                    policies: new Set()
                };
            }
            deptGroup[deptName].emps.push(e);
            if (e.leavePolicy?.name) {
                deptGroup[deptName].policies.add(e.leavePolicy.name);
            }
        });

        const departmentAnalytics = Object.keys(deptGroup).map(deptName => {
            const group = deptGroup[deptName];
            const deptEmpIds = group.emps.map(e => String(e._id));
            const deptBalances = balances.filter(b => deptEmpIds.includes(String(b.employee)));
            
            let allocated = 0;
            let used = 0;
            let pending = 0;
            let available = 0;
            deptBalances.forEach(b => {
                allocated += (b.total || 0);
                used += (b.used || 0);
                pending += (b.pending || 0);
                available += (b.available || 0);
            });
            
            return {
                "Department": deptName,
                "Total Employees": group.emps.length,
                "Policy Assigned": Array.from(group.policies).join(', ') || 'None',
                "Total Allocated": Number(allocated.toFixed(2)),
                "Used": Number(used.toFixed(2)),
                "Pending": Number(pending.toFixed(2)),
                "Balance": Number(available.toFixed(2))
            };
        });

        // Sheet 3: Employee Leave Balance dataset (grouped by employee)
        const empBalancesMap = new Map();
        balances.forEach(bal => {
            const empIdStr = bal.employee.toString();
            const leaveType = String(bal.leaveType || '').toUpperCase().trim();
            
            if (!empBalancesMap.has(empIdStr)) {
                empBalancesMap.set(empIdStr, {
                    CL: { total: 0, used: 0, pending: 0, available: 0 },
                    SL: { total: 0, used: 0, pending: 0, available: 0 },
                    EL: { total: 0, used: 0, pending: 0, available: 0 },
                    Others: { total: 0, used: 0, pending: 0, available: 0 }
                });
            }

            const data = empBalancesMap.get(empIdStr);
            let category = 'Others';
            if (leaveType === 'CL') category = 'CL';
            else if (leaveType === 'SL' || leaveType === 'SICK LEAVE') category = 'SL';
            else if (leaveType === 'EL' || leaveType === 'EARNED LEAVE' || leaveType === 'PL' || leaveType === 'PRIVILEGE LEAVE') category = 'EL';

            data[category].total += bal.total || 0;
            data[category].used += bal.used || 0;
            data[category].pending += bal.pending || 0;
            data[category].available += bal.available || 0;
        });

        const employeeBalance = [];
        employees.forEach(emp => {
            const empIdStr = emp._id.toString();
            const hasBalances = balances.some(b => String(b.employee) === empIdStr);
            if (hasBalances) {
                const b = empBalancesMap.get(empIdStr) || {
                    CL: { total: 0, used: 0, pending: 0, available: 0 },
                    SL: { total: 0, used: 0, pending: 0, available: 0 },
                    EL: { total: 0, used: 0, pending: 0, available: 0 },
                    Others: { total: 0, used: 0, pending: 0, available: 0 }
                };

                employeeBalance.push({
                    "Emp Code": emp.employeeId || '',
                    "Employee Name": `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                    "Department": emp.departmentId?.name || emp.department || 'Unassigned',
                    "Policy": emp.leavePolicy?.name || 'None',
                    "CL Allocated": Number(b.CL.total.toFixed(2)),
                    "CL Used": Number(b.CL.used.toFixed(2)),
                    "CL Pending": Number(b.CL.pending.toFixed(2)),
                    "CL Balance": Number(b.CL.available.toFixed(2)),
                    "SL Allocated": Number(b.SL.total.toFixed(2)),
                    "SL Used": Number(b.SL.used.toFixed(2)),
                    "SL Pending": Number(b.SL.pending.toFixed(2)),
                    "SL Balance": Number(b.SL.available.toFixed(2)),
                    "EL Allocated": Number(b.EL.total.toFixed(2)),
                    "EL Used": Number(b.EL.used.toFixed(2)),
                    "EL Pending": Number(b.EL.pending.toFixed(2)),
                    "EL Balance": Number(b.EL.available.toFixed(2)),
                    "Others Allocated": Number(b.Others.total.toFixed(2)),
                    "Others Used": Number(b.Others.used.toFixed(2)),
                    "Others Pending": Number(b.Others.pending.toFixed(2)),
                    "Others Balance": Number(b.Others.available.toFixed(2))
                });
            }
        });

        // Sheet 4: Leave Ledger (Passbook style history) dataset
        const ledgerQuery = {
            tenant: tenantId,
            year,
            employee: { $in: empIds }
        };
        if (req.query.leaveType && req.query.leaveType !== 'All') {
            ledgerQuery.leaveType = String(req.query.leaveType).toUpperCase();
        }
        const ledgers = await LeaveLedger.find(ledgerQuery)
            .sort({ date: -1 })
            .lean();

        const leaveLedger = [];
        ledgers.forEach(l => {
            const emp = employees.find(e => String(e._id) === String(l.employee));
            if (emp) {
                const formattedDate = new Date(l.date || l.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                
                leaveLedger.push({
                    "Date": formattedDate,
                    "Employee": `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                    "Leave Type": l.leaveType || '',
                    "Transaction Type": l.actionType || '',
                    "Days": l.days >= 0 ? `+${l.days}` : `${l.days}`,
                    "Balance After": Number((l.newBalance || 0).toFixed(2))
                });
            }
        });

        // Sheet 5: Utilization Analytics dataset
        const typeGroup = {};
        balances.forEach(b => {
            const type = String(b.leaveType || '').toUpperCase().trim();
            if (!typeGroup[type]) {
                typeGroup[type] = { allocated: 0, used: 0 };
            }
            typeGroup[type].allocated += (b.total || 0);
            typeGroup[type].used += (b.used || 0);
        });

        const utilizationAnalytics = Object.keys(typeGroup).map(type => {
            const group = typeGroup[type];
            const percent = group.allocated > 0 ? `${Math.round((group.used / group.allocated) * 100)}%` : '0%';
            return {
                "Leave Type": type,
                "Total Allocated": Number(group.allocated.toFixed(2)),
                "Total Used": Number(group.used.toFixed(2)),
                "Utilization %": percent
            };
        });

        res.json({
            stats: {
                totalPolicies,
                totalEmployeesCovered,
                totalLeaveAllocated: Number(totalLeaveAllocated.toFixed(2)),
                totalLeaveUsed: Number(totalLeaveUsed.toFixed(2)),
                totalPendingLeaves: Number(totalPendingLeaves.toFixed(2)),
                totalBalanceAvailable: Number(totalBalanceAvailable.toFixed(2))
            },
            sheets: {
                policySummary,
                departmentAnalytics,
                employeeBalance,
                leaveLedger,
                utilizationAnalytics
            }
        });
    } catch (e) {
        console.error('getMasterLeaveReport Error:', e);
        res.status(500).json({ error: e.message });
    }
};


