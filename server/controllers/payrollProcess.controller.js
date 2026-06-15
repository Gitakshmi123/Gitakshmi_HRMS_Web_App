const payrollService = require('../services/payroll.service');
const canonicalPayroll = require('../services/canonicalPayroll.service');
const payrollPhase2 = require('../services/payrollPhase2.service');

const getModels = (req) => {
    return {
        Employee: req.tenantDB.model('Employee'),
        Attendance: req.tenantDB.model('Attendance'),
        PayrollRun: req.tenantDB.model('PayrollRun'),
        PayrollRunItem: req.tenantDB.model('PayrollRunItem'),
        Payslip: req.tenantDB.model('Payslip')
    };
};

const getTenantId = (req) => req.tenantId || req.user?.tenantId || req.user?.companyId;

function parseMonthRange(month) {
    const [year, monthNum] = String(month || '').split('-').map(Number);
    if (!year || !monthNum) {
        throw new Error('Month is required');
    }

    return {
        year,
        monthNum,
        startDate: new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0)),
        endDate: new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999))
    };
}

function derivePayrollReadiness(validation = {}) {
    if (validation.canCalculate) {
        return 'READY';
    }

    const missingSalary = (validation.issues || []).some(issue => issue.code === 'MISSING_CANONICAL_SALARY_VERSION');
    if (missingSalary) {
        return 'MISSING_SALARY';
    }

    const missingProfile = (validation.issues || []).some(issue => issue.code === 'MISSING_PAYROLL_PROFILE');
    if (missingProfile) {
        return 'MISSING_PROFILE';
    }

    return 'BLOCKED';
}

function summarizeIssues(issues = []) {
    return issues.map(issue => issue.message).join(' | ');
}

function serializeSelectedRunResult(payrollRun, selectedEmployeeIds = [], preflight = null) {
    return {
        payrollRunId: payrollRun?._id,
        runCode: payrollRun?.runCode || '',
        runType: payrollRun?.runType || 'SELECTED',
        sequenceNo: payrollRun?.sequenceNo || null,
        month: payrollRun?.month || null,
        year: payrollRun?.year || null,
        status: payrollRun?.status || 'INITIATED',
        lifecycleState: payrollRun?.lifecycleState || 'DRAFT',
        source: 'CANONICAL',
        totalEmployees: payrollRun?.totalEmployees || 0,
        selectedEmployees: selectedEmployeeIds.length,
        processedEmployees: payrollRun?.processedEmployees || 0,
        failedEmployees: payrollRun?.failedEmployees || 0,
        skippedEmployees: Math.max(0, selectedEmployeeIds.length - (payrollRun?.totalEmployees || 0)),
        totalGross: payrollRun?.totalGross || 0,
        totalNetPay: payrollRun?.totalNetPay || 0,
        totalDeductions: payrollRun?.totalDeductions || 0,
        preflightSummary: preflight
            ? {
                canCalculate: Boolean(preflight.canCalculate),
                blockers: Array.isArray(preflight.blockers) ? preflight.blockers.length : 0,
                warnings: Array.isArray(preflight.warnings) ? preflight.warnings.length : 0
            }
            : null,
        errors: payrollRun?.executionErrors || []
    };
}

async function buildProcessEmployee(req, tenantId, employee, startDate, endDate) {
    const { Attendance } = getModels(req);

    const attendanceCount = await Attendance.countDocuments({
        employee: employee._id,
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ['present', 'half_day', 'work_from_home', 'on_duty'] }
    });

    const validation = await canonicalPayroll.validateEmployeePayrollData(
        req.tenantDB,
        tenantId,
        employee,
        startDate,
        endDate,
        {
            requirePayrollProfile: String(process.env.PAYROLL_REQUIRE_PROFILE || '').toLowerCase() === 'true',
            allowLegacyFallback: false
        }
    );

    const payrollReadiness = derivePayrollReadiness(validation);

    return {
        _id: employee._id.toString(),
        key: employee._id.toString(),
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unnamed Employee',
        employeeId: employee.employeeId,
        email: employee.email,
        department: employee.department,
        source: 'EMPLOYEE',
        joiningDate: employee.joiningDate,
        status: employee.status,
        hasCompensation: Boolean(validation.salaryVersion),
        hasPayrollProfile: Boolean(validation.payrollProfile),
        canProcessPayroll: validation.canCalculate,
        payrollReadiness,
        effectiveSalaryVersion: validation.salaryVersion,
        payrollProfile: validation.payrollProfile,
        validation,
        attendanceParams: {
            presentDays: attendanceCount,
            totalDays: endDate.getUTCDate()
        }
    };
}

