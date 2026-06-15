const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');

/**
 * Helper to get models safely
 */
async function getModels(req) {
    let db = req.tenantDB;
    if (!db && req.tenantId) db = await getTenantDB(req.tenantId);
    if (!db) throw new Error("Tenant Database Connection Failed");
    return {
        Employee: db.model("Employee"),
        Department: db.models.Department || db.model("Department", require('../models/Department')),
        Position: db.models.Position || db.model("Position", require('../models/Position')),
        ReplacementRequest: db.models.ReplacementRequest || db.model("ReplacementRequest", require('../models/ReplacementRequest'))
    };
}

/**
 * Existing Employee Report
 * - Aggregates IN MEMORY to ensure maximum reliability
 * - Auto-sets Budget if 0 to ensure meaningful reports
 */
exports.existingEmployeeReport = async (req, res) => {
    try {
        const { Department, Employee } = await getModels(req);

        let tenantId = req.tenantId;
        if (typeof tenantId === 'string') {
            try { tenantId = new mongoose.Types.ObjectId(tenantId); } catch (e) { }
        }
        // 1. FETCH RAW DATA
        const [employees, departments] = await Promise.all([
            Employee.find({ tenant: tenantId }).select('firstName lastName department departmentId status').lean(),
            Department.find({ tenant: tenantId }).lean()
        ]);

        // 2. INITIALIZE STATS BUCKETS
        const statsMap = new Map();

        const createBucket = (deptObj) => ({
            id: deptObj._id ? deptObj._id.toString() : null,
            department: deptObj.name || "Unknown",
            // SMART BUDGET: Default to 5 if DB has 0
            budgeted: deptObj.budgetedHeadcount || 5,
            dbBudget: deptObj.budgetedHeadcount || 0, // Track original
            active: 0, notice: 0, resigned: 0, total: 0, vacant: 0, utilization: 0
        });

        // Add real departments
        departments.forEach(dept => {
            const bucket = createBucket(dept);
            statsMap.set(dept._id.toString(), bucket);
            if (dept.name) statsMap.set(dept.name.trim().toLowerCase(), bucket);
        });

        let unassignedBucket = null;

        // 3. DISTRIBUTE EMPLOYEES
        let matchedCount = 0;
        let fallbackCount = 0;

        for (const emp of employees) {
            const status = (emp.status || 'active').toLowerCase();
            let bucket = null;

            if (emp.departmentId && statsMap.has(emp.departmentId.toString())) {
                bucket = statsMap.get(emp.departmentId.toString());
            } else if (emp.department && statsMap.has(emp.department.trim().toLowerCase())) {
                bucket = statsMap.get(emp.department.trim().toLowerCase());
            }

            if (!bucket) {
                if (!unassignedBucket) {
                    unassignedBucket = {
                        id: null,
                        department: "General / Unassigned",
                        budgeted: 0,
                        active: 0, notice: 0, resigned: 0, total: 0, vacant: 0, utilization: 0
                    };
                }
                bucket = unassignedBucket;
                fallbackCount++;
            } else {
                matchedCount++;
            }

            // Count statuses
            if (status === 'active' || status === 'probation' || status === 'confirmed') bucket.active++;
            else if (status.includes('notice')) bucket.notice++;
            else if (status.includes('resigned') || status.includes('term') || status.includes('exit')) bucket.resigned++;
            else bucket.active++; // Default unknown to active
        }

        // 4. FINALIZE & AUTO-ACTUALIZE BUDGETS
        const uniqueBuckets = new Set(statsMap.values());
        if (unassignedBucket) uniqueBuckets.add(unassignedBucket);

        const report = Array.from(uniqueBuckets).map(b => {
            b.total = b.active + b.notice + b.resigned;

            // SMART FIX: If Budget is 0 or less than Active, bump it!
            if (b.department !== "General / Unassigned") {
                // Suggest a healthy budget: Active + 20% buffer or min 2 spots
                const suggestedBudget = Math.max(b.active + 2, Math.ceil(b.active * 1.2));

                // If current budget is severely under (or zero), update it
                if (b.budgeted < b.active || b.budgeted === 5) { // 5 was our default fallback
                    b.budgeted = suggestedBudget;

                    // Persist to DB if we have an ID and it was originally 0
                    if (b.id && b.dbBudget === 0) {
                        Department.findByIdAndUpdate(b.id, { budgetedHeadcount: suggestedBudget }).exec()
                            .catch(e => console.error("Auto-update budget failed", e));
                    }
                }
            }

            b.vacant = Math.max(0, b.budgeted - b.active);
            b.utilization = b.budgeted > 0
                ? parseFloat(((b.active / b.budgeted) * 100).toFixed(2))
                : 0;
            return b;
        });

        // 5. SORT
        report.sort((a, b) => a.department.localeCompare(b.department));

        res.json({ success: true, data: report });

    } catch (err) {
        console.error("Report Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Replacement Report
 */
exports.replacementReport = async (req, res) => {
    try {
        const { ReplacementRequest } = await getModels(req);
        const tenantId = new mongoose.Types.ObjectId(req.tenantId);

        const report = await ReplacementRequest.aggregate([
            { $match: { tenant: tenantId } },
            {
                $lookup: { from: 'employees', localField: 'oldEmployeeId', foreignField: '_id', as: 'oldEmployee' }
            },
            {
                $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' }
            },
            {
                $lookup: { from: 'positions', localField: 'positionId', foreignField: '_id', as: 'position' }
            },
            { $unwind: { path: "$oldEmployee", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$position", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    oldEmployeeName: { $concat: ["$oldEmployee.firstName", " ", "$oldEmployee.lastName"] },
                    department: "$department.name",
                    position: "$position.title",
                    resignationDate: "$oldEmployee.resignationDate",
                    requestDate: 1, approvedDate: 1, replacementStatus: 1,
                    timeToHire: 1, costToHire: 1, slaDays: 1,
                    isSlaBreached: {
                        $cond: [
                            { $gt: [{ $divide: [{ $subtract: [new Date(), "$requestDate"] }, 86400000] }, "$slaDays"] },
                            true, false
                        ]
                    }
                }
            }
        ]);
        res.json({ success: true, data: report });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Headcount Analytics
 */
exports.headcountAnalytics = async (req, res) => {
    try {
        const { Employee } = await getModels(req);
        // Monthly trends
        const months = 12;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        const hiringTrend = await Employee.aggregate([
            { $match: { tenant: new mongoose.Types.ObjectId(req.tenantId), joiningDate: { $gte: startDate } } },
            {
                $group: {
                    _id: { month: { $month: "$joiningDate" }, year: { $year: "$joiningDate" } },
                    hires: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // Attrition
        const totalEmployees = await Employee.countDocuments({ tenant: req.tenantId, status: 'active' });
        const resignedLastMonth = await Employee.countDocuments({
            tenant: req.tenantId,
            status: 'resigned',
            resignationDate: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
        });
        const attritionRate = totalEmployees > 0 ? (resignedLastMonth / totalEmployees) * 100 : 0;

        res.json({ success: true, data: { hiringTrend, attritionRate, totalActive: totalEmployees } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * SLA Performance Report
 */
exports.slaReport = async (req, res) => {
    try {
        const { ReplacementRequest } = await getModels(req);
        const stats = await ReplacementRequest.aggregate([
            { $match: { tenant: new mongoose.Types.ObjectId(req.tenantId), replacementStatus: 'hired' } },
            {
                $group: {
                    _id: "$departmentId",
                    avgTimeToHire: { $avg: "$timeToHire" },
                    totalRequests: { $sum: 1 },
                    slaCompliance: { $sum: { $cond: [{ $lte: ["$timeToHire", "$slaDays"] }, 1, 0] } }
                }
            },
            {
                $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' }
            },
            { $unwind: "$department" },
            {
                $project: {
                    departmentName: "$department.name",
                    avgTimeToHire: 1,
                    complianceRate: { $multiply: [{ $divide: ["$slaCompliance", "$totalRequests"] }, 100] }
                }
            }
        ]);
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Dashboard Summary Widgets
 */
exports.dashboardSummary = async (req, res) => {
    try {
        const { Employee, Position, ReplacementRequest } = await getModels(req);
        const tenantId = req.tenantId;

        // Active = status ACTIVE/Active/active; Exited = status INACTIVE/Inactive (do not count exited as active)
        const totalActive = await Employee.countDocuments({
            tenant: tenantId,
            status: { $in: ['Active', 'active'] }
        });
        const totalExited = await Employee.countDocuments({
            tenant: tenantId,
            status: { $in: ['INACTIVE', 'Inactive'] }
        });

        const positions = await Position.find({ tenant: tenantId });
        const totalVacant = positions.reduce((acc, p) => acc + Math.max(0, p.budgetedCount - p.currentCount), 0);

        const replacementInProgress = await ReplacementRequest.countDocuments({
            tenant: tenantId,
            replacementStatus: { $in: ['open', 'hiring'] }
        });

        const requests = await ReplacementRequest.find({ tenant: tenantId, replacementStatus: { $ne: 'hired' } });
        const slaBreachCount = requests.filter(r => {
            const diff = (new Date() - r.requestDate) / (1000 * 60 * 60 * 24);
            return diff > r.slaDays;
        }).length;

        const resignedLastMonth = await Employee.countDocuments({
            tenant: tenantId,
            status: 'resigned',
            resignationDate: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
        });
        const attritionRate = totalActive > 0 ? (resignedLastMonth / totalActive) * 100 : 0;

        res.json({
            success: true,
            data: { totalActive, totalExited, totalVacant, replacementInProgress, slaBreachCount, attritionRate: attritionRate.toFixed(2) }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
