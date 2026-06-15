/**
 * Payroll Compensation Source Service
 * 
 * Handles payroll calculation using Employee Compensation (salarySnapshotId)
 * instead of Salary Templates, with safe fallbacks and backward compatibility.
 * 
 * RULES:
 * 1. Uses applicant.salarySnapshotId (from EmployeeSalarySnapshot)
 * 2. Extracts: ctc, monthlyCTC, earnings[], deductions[], benefits[]
 * 3. Falls back to Salary Template if no salary snapshot found
 * 4. No changes to existing template logic
 * 5. Payslip tracks which source was used
 */

const mongoose = require('mongoose');

/**
 * Fetch compensation data for an employee
 * Returns populated salary snapshot if available
 */
async function getEmployeeCompensation(db, tenantId, employeeId) {
    try {
        const Applicant = db.model('Applicant');
        const Employee = db.model('Employee');
        const EmployeeCompensation = db.model('EmployeeCompensation');

        let applicant = null;
        let mainComp = null;
        const employee = await Employee.findById(employeeId);

        if (employee) {
            // Priority 1: Check EmployeeCompensation model (Master source)
            mainComp = await EmployeeCompensation.findOne({
                employeeId: employee._id,
                isActive: true,
                status: 'ACTIVE'
            }).lean();

            if (mainComp) {
                return {
                    found: true,
                    source: 'EMPLOYEE_COMPENSATION',
                    employeeId,
                    compensation: {
                        annualCTC: mainComp.totalCTC || 0,
                        monthlyCTC: Math.round((mainComp.totalCTC || 0) / 12),
                        grossEarnings: mainComp.grossA || 0,
                        totalDeductions: 0, // Simplified for preview
                        totalBenefits: mainComp.grossB || 0,
                        earnings: mainComp.components?.filter(c => c && (c.type || '').toUpperCase() === 'EARNING').map(e => ({
                            name: e.name,
                            monthlyAmount: e.monthlyAmount,
                            yearlyAmount: e.annualAmount,
                            isProRata: e.isProRata,
                            isTaxable: e.isTaxable
                        })) || [],
                        employeeDeductions: mainComp.components?.filter(c => c && (c.type || '').toUpperCase() === 'DEDUCTION').map(d => ({
                            name: d.name,
                            monthlyAmount: d.monthlyAmount,
                            yearlyAmount: d.annualAmount,
                            isProRata: d.isProRata,
                            isTaxable: d.isTaxable
                        })) || [],
                        benefits: mainComp.components?.filter(c => c && (c.type || '').toUpperCase() === 'BENEFIT').map(b => ({
                            name: b.name,
                            monthlyAmount: b.monthlyAmount,
                            yearlyAmount: b.annualAmount,
                            isProRata: b.isProRata,
                            isTaxable: b.isTaxable
                        })) || [],
                        effectiveFrom: mainComp.effectiveFrom,
                        reason: 'ACTIVE_STRUCTURE'
                    }
                };
            }

            // Priority 1.5: Check Employee's own direct snapshot link
            // Try both commonly used field names: currentSalarySnapshotId, currentSnapshotId
            const empWithSnap = await Employee.findById(employee._id)
                .populate('currentSalarySnapshotId')
                .populate('currentSnapshotId')
                .lean();

            const directSnapshot = empWithSnap?.currentSalarySnapshotId || empWithSnap?.currentSnapshotId;

            if (directSnapshot) {
                return {
                    found: true,
                    source: 'EMPLOYEE_SNAPSHOT',
                    employeeId,
                    compensation: {
                        annualCTC: directSnapshot.ctc || 0,
                        monthlyCTC: directSnapshot.monthlyCTC || 0,
                        grossEarnings: directSnapshot.summary?.grossEarnings || directSnapshot.breakdown?.totalEarnings || 0,
                        totalDeductions: directSnapshot.summary?.totalDeductions || directSnapshot.breakdown?.totalDeductions || 0,
                        totalBenefits: directSnapshot.summary?.totalBenefits || directSnapshot.breakdown?.totalBenefits || 0,
                        earnings: directSnapshot.earnings || [],
                        employeeDeductions: directSnapshot.employeeDeductions || [],
                        benefits: directSnapshot.benefits || [],
                        effectiveFrom: directSnapshot.effectiveFrom,
                        reason: directSnapshot.reason || 'ASSIGNED_SNAPSHOT'
                    }
                };
            }

            // Priority 2: Find applicant linked to this employee
            applicant = await Applicant.findOne({
                tenant: tenantId,
                $or: [
                    { email: employee.email?.toLowerCase() },
                    { employeeId: employee._id }
                ]
            })
                .populate('salarySnapshotId')
                .lean();
        } else {
            // Not found as employee, try finding as Applicant directly
            applicant = await Applicant.findOne({
                _id: employeeId,
                tenant: tenantId
            })
                .populate('salarySnapshotId')
                .lean();
        }

        if (!applicant || !applicant.salarySnapshotId) {
            return {
                found: false,
                message: 'No compensation record found for this person'
            };
        }

        const snapshot = applicant.salarySnapshotId;

        return {
            found: true,
            source: 'COMPENSATION',
            employeeId,
            applicantId: applicant._id,
            compensation: {
                annualCTC: snapshot.ctc || 0,
                monthlyCTC: snapshot.monthlyCTC || 0,
                grossEarnings: snapshot.summary?.grossEarnings || snapshot.breakdown?.totalEarnings || 0,
                totalDeductions: snapshot.summary?.totalDeductions || snapshot.breakdown?.totalDeductions || 0,
                totalBenefits: snapshot.summary?.totalBenefits || snapshot.breakdown?.totalBenefits || 0,
                earnings: snapshot.earnings || [],
                employeeDeductions: snapshot.employeeDeductions || [],
                benefits: snapshot.benefits || [],
                effectiveFrom: snapshot.effectiveFrom,
                reason: snapshot.reason || 'ASSIGNMENT'
            }
        };
    } catch (error) {
        console.error('[Compensation Source] Error fetching compensation:', error);
        return {
            found: false,
            error: error.message
        };
    }
}

