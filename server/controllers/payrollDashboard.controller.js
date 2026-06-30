const mongoose = require('mongoose');

/**
 * Payroll Dashboard Controller
 * Provides analytics and metrics for payroll dashboard
 */

/**
 * GET /api/payroll/dashboard
 * Get comprehensive payroll dashboard data
 */
exports.getDashboardData = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const currentYear = new Date().getFullYear();
        const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

        // Get models
        const PayrollRun = req.tenantDB.model('PayrollRun');
        const Payslip = req.tenantDB.model('Payslip');
        const Employee = req.tenantDB.model('Employee');

        // 1. Get recent payroll runs (last 5)
        const recentRuns = await PayrollRun.find({ tenantId: tenantIdObj })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('month year status totalNetPay totalGross processedEmployees createdAt')
            .lean();

        // 2. Get last payroll run details
        const lastRun = recentRuns[0] || null;

        // 3. Calculate YTD (Year-to-Date) cost
        const ytdResult = await Payslip.aggregate([
            {
                $match: {
                    tenantId: tenantIdObj,
                    year: currentYear
                }
            },
            {
                $group: {
                    _id: null,
                    totalNet: { $sum: '$netPay' },
                    totalGross: { $sum: '$grossEarnings' },
                    totalDeductions: { $sum: { $add: ['$preTaxDeductionsTotal', '$postTaxDeductionsTotal', '$incomeTax'] } },
                    count: { $sum: 1 }
                }
            }
        ]);

        const ytdData = ytdResult[0] || { totalNet: 0, totalGross: 0, totalDeductions: 0, count: 0 };

        // 4. Get monthly breakdown for charts (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyData = await Payslip.aggregate([
            {
                $match: {
                    tenantId: tenantIdObj,
                    year: { $gte: sixMonthsAgo.getFullYear() }
                }
            },
            {
                $group: {
                    _id: {
                        year: '$year',
                        month: '$month'
                    },
                    gross: { $sum: '$grossEarnings' },
                    net: { $sum: '$netPay' },
                    deductions: { $sum: { $add: ['$preTaxDeductionsTotal', '$postTaxDeductionsTotal', '$incomeTax'] } },
                    employeeCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            },
            {
                $limit: 6
            }
        ]);

        // Format monthly data for charts
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedMonthlyData = monthlyData.map(item => ({
            month: monthNames[item._id.month - 1],
            year: item._id.year,
            gross: Math.round(item.gross),
            net: Math.round(item.net),
            deductions: Math.round(item.deductions),
            employees: item.employeeCount
        }));

        // 5. Get earnings vs deductions breakdown for pie chart
        const earningsVsDeductions = ytdData.totalGross > 0 ? [
            { name: 'Net Pay', value: Math.round(ytdData.totalNet) },
            { name: 'Deductions', value: Math.round(ytdData.totalDeductions) }
        ] : [];

        // 6. Get active employees count
        const activeEmployeesCount = await Employee.countDocuments({
            tenant: tenantIdObj,
            status: 'Active'
        });

        // 7. Resolve dynamic cards data
        const DeductionMaster = req.tenantDB.models.DeductionMaster || req.tenantDB.model('DeductionMaster', require('../models/DeductionMaster'));
        const EmployeeDeduction = req.tenantDB.models.EmployeeDeduction || req.tenantDB.model('EmployeeDeduction', require('../models/EmployeeDeduction'));
        const PayrollAdjustment = req.tenantDB.models.PayrollAdjustment || req.tenantDB.model('PayrollAdjustment', require('../models/PayrollAdjustment'));
        const EmployeeTaxProfile = req.tenantDB.models.EmployeeTaxProfile || req.tenantDB.model('EmployeeTaxProfile', require('../models/EmployeeTaxProfile'));
        const PayrollInputBatch = req.tenantDB.models.PayrollInputBatch || req.tenantDB.model('PayrollInputBatch', require('../models/PayrollInputBatch'));
        const Attendance = req.tenantDB.models.Attendance || req.tenantDB.model('Attendance', require('../models/Attendance'));

        const currentMonthNum = new Date().getMonth() + 1;
        const currentYearNum = new Date().getFullYear();
        const monthStart = new Date(currentYearNum, currentMonthNum - 1, 1);
        const monthEnd = new Date(currentYearNum, currentMonthNum, 0, 23, 59, 59);

        // Card 2: Attendance Import stats
        const attendanceCount = await Attendance.countDocuments({
            tenant: tenantIdObj,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        // Card 3: Payroll Input progress
        const hasSalaryAssigned = await Employee.exists({ tenant: tenantIdObj, status: 'Active', salary: { $gt: 0 } });
        const hasOvertimeBatch = await PayrollInputBatch.exists({ tenantId: tenantIdObj, month: currentMonthNum, year: currentYearNum });
        const activeLoansCount = await EmployeeDeduction.countDocuments({ tenantId: tenantIdObj, deductionType: 'LOAN', status: 'ACTIVE' });

        const payrollInputStatus = {
            basicPay: hasSalaryAssigned ? 'Completed' : 'Pending',
            overtime: hasOvertimeBatch ? 'Completed' : 'Pending',
            leaves: attendanceCount > 0 ? 'Completed' : 'Pending',
            loans: activeLoansCount > 0 ? 'Completed' : 'Pending'
        };

        // Card 4: Review & Validate
        const missingSalaryCount = await Employee.countDocuments({
            tenant: tenantIdObj,
            status: 'Active',
            $or: [ { salary: { $exists: false } }, { salary: 0 } ]
        });
        const missingBankCount = await Employee.countDocuments({
            tenant: tenantIdObj,
            status: 'Active',
            $or: [ { bankAccountNumber: { $exists: false } }, { bankAccountNumber: '' } ]
        });

        const totalValidated = Math.max(0, activeEmployeesCount - missingSalaryCount);

        // Card 5: Approval Flow
        let approvalLevels = [
            { level: '1. Reporting Manager', approver: 'Raju Sharma', status: 'Approved' },
            { level: '2. HR Admin Checker', approver: 'Neha Jain', status: 'Pending' }
        ];
        if (lastRun) {
            if (lastRun.status === 'APPROVED' || lastRun.status === 'COMPLETED' || lastRun.status === 'PAID') {
                approvalLevels[1].status = 'Approved';
            } else if (lastRun.status === 'REJECTED') {
                approvalLevels[0].status = 'Rejected';
                approvalLevels[1].status = 'Rejected';
            }
        }

        // Card 6: Advance Entry
        const adjustments = await PayrollAdjustment.find({ companyId: tenantIdObj })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('employeeId', 'firstName lastName')
            .lean();

        // Card 7: Deduction Entry
        const deductionsList = await EmployeeDeduction.find({ tenantId: tenantIdObj, status: 'ACTIVE', deductionType: { $ne: 'LOAN' } })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('employeeId', 'firstName lastName')
            .lean();

        // Card 8: Loan Management
        const loansList = await EmployeeDeduction.find({ tenantId: tenantIdObj, status: 'ACTIVE', deductionType: 'LOAN' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('employeeId', 'firstName lastName')
            .lean();

        // Card 9: TDS declarations
        const taxProfiles = await EmployeeTaxProfile.find({ tenantId: tenantIdObj, status: 'ACTIVE' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('employeeId', 'firstName lastName')
            .lean();

        // Card 10: Other Earnings
        const otherEarningsBatches = await PayrollInputBatch.find({ tenantId: tenantIdObj, month: currentMonthNum, year: currentYearNum })
            .sort({ createdAt: -1 })
            .limit(2)
            .lean();
        
        // Find all active employees to map names for other earnings
        const activeEmployees = await Employee.find({ tenant: tenantIdObj }, 'firstName lastName').lean();
        const otherEarningsList = otherEarningsBatches.flatMap(b => (b.items || []).map(i => {
            const empObj = activeEmployees.find(e => String(e._id) === String(i.employeeId));
            return {
                ...i,
                employeeName: empObj ? `${empObj.firstName} ${empObj.lastName}` : 'Employee'
            };
        }));

        // Card 13: Employee Payroll List
        const payslipsList = await Payslip.find({ tenantId: tenantIdObj })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Card 14: Payslip Quick View
        const latestPayslip = await Payslip.findOne({ tenantId: tenantIdObj })
            .sort({ createdAt: -1 })
            .lean();

        // 7. Format recent runs for display
        const formattedRecentRuns = recentRuns.map(run => ({
            _id: run._id,
            period: `${monthNames[run.month - 1]} ${run.year}`,
            month: run.month,
            year: run.year,
            runDate: run.createdAt,
            status: run.status,
            totalNetPay: Math.round(run.totalNetPay || 0),
            totalGross: Math.round(run.totalGross || 0),
            employeesPaid: run.processedEmployees || 0
        }));

        // Prepare response
        const dashboardData = {
            summary: {
                lastPayrollCost: Math.round(lastRun?.totalNetPay || 0),
                employeesPaid: lastRun?.processedEmployees || 0,
                ytdCost: Math.round(ytdData.totalNet),
                ytdGross: Math.round(ytdData.totalGross),
                ytdDeductions: Math.round(ytdData.totalDeductions),
                activeEmployees: activeEmployeesCount,
                totalPayslips: ytdData.count
            },
            recentRuns: formattedRecentRuns,
            charts: {
                monthly: formattedMonthlyData,
                earningsVsDeductions: earningsVsDeductions,
                trend: formattedMonthlyData.map(item => ({
                    month: item.month,
                    amount: item.net
                }))
            },
            cards: {
                attendanceRecords: attendanceCount,
                payrollInput: payrollInputStatus,
                validation: {
                    totalValidated,
                    exceptions: missingSalaryCount,
                    warnings: missingBankCount
                },
                approvalLevels,
                adjustments: adjustments.map(adj => ({
                    employeeName: adj.employeeId ? `${adj.employeeId.firstName} ${adj.employeeId.lastName}` : 'Employee',
                    amount: Math.abs(adj.adjustmentAmount),
                    status: adj.status
                })),
                deductions: deductionsList.map(ded => ({
                    employeeName: ded.employeeId ? `${ded.employeeId.firstName} ${ded.employeeId.lastName}` : 'Employee',
                    name: ded.nameSnapshot || 'Deduction',
                    amount: ded.customValue || (ded.deductionId ? 500 : 0) // default fallback
                })),
                loans: loansList.map(loan => ({
                    employeeName: loan.employeeId ? `${loan.employeeId.firstName} ${loan.employeeId.lastName}` : 'Employee',
                    loanType: loan.metadata?.loanType || 'Personal Loan',
                    emi: loan.installmentAmount || 0,
                    outstanding: loan.metadata?.totalOutstanding || 0
                })),
                tds: taxProfiles.map(prof => ({
                    employeeName: prof.employeeId ? `${prof.employeeId.firstName} ${prof.employeeId.lastName}` : 'Employee',
                    regime: prof.regime,
                    deductions: (prof.declarations?.section80C || 0) + (prof.declarations?.section80D || 0) + (prof.declarations?.hraExemption || 0),
                    tds: prof.overrides?.monthlyTDS || 0
                })),
                otherEarnings: otherEarningsList.map(earn => ({
                    employeeName: earn.employeeName,
                    earningType: earn.earningType || 'Other Earning',
                    amount: earn.amount
                })),
                payslipsList: payslipsList.map(ps => ({
                    employeeName: ps.employeeInfo?.name || 'Employee',
                    employeeId: ps.employeeInfo?.employeeId || '',
                    netPay: ps.netPay || 0,
                    status: ps.status || 'Paid'
                })),
                quickPayslip: latestPayslip ? {
                    employeeName: latestPayslip.employeeInfo?.name || 'Employee',
                    employeeId: latestPayslip.employeeInfo?.employeeId || '',
                    bankAccount: latestPayslip.employeeInfo?.bankAccountNumber || '',
                    bankName: latestPayslip.employeeInfo?.bankName || '',
                    basic: latestPayslip.earnings?.find(e => e.name === 'Basic' || e.name === 'BASIC')?.amount || 25000,
                    hra: latestPayslip.earnings?.find(e => e.name === 'HRA' || e.name === 'Hra')?.amount || 8000,
                    pf: latestPayslip.deductions?.find(d => d.name === 'EPF' || d.name === 'PF')?.amount || 1800,
                    tds: latestPayslip.incomeTax || 8400,
                    grossEarnings: latestPayslip.grossEarnings || 43000,
                    netPayable: latestPayslip.netPay || 32800
                } : null
            },
            lastUpdated: new Date()
        };

        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('[PAYROLL_DASHBOARD] Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
};

/**
 * GET /api/payroll/dashboard/stats
 * Get quick stats for dashboard cards
 */
exports.getQuickStats = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const currentYear = new Date().getFullYear();

        const PayrollRun = req.tenantDB.model('PayrollRun');
        const Payslip = req.tenantDB.model('Payslip');

        // Get last run
        const lastRun = await PayrollRun.findOne({ tenantId })
            .sort({ createdAt: -1 })
            .select('totalNetPay processedEmployees')
            .lean();

        // Get YTD total
        const ytdResult = await Payslip.aggregate([
            {
                $match: {
                    tenantId: tenantId,
                    year: currentYear
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$netPay' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                lastPayrollCost: Math.round(lastRun?.totalNetPay || 0),
                employeesPaid: lastRun?.processedEmployees || 0,
                ytdCost: Math.round(ytdResult[0]?.total || 0)
            }
        });

    } catch (error) {
        console.error('[PAYROLL_DASHBOARD] Error fetching quick stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quick stats',
            error: error.message
        });
    }
};
