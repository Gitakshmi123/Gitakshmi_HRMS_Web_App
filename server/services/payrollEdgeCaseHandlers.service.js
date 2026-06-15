/**
 * Payroll Edge Case Handlers
 * Handles complex payroll scenarios:
 * - New joiners (pro-rata)
 * - Resignations (pro-rata)
 * - Negative net pay
 * - Salary revisions
 * - Attendance corrections
 */

const mongoose = require('mongoose');

/**
 * Handle New Joiner Pro-Rata Calculation
 * Employee joins mid-month: salary is pro-rated based on days worked
 */
async function handleNewJoiner(
  employee,
  salaryTemplate,
  month,
  year,
  config
) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const daysInMonth = monthEnd.getDate();

  // Joining date
  const joiningDate = new Date(employee.joiningDate);
  
  // Only pro-rata if joined after month start
  if (joiningDate > monthStart) {
    const workingDaysStart = joiningDate;
    const workingDaysEnd = monthEnd;
    const daysWorked = Math.ceil((workingDaysEnd - workingDaysStart) / (1000 * 86400)) + 1;
    
    return {
      isProRata: true,
      startDate: workingDaysStart,
      endDate: workingDaysEnd,
      daysWorked,
      totalDays: daysInMonth,
      proRataFactor: daysWorked / daysInMonth,
      description: `Joined on ${joiningDate.toDateString()} - ${daysWorked} days worked`
    };
  }

  return {
    isProRata: false,
    startDate: monthStart,
    endDate: monthEnd,
    daysWorked: daysInMonth,
    totalDays: daysInMonth,
    proRataFactor: 1.0,
    description: 'Full month of employment'
  };
}

/**
 * Handle Resignation Pro-Rata Calculation
 * Employee resigns mid-month: salary is pro-rated to resignation date
 * Unpaid leave becomes LOP (Loss of Pay)
 */
async function handleResignation(
  employee,
  salaryTemplate,
  month,
  year,
  config,
  db
) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const daysInMonth = monthEnd.getDate();

  // Get resignation date from employee record
  const resignationDate = employee.exitDate || employee.separationDate;

  if (!resignationDate) {
    return {
      isProRata: false,
      startDate: monthStart,
      endDate: monthEnd,
      daysWorked: daysInMonth,
      totalDays: daysInMonth,
      proRataFactor: 1.0,
      description: 'No resignation recorded'
    };
  }

  if (resignationDate.getMonth() === month - 1 && resignationDate.getFullYear() === year) {
    const workingDaysEnd = resignationDate;
    const daysWorked = Math.ceil((workingDaysEnd - monthStart) / (1000 * 86400)) + 1;

    // Calculate unused leaves as LOP
    const LeaveBalance = db.model('LeaveBalance');
    const unusedLeaves = await LeaveBalance.findOne({
      employeeId: employee._id,
      year
    });

    return {
      isProRata: true,
      startDate: monthStart,
      endDate: workingDaysEnd,
      daysWorked,
      totalDays: daysInMonth,
      proRataFactor: daysWorked / daysInMonth,
      description: `Resigned on ${resignationDate.toDateString()} - ${daysWorked} days worked`,
      unusedLeavesAsLOP: (unusedLeaves?.balance || 0) > 0 ? {
        leaveDays: unusedLeaves.balance,
        status: 'FORFEITED_AS_LOP'
      } : null
    };
  }

  return {
    isProRata: false,
    startDate: monthStart,
    endDate: monthEnd,
    daysWorked: daysInMonth,
    totalDays: daysInMonth,
    proRataFactor: 1.0,
    description: 'Resignation not in this month'
  };
}

/**
 * Detect and Handle Negative Net Pay
 * Payslip with negative net pay cannot be auto-approved
 * Requires manual investigation and correction
 */