exports.getProcessEmployees = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) {
            return res.status(400).json({ success: false, message: 'Month is required' });
        }

        const { startDate, endDate } = parseMonthRange(month);
        const { Employee } = getModels(req);
        const tenantId = getTenantId(req);

        const employees = await Employee.find({
            status: { $regex: /^active$/i },
            $or: [
                { joiningDate: { $lte: endDate } },
                { joiningDate: null }
            ]
        }).select('firstName lastName employeeId department role email joiningDate status');

        const data = await Promise.all(employees.map((employee) => buildProcessEmployee(req, tenantId, employee, startDate, endDate)));

        res.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('Get Process Employees Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.previewPreview = async (req, res) => {
    try {
        const { month, items, attendancePolicy = 'STRICT' } = req.body;
        const { year, monthNum, startDate, endDate } = parseMonthRange(month);
        const { Employee } = getModels(req);
        const tenantId = getTenantId(req);
        const results = [];

        for (const item of items || []) {
            const emp = await Employee.findById(item.employeeId);

            if (!emp || emp.status?.toLowerCase() !== 'active') {
                continue;
            }

            const validation = await canonicalPayroll.validateEmployeePayrollData(
                req.tenantDB,
                tenantId,
                emp,
                startDate,
                endDate,
                {
                    requirePayrollProfile: String(process.env.PAYROLL_REQUIRE_PROFILE || '').toLowerCase() === 'true',
                    allowLegacyFallback: false
                }
            );

            if (!validation.canCalculate) {
                results.push({
                    employeeId: emp._id,
                    error: summarizeIssues(validation.issues) || 'Payroll data is not ready for calculation',
                    validation
                });
                continue;
            }

            try {
                const result = await payrollService.calculateEmployeePayroll(
                    req.tenantDB,
                    tenantId,
                    emp,
                    parseInt(monthNum, 10),
                    parseInt(year, 10),
                    startDate,
                    endDate,
                    endDate.getUTCDate(),
                    new Set(),
                    null,
                    null,
                    true,
                    { attendancePolicy, runType: 'SELECTED', executionMode: 'MONTHLY' }
                );

                results.push({
                    employeeId: emp._id,
                    gross: result.grossEarnings,
                    net: result.netPay,
                    breakdown: result,
                    validation
                });
            } catch (err) {
                console.error(`[PREVIEW_FATAL] Error for employee ${emp._id}:`, err);
                results.push({
                    employeeId: emp._id,
                    error: err.message || 'Calculation failed',
                    validation
                });
            }
        }

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Preview Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.runPayroll = async (req, res) => {
    try {
        const { month, items, inputBatchIds = [], attendancePolicy = 'STRICT', payDate = null } = req.body;
        const { year, monthNum } = parseMonthRange(month);
        const tenantId = getTenantId(req);
        const selectedEmployeeIds = [...new Set((items || []).map((item) => item.employeeId).filter(Boolean))];

        if (selectedEmployeeIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Select at least one employee to run payroll.' });
        }

        const normalizedMonth = parseInt(monthNum, 10);
        const normalizedYear = parseInt(year, 10);

        const preflight = await payrollService.preflightPayrollRun(
            req.tenantDB,
            tenantId,
            normalizedMonth,
            normalizedYear,
            null,
            {
                selectedEmployeeIds,
                runType: 'SELECTED',
                executionMode: 'MONTHLY',
                attendancePolicy,
                inputBatchIds
            }
        );

        if (!preflight.canCalculate) {
            return res.status(400).json({
                success: false,
                message: `Payroll cannot be processed until ${preflight.blockers.length} blocker(s) are fixed.`,
                data: preflight
            });
        }

        const sequenceNo = await payrollPhase2.getNextPayrollRunSequence(
            req.tenantDB,
            tenantId,
            normalizedMonth,
            normalizedYear
        );

        const payrollRun = await payrollService.runPayroll(
            req.tenantDB,
            tenantId,
            normalizedMonth,
            normalizedYear,
            req.user.id || req.user._id,
            {
                selectedEmployeeIds,
                runType: 'SELECTED',
                executionMode: 'MONTHLY',
                attendancePolicy,
                inputBatchIds,
                payDate,
                sequenceNo
            }
        );

        res.json({
            success: true,
            data: serializeSelectedRunResult(payrollRun, selectedEmployeeIds, preflight),
            message: `Selected payroll run ${payrollRun.runCode || ''} processed: ${payrollRun.processedEmployees} successful, ${payrollRun.failedEmployees} failed`
        });
    } catch (error) {
        console.error('Run Payroll Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