/**
 * Convert Compensation snapshot to template-like format
 * for use in existing payroll calculation logic
 */
function convertCompensationToTemplate(compensation) {
    return {
        _id: new mongoose.Types.ObjectId(),
        templateName: `Compensation Version (${compensation.reason})`,
        source: 'COMPENSATION',
        annualCTC: compensation.annualCTC,
        monthlyCTC: compensation.monthlyCTC,

        // Convert earnings array to template format
        earnings: (compensation.earnings || []).map(e => ({
            name: e.name,
            monthlyAmount: e.monthlyAmount || 0,
            annualAmount: e.yearlyAmount || 0,
            proRata: e.isProRata !== undefined ? e.isProRata : (e.name?.toLowerCase().includes('basic')), // Use flag or default for Basic
            taxable: e.isTaxable !== undefined ? e.isTaxable : true // Use flag or default to true
        })),

        // Convert deductions to template format
        employerDeductions: (compensation.benefits || []).map(b => ({
            name: b.name,
            monthlyAmount: b.monthlyAmount || 0
        })),

        // Default settings (can be expanded based on compensation data)
        settings: {
            includePensionScheme: true,
            pfWageRestriction: true,
            includeESI: true
        },

        // Track source for audit
        _compensationSnapshot: {
            ctc: compensation.annualCTC,
            monthlyCTC: compensation.monthlyCTC,
            grossEarnings: compensation.grossEarnings,
            effectiveFrom: compensation.effectiveFrom,
            reason: compensation.reason
        }
    };
}

/**
 * Validate if employee can use compensation source
 * Guards against incomplete salary setup
 */
function validateCompensationSource(compensationData) {
    const issues = [];

    if (!compensationData.found) {
        issues.push('No compensation record found');
    }

    if (compensationData.compensation?.annualCTC <= 0) {
        issues.push('Annual CTC not set or invalid');
    }

    if (compensationData.compensation?.monthlyCTC <= 0) {
        issues.push('Monthly CTC not calculated');
    }

    if (!compensationData.compensation?.earnings || compensationData.compensation.earnings.length === 0) {
        issues.push('No earnings components defined in compensation');
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Guard function: Check which source to use for payroll
 * Priority: Compensation (if flag ON and valid) > Salary Template (default)
 */
async function selectPayrollSource(db, tenantId, employeeId, useCompensationSource = false) {
    // If compensation source not requested, use template
    if (!useCompensationSource) {
        return {
            source: 'TEMPLATE',
            useCompensation: false,
            message: 'Using Salary Template (compensation source disabled)'
        };
    }

    // Try to fetch compensation
    const compensationData = await getEmployeeCompensation(db, tenantId, employeeId);

    // If compensation found and valid, use it
    if (compensationData.found) {
        const validation = validateCompensationSource(compensationData);

        if (validation.valid) {
            return {
                source: 'COMPENSATION',
                useCompensation: true,
                compensation: compensationData.compensation,
                template: convertCompensationToTemplate(compensationData.compensation),
                message: 'Using Employee Compensation as payroll source'
            };
        } else {
            // Compensation found but invalid, fallback to template
            console.warn(`[Payroll] Compensation for employee ${employeeId} invalid:`, validation.issues);
            return {
                source: 'TEMPLATE',
                useCompensation: false,
                fallback: true,
                fallbackReason: validation.issues.join('; '),
                message: `Compensation invalid, falling back to Salary Template: ${validation.issues.join('; ')}`
            };
        }
    }

    // No compensation found, fallback to template
    return {
        source: 'TEMPLATE',
        useCompensation: false,
        fallback: true,
        fallbackReason: compensationData.error || 'No compensation record',
        message: 'No compensation record found, using Salary Template'
    };
}

/**
 * Extract salary components from compensation for payslip breakdown
 */
function extractCompensationBreakdown(compensation) {
    return {
        earnings: (compensation.earnings || []).map(e => ({
            name: e.name,
            monthlyAmount: e.monthlyAmount,
            yearlyAmount: e.yearlyAmount,
            calculationType: e.calculationType
        })),

        employeeDeductions: (compensation.employeeDeductions || []).map(d => ({
            name: d.name,
            monthlyAmount: d.monthlyAmount,
            yearlyAmount: d.yearlyAmount,
            calculationType: d.calculationType
        })),

        benefits: (compensation.benefits || []).map(b => ({
            name: b.name,
            monthlyAmount: b.monthlyAmount,
            yearlyAmount: b.yearlyAmount,
            calculationType: b.calculationType
        })),

        summary: {
            grossEarnings: compensation.grossEarnings,
            totalDeductions: compensation.totalDeductions,
            totalBenefits: compensation.totalBenefits,
            monthlyCTC: compensation.monthlyCTC,
            annualCTC: compensation.annualCTC
        }
    };
}

module.exports = {
    getEmployeeCompensation,
    convertCompensationToTemplate,
    validateCompensationSource,
    selectPayrollSource,
    extractCompensationBreakdown
};