async function handleNegativeNetPay(payslip, db) {
  if (payslip.netPay >= 0) {
    return { hasNegativeNetPay: false };
  }

  // Flag payslip as DISPUTED
  payslip.status = 'DISPUTED';
  payslip.requiresManualReview = true;

  // Find root cause
  const analysis = {
    hasNegativeNetPay: true,
    netPay: payslip.netPay,
    grossEarnings: payslip.grossEarnings,
    totalDeductions: payslip.preTaxDeductionsTotal + payslip.incomeTax + payslip.postTaxDeductionsTotal,
    
    rootCauses: [],
    recommendations: []
  };

  // Analysis 1: High post-tax deductions
  if (payslip.postTaxDeductionsTotal > payslip.grossEarnings * 0.3) {
    analysis.rootCauses.push({
      cause: 'HIGH_POST_TAX_DEDUCTIONS',
      amount: payslip.postTaxDeductionsTotal,
      percentage: (payslip.postTaxDeductionsTotal / payslip.grossEarnings * 100).toFixed(2)
    });
    analysis.recommendations.push('Review active loans, advances, and penalties');
  }

  // Analysis 2: Zero or near-zero gross
  if (payslip.grossEarnings < 5000) {
    analysis.rootCauses.push({
      cause: 'LOW_GROSS_EARNINGS',
      amount: payslip.grossEarnings
    });
    analysis.recommendations.push('Verify attendance and pro-rata calculations for new joiners/resignations');
  }

  // Analysis 3: Excessive LOP
  if (payslip.attendanceSummary?.lopDays > payslip.attendanceSummary?.totalDays * 0.5) {
    analysis.rootCauses.push({
      cause: 'EXCESSIVE_LOP',
      lopDays: payslip.attendanceSummary.lopDays,
      totalDays: payslip.attendanceSummary.totalDays
    });
    analysis.recommendations.push('Review attendance records - verify backdated corrections');
  }

  return analysis;
}

/**
 * Handle Mid-Month Salary Revision
 * Allow corrections to salary template if payroll not yet locked
 * Creates amended payslip, preserves original for audit
 */
async function handleSalaryRevision(
  payslipId,
  newTemplateId,
  reason,
  db,
  currentUser
) {
  const Payslip = db.model('Payslip');
  const PayrollRun = db.model('PayrollRun');
  const AmendedPayslip = db.model('AmendedPayslip');

  const payslip = await Payslip.findById(payslipId);
  if (!payslip) throw new Error('Payslip not found');

  const payrollRun = await PayrollRun.findById(payslip.payrollRunId);

  // Validation: Cannot amend after payment (unless override)
  if (payrollRun.status === 'PAID') {
    throw new Error('Cannot amend payslip after payment. Create a new restatement.');
  }

  // Validation: Within 30-day amendment window
  const daysSinceLock = (Date.now() - payslip.createdAt) / (1000 * 86400);
  if (daysSinceLock > 30) {
    throw new Error('Amendment window (30 days) has passed');
  }

  // Create amended record
  const amended = new AmendedPayslip({
    originalPayslipId: payslip._id,
    payrollRunId: payslip.payrollRunId,
    employeeId: payslip.employeeId,
    tenantId: payslip.tenantId,
    
    version: 2,
    reason: reason || 'Salary revision',
    
    changes: {
      salaryTemplateId: newTemplateId,
      oldTemplateId: payslip.salaryTemplateId
    },
    
    // Recalculated values would go here after re-calculation
    recalculatedValues: {},
    
    createdBy: currentUser._id,
    approvedBy: null,
    status: 'PENDING_APPROVAL'
  });

  await amended.save();

  return {
    amended,
    message: 'Payslip amendment created - pending approval',
    originalPayslipId: payslip._id,
    amendmentId: amended._id
  };
}

/**
 * Handle Backdated Attendance Correction
 * Recalculate payroll based on corrected attendance
 * Only if payroll not yet locked
 */
async function handleBackdatedAttendanceCorrection(
  payslipId,
  attendanceCorrections,
  reason,
  db,
  currentUser
) {
  const Payslip = db.model('Payslip');
  const Attendance = db.model('Attendance');
  const PayrollRun = db.model('PayrollRun');
  const PayrollAuditLog = db.model('PayrollAuditLog');

  const payslip = await Payslip.findById(payslipId);
  const payrollRun = await PayrollRun.findById(payslip.payrollRunId);

  // Strict lock check
  if (payrollRun.status === 'PAID') {
    throw new Error('Cannot recalculate after payment');
  }

  if (payrollRun.locked) {
    throw new Error('Payroll is locked and cannot be recalculated');
  }

  // Apply attendance corrections
  for (const correction of attendanceCorrections) {
    await Attendance.updateOne(
      { _id: correction.attendanceId },
      { $set: { status: correction.newStatus, correctedAt: new Date() } }
    );
  }

  // Log the correction
  await PayrollAuditLog.create({
    tenantId: payslip.tenantId,
    payrollRunId: payslip.payrollRunId,
    payslipId: payslip._id,
    timestamp: new Date(),
    action: 'ATTENDANCE_CORRECTED',
    performedBy: currentUser._id,
    details: {
      reason,
      corrections: attendanceCorrections,
      oldPayslipId: payslip._id
    }
  });

  return {
    message: 'Attendance corrected - payslip will be recalculated',
    correctionCount: attendanceCorrections.length,
    payslipId: payslip._id
  };
}

