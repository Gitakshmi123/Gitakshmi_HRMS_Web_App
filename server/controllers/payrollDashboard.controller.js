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

        // Get models
        const PayrollRun = req.tenantDB.model('PayrollRun');
        const Payslip = req.tenantDB.model('Payslip');
        const Employee = req.tenantDB.model('Employee');

        // 1. Get recent payroll runs (last 5)
        const recentRuns = await PayrollRun.find({ tenantId })
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
                    tenantId: tenantId,
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
                    tenantId: tenantId,
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
            tenant: tenantId,
            status: 'Active'
        });

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
