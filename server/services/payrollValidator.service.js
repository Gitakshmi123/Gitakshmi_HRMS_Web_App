/**
 * PayrollValidator Service
 * Comprehensive validation rules and pre-flight checks
 * Production-ready validation engine with detailed error reporting
 */

const mongoose = require('mongoose');

/**
 * Main validation orchestrator
 */
async function validatePayrollRun(db, tenantId, month, year) {
  const validationResults = [];
  const Employee = db.model('Employee');
  const PayrollRun = db.model('PayrollRun');
  const SalaryAssignment = db.model('SalaryAssignment');
  const Attendance = db.model('Attendance');

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // ════════════════════════════════════════════════════════════════
  // VALIDATION 1: Duplicate Payroll Run Check
  // ════════════════════════════════════════════════════════════════
  {
    const existing = await PayrollRun.findOne({
      tenantId,
      month,
      year,
      status: { $ne: 'CANCELLED' }
    });

    if (existing) {
      validationResults.push({
        rule: 'NO_DUPLICATE_RUNS',
        severity: 'ERROR',
        status: 'FAIL',
        message: `Payroll for ${month}/${year} already exists in ${existing.status} status`,
        metadata: {
          existingRunId: existing._id,
          existingStatus: existing.status,
          initiatedBy: existing.initiatedBy,
          initiatedAt: existing.initiatedAt
        }
      });
      return { passed: false, validations: validationResults };
    } else {
      validationResults.push({
        rule: 'NO_DUPLICATE_RUNS',
        severity: 'INFO',
        status: 'PASS',
        message: 'No existing payroll for this month'
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // VALIDATION 2: Fetch Eligible Employees
  // ════════════════════════════════════════════════════════════════
  const eligibleEmployees = await Employee.find({
    tenant: tenantId,
    status: 'Active',
    joiningDate: { $lte: endDate }
  }).lean();

  validationResults.push({
    rule: 'ELIGIBLE_EMPLOYEES_FETCH',
    severity: 'INFO',
    status: 'PASS',
    message: `Found ${eligibleEmployees.length} eligible employees`,
    metadata: { count: eligibleEmployees.length }
  });

  if (eligibleEmployees.length === 0) {
    validationResults.push({
      rule: 'MINIMUM_EMPLOYEES',
      severity: 'WARNING',
      status: 'FAIL',
      message: 'No active employees found for payroll'
    });
    return { passed: false, validations: validationResults };
  }

  // ════════════════════════════════════════════════════════════════
  // VALIDATION 3: Salary Template Assignment
  // ════════════════════════════════════════════════════════════════
  const assignmentMap = new Map();
  const employeesWithoutTemplate = [];

  for (const emp of eligibleEmployees) {
    const assignment = await SalaryAssignment.findOne({
      tenantId,
      employeeId: emp._id,
      effectiveFrom: { $lte: endDate }
    }).sort({ effectiveFrom: -1 });

    if (!assignment || (assignment.effectiveTo && assignment.effectiveTo < startDate)) {
      employeesWithoutTemplate.push({
        _id: emp._id,
        employeeId: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`
      });
    } else {
      assignmentMap.set(emp._id.toString(), assignment);
    }
  }

  if (employeesWithoutTemplate.length > 0) {
    validationResults.push({
      rule: 'ALL_TEMPLATES_ASSIGNED',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${employeesWithoutTemplate.length} employees missing active salary template`,
      metadata: {
        count: employeesWithoutTemplate.length,
        employees: employeesWithoutTemplate.slice(0, 10) // First 10
      }
    });
  } else {
    validationResults.push({
      rule: 'ALL_TEMPLATES_ASSIGNED',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${eligibleEmployees.length} employees have active salary templates`
    });
  }

  // ════════════════════════════════════════════════════════════════
  // VALIDATION 4: Attendance Data Availability
  // ════════════════════════════════════════════════════════════════
  const daysInMonth = endDate.getDate();
  const minimumAttendanceExpected = daysInMonth - 7; // Allow some missing days

  const employeeAttendance = await Promise.all(
    eligibleEmployees.map(async (emp) => {
      const count = await Attendance.countDocuments({
        tenant: tenantId,
        employee: emp._id,
        date: { $gte: startDate, $lte: endDate }
      });
      return {
        employeeId: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        attendanceRecords: count
      };
    })
  );

  const employeesMissingAttendance = employeeAttendance.filter(
    a => a.attendanceRecords === 0
  );

  if (employeesMissingAttendance.length > 0) {
    validationResults.push({
      rule: 'ATTENDANCE_DATA_AVAILABLE',
      severity: 'WARNING',
      status: 'PARTIAL',
      message: `${employeesMissingAttendance.length} employees have no attendance records`,
      metadata: {
        count: employeesMissingAttendance.length,
        employees: employeesMissingAttendance.slice(0, 10)
      }
    });
  } else {
    validationResults.push({
      rule: 'ATTENDANCE_DATA_AVAILABLE',
      severity: 'INFO',
      status: 'PASS',
      message: `All employees have attendance records`
    });
  }

  // ════════════════════════════════════════════════════════════════
  // VALIDATION 5: Bank Details Availability
  // ════════════════════════════════════════════════════════════════
  const employeesWithoutBankDetails = eligibleEmployees.filter(
    e => !e.bankDetails || !e.bankDetails.accountNumber
  );

  if (employeesWithoutBankDetails.length > 0) {
    validationResults.push({
      rule: 'BANK_DETAILS_AVAILABLE',
      severity: 'WARNING',
      status: 'PARTIAL',
      message: `${employeesWithoutBankDetails.length} employees missing bank details`,
      metadata: {
        count: employeesWithoutBankDetails.length,
        impact: 'Manual bank transfer required'
      }
    });
  } else {
    validationResults.push({
      rule: 'BANK_DETAILS_AVAILABLE',
      severity: 'INFO',
      status: 'PASS',
      message: `All employees have bank details`
    });
  }

  // ════════════════════════════════════════════════════════════════
  // VALIDATION 6: Configuration Availability
  // ════════════════════════════════════════════════════════════════
  const PayrollConfiguration = db.model('PayrollConfiguration') || 
    await require('./PayrollConfiguration');
  
  const config = await PayrollConfiguration.findOne({ tenantId });
  
  if (!config) {
    validationResults.push({
      rule: 'PAYROLL_CONFIGURATION_EXISTS',
      severity: 'ERROR',
      status: 'FAIL',
      message: 'Payroll configuration not set up for this tenant',
      metadata: {
        action: 'Setup PayrollConfiguration with tax rules and statutory deductions'
      }
    });
  } else {
    validationResults.push({
      rule: 'PAYROLL_CONFIGURATION_EXISTS',
      severity: 'INFO',
      status: 'PASS',
      message: 'Payroll configuration found'
    });
  }

  // Determine overall pass/fail
  const hasErrors = validationResults.some(v => v.severity === 'ERROR');

  return {
    passed: !hasErrors,
    validationResults,
    summary: {
      totalChecks: validationResults.length,
      passed: validationResults.filter(v => v.status === 'PASS').length,
      warnings: validationResults.filter(v => v.severity === 'WARNING').length,
      errors: validationResults.filter(v => v.severity === 'ERROR').length
    }
  };
}

/**
 * Post-calculation validation
 * Checks payslips for anomalies before approval
 */
async function validatePayslips(db, payrollRunId) {
  const Payslip = db.model('Payslip');
  const PayrollRun = db.model('PayrollRun');

  const payslips = await Payslip.find({ payrollRunId }).lean();
  const validationResults = [];

  // ════════════════════════════════════════════════════════════════
  // CHECK 1: Negative Net Pay
  // ════════════════════════════════════════════════════════════════
  const negativeNetPay = payslips.filter(p => p.netPay < 0);
  if (negativeNetPay.length > 0) {
    validationResults.push({
      rule: 'NO_NEGATIVE_NET_PAY',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${negativeNetPay.length} payslips have negative net pay`,
      metadata: {
        count: negativeNetPay.length,
        payslips: negativeNetPay.map(p => ({
          employeeId: p.employeeId,
          netPay: p.netPay
        })).slice(0, 5)
      }
    });
  } else {
    validationResults.push({
      rule: 'NO_NEGATIVE_NET_PAY',
      severity: 'INFO',
      status: 'PASS',
      message: 'All payslips have positive net pay'
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 2: Unreasonably High Deductions
  // ════════════════════════════════════════════════════════════════
  const highDeductions = payslips.filter(p => {
    const deductionPercent = (p.preTaxDeductionsTotal + p.incomeTax + p.postTaxDeductionsTotal) / p.grossEarnings;
    return deductionPercent > 0.6; // More than 60% deductions is suspicious
  });

  if (highDeductions.length > 0) {
    validationResults.push({
      rule: 'REASONABLE_DEDUCTIONS',
      severity: 'WARNING',
      status: 'PARTIAL',
      message: `${highDeductions.length} payslips have unusually high deductions (>60%)`,
      metadata: {
        count: highDeductions.length,
        payslips: highDeductions.map(p => ({
          employeeId: p.employeeId,
          deductionPercent: ((p.preTaxDeductionsTotal + p.incomeTax + p.postTaxDeductionsTotal) / p.grossEarnings * 100).toFixed(2)
        })).slice(0, 5)
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 3: Zero Gross Earnings
  // ════════════════════════════════════════════════════════════════
  const zeroGross = payslips.filter(p => p.grossEarnings === 0);
  if (zeroGross.length > 0) {
    validationResults.push({
      rule: 'POSITIVE_GROSS_EARNINGS',
      severity: 'WARNING',
      status: 'PARTIAL',
      message: `${zeroGross.length} payslips have zero gross earnings`,
      metadata: {
        count: zeroGross.length,
        payslips: zeroGross.map(p => p.employeeId)
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 4: Tax Anomalies
  // ════════════════════════════════════════════════════════════════
  const unexpectedZeroTax = payslips.filter(p => {
    // High earners with zero tax is suspicious (unless under slab)
    return p.taxableIncome > 250000 && p.incomeTax === 0;
  });

  if (unexpectedZeroTax.length > 0) {
    validationResults.push({
      rule: 'TAX_CALCULATION_REVIEW',
      severity: 'WARNING',
      status: 'PARTIAL',
      message: `${unexpectedZeroTax.length} high-earning payslips have zero TDS`,
      metadata: {
        count: unexpectedZeroTax.length,
        note: 'Verify if within tax slab or if exemption applies'
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 5: Hash Integrity
  // ════════════════════════════════════════════════════════════════
  const corruptedHashes = payslips.filter(p => !p.hash);
  if (corruptedHashes.length > 0) {
    validationResults.push({
      rule: 'DATA_INTEGRITY',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${corruptedHashes.length} payslips missing integrity hash`,
      metadata: {
        count: corruptedHashes.length
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════
  const hasErrors = validationResults.some(v => v.severity === 'ERROR');
  const canApprove = !hasErrors;

  return {
    payrollRunId,
    canApprove,
    validationResults,
    summary: {
      totalPayslips: payslips.length,
      totalGross: payslips.reduce((sum, p) => sum + p.grossEarnings, 0),
      totalNetPay: payslips.reduce((sum, p) => sum + p.netPay, 0),
      averageNetPay: payslips.reduce((sum, p) => sum + p.netPay, 0) / payslips.length,
      errors: validationResults.filter(v => v.severity === 'ERROR').length,
      warnings: validationResults.filter(v => v.severity === 'WARNING').length
    }
  };
}

module.exports = {
  validatePayrollRun,
  validatePayslips
};