/**
 * Calculate Prorated Amount for Any Component
 * Used for:
 * - New joiner salary
 * - Resignation salary
 * - Temporary salary reduction
 */
function calculateProRataAmount(
  monthlyAmount,
  daysWorked,
  totalDaysInMonth
) {
  // Pro-rata = (monthlyAmount / totalDays) * daysWorked
  const dailyRate = monthlyAmount / totalDaysInMonth;
  const prorataAmount = dailyRate * daysWorked;
  
  // Round to nearest paisa (0.01)
  return Math.round(prorataAmount * 100) / 100;
}

/**
 * Validate Payroll Lock Status
 * Ensure payroll is locked and immutable after approval
 */
async function validatePayrollLocked(payrollRunId, db) {
  const PayrollRun = db.model('PayrollRun');
  const payrollRun = await PayrollRun.findById(payrollRunId);

  if (!payrollRun) throw new Error('Payroll run not found');

  const isLocked = payrollRun.status === 'APPROVED' || payrollRun.status === 'PAID';

  return {
    payrollRunId,
    isLocked,
    status: payrollRun.status,
    lockedAt: payrollRun.approvedAt || payrollRun.paidAt,
    canModify: !isLocked
  };
}

/**
 * Generate Payroll Summary for Reporting
 * Used by finance for bank transfer, accounting entries, etc.
 */
async function generatePayrollSummary(payrollRunId, db) {
  const PayrollRun = db.model('PayrollRun');
  const Payslip = db.model('Payslip');

  const payrollRun = await PayrollRun.findById(payrollRunId);
  const payslips = await Payslip.find({ payrollRunId }).lean();

  // Aggregate by component
  const summary = {
    payrollRunId,
    month: payrollRun.month,
    year: payrollRun.year,
    status: payrollRun.status,
    
    employeeSummary: {
      total: payslips.length,
      processed: payslips.filter(p => p.status !== 'FAILED').length,
      failed: payslips.filter(p => p.status === 'FAILED').length
    },

    financialSummary: {
      totalGross: 0,
      totalPretaxDeductions: 0,
      totalTax: 0,
      totalPostTaxDeductions: 0,
      totalNetPay: 0,
      totalEmployerContributions: 0
    },

    earningsBreakdown: {},
    deductionsBreakdown: {},
    
    bankTransferDetails: {
      totalAmount: 0,
      employeeCount: 0,
      byBank: {}
    }
  };

  // Aggregate data
  payslips.forEach(payslip => {
    summary.financialSummary.totalGross += payslip.grossEarnings;
    summary.financialSummary.totalPretaxDeductions += payslip.preTaxDeductionsTotal;
    summary.financialSummary.totalTax += payslip.incomeTax;
    summary.financialSummary.totalPostTaxDeductions += payslip.postTaxDeductionsTotal;
    summary.financialSummary.totalNetPay += payslip.netPay;

    // Earnings breakdown
    (payslip.earningsSnapshot || []).forEach(earning => {
      if (!summary.earningsBreakdown[earning.name]) {
        summary.earningsBreakdown[earning.name] = 0;
      }
      summary.earningsBreakdown[earning.name] += earning.amount;
    });

    // Bank transfer
    if (payslip.employeeInfo?.bankName) {
      if (!summary.bankTransferDetails.byBank[payslip.employeeInfo.bankName]) {
        summary.bankTransferDetails.byBank[payslip.employeeInfo.bankName] = {
          count: 0,
          amount: 0
        };
      }
      summary.bankTransferDetails.byBank[payslip.employeeInfo.bankName].count++;
      summary.bankTransferDetails.byBank[payslip.employeeInfo.bankName].amount += payslip.netPay;
    }

    summary.bankTransferDetails.totalAmount += payslip.netPay;
    summary.bankTransferDetails.employeeCount++;
  });

  return summary;
}

module.exports = {
  handleNewJoiner,
  handleResignation,
  handleNegativeNetPay,
  handleSalaryRevision,
  handleBackdatedAttendanceCorrection,
  calculateProRataAmount,
  validatePayrollLocked,
  generatePayrollSummary
};
