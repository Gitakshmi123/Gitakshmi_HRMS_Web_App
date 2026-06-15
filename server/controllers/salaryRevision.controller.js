const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');

/**
 * Salary Revision Controller
 * 
 * Handles:
 * - Increments (CTC increase, same role)
 * - Revisions (structure change, same role)
 * - Promotions (role + grade + salary change)
 * 
 * CRITICAL PRINCIPLES:
 * - Salary is IMMUTABLE once used in payroll/joining letter
 * - Any change creates a NEW SNAPSHOT
 * - Payroll ALWAYS uses snapshot valid for that month
 * - Full audit trail mandatory
 */

/**
 * CREATE INCREMENT / REVISION / PROMOTION
 * POST /api/hr/employees/:id/salary-revision
 */
exports.createSalaryRevision = async (req, res) => {
    try {
        const { id: employeeId } = req.params;
        const {
            type,
            salaryTemplateId,
            effectiveFrom,
            reason,
            promotionDetails,
            notes
        } = req.body;

        const tenantId = req.user.tenantId;
        const userId = req.user._id;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');

        // Validate required fields
        if (!type || !['INCREMENT', 'REVISION', 'PROMOTION'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Valid type required (INCREMENT, REVISION, or PROMOTION)'
            });
        }

        if (!salaryTemplateId) {
            return res.status(400).json({
                success: false,
                message: 'Salary template ID required'
            });
        }

        if (!effectiveFrom) {
            return res.status(400).json({
                success: false,
                message: 'Effective from date required'
            });
        }

        if (type === 'PROMOTION' && !promotionDetails) {
            return res.status(400).json({
                success: false,
                message: 'Promotion details required for PROMOTION type'
            });
        }

        const tenantDB = await getTenantDB(tenantId);
        const Employee = tenantDB.model('Employee');
        const SalaryTemplate = tenantDB.model('SalaryTemplate');
        const EmployeeSalarySnapshot = tenantDB.model('EmployeeSalarySnapshot');
        const SalaryRevision = tenantDB.model('SalaryRevision');

        // Fetch employee
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Fetch new salary template
        const newTemplate = await SalaryTemplate.findById(salaryTemplateId);
        if (!newTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Salary template not found'
            });
        }

        // Fetch current salary snapshot
        let oldSnapshot = null;
        if (employee.currentSalarySnapshotId) {
            oldSnapshot = await EmployeeSalarySnapshot.findById(employee.currentSalarySnapshotId);
        }

        // If no current snapshot, check legacy field
        if (!oldSnapshot && employee.salarySnapshotId) {
            oldSnapshot = await EmployeeSalarySnapshot.findById(employee.salarySnapshotId);
        }

        if (!oldSnapshot) {
            return res.status(400).json({
                success: false,
                message: 'Employee has no current salary snapshot. Cannot create revision.'
            });
        }

        const SalaryEngine = require('../services/salaryEngine');

        // ... (imports)

        // ... (at top of createSalaryRevision)
        // Import SalaryEngine at the top of the file!
        // Wait, I can't add imports with this tool easily in one chunk if I am targeting the middle. 
        // However, I will assume the user or I can add the require. 
        // Actually, I should probably replace the whole file or a large chunk to include the require. 
        // But let's try to just use the require inside the function if needed, or add it at line 3 using replace.

        // Let's stick to replacing the logic inside createSalaryRevision first.

        // Calculate breakdown for new template using SalaryEngine
        const engineResult = await SalaryEngine.calculate({
            annualCTC: newTemplate.annualCTC,
            template: newTemplate
        });

        // Create old snapshot copy (immutable)
        const oldSnapshotCopy = {
            snapshotId: oldSnapshot._id,
            templateId: oldSnapshot.templateId,
            ctc: oldSnapshot.ctc,
            monthlyCTC: oldSnapshot.monthlyCTC,
            earnings: oldSnapshot.earnings,
            employerDeductions: oldSnapshot.employerDeductions || [],
            employeeDeductions: oldSnapshot.employeeDeductions || [],
            breakdown: oldSnapshot.breakdown || {},
            effectiveFrom: oldSnapshot.effectiveFrom,
            locked: true
        };

        // Create new snapshot copy (from Engine Result)
        const newSnapshotCopy = {
            templateId: newTemplate._id,
            ctc: newTemplate.annualCTC,
            monthlyCTC: newTemplate.monthlyCTC,
            earnings: engineResult.earnings.map(e => ({
                name: e.name,
                componentCode: e.code,
                calculationType: 'FORMULA', // Result is resolved
                formula: e.formula,
                percentage: 0,
                monthlyAmount: e.monthlyAmount,
                annualAmount: e.annualAmount,
                taxable: true, // Default
                proRata: false
            })),
            employerDeductions: engineResult.benefits.map(d => ({
                name: d.name,
                componentCode: d.code,
                calculationType: 'FORMULA',
                formula: d.formula,
                percentage: 0,
                monthlyAmount: d.monthlyAmount,
                annualAmount: d.annualAmount
            })),
            employeeDeductions: engineResult.employeeDeductions.map(d => ({
                name: d.name,
                componentCode: d.code,
                category: 'POST_TAX', // Default
                amountType: 'FORMULA',
                formula: d.formula,
                calculationBase: 'GROSS',
                amountValue: 0,
                monthlyAmount: d.monthlyAmount
            })),
            breakdown: {
                grossA: engineResult.totals.grossMonthly,
                grossB: engineResult.totals.grossMonthly, // Assuming equivalent for now
                grossC: engineResult.totals.grossMonthly,
                takeHome: engineResult.totals.netMonthly,
                totalDeductions: engineResult.totals.deductionsMonthly
            },
            effectiveFrom: new Date(effectiveFrom),
            locked: false
        };

        // Calculate change summary
        const absoluteChange = newTemplate.annualCTC - oldSnapshot.ctc;
        const percentageChange = oldSnapshot.ctc > 0 ? ((absoluteChange / oldSnapshot.ctc) * 100).toFixed(2) : 100;

        // ... (rest of function)

        const changeSummary = {
            oldCTC: oldSnapshot.ctc,
            newCTC: newTemplate.annualCTC,
            absoluteChange,
            percentageChange: parseFloat(percentageChange),
            reason: reason || ''
        };

        // Prepare promotion details if applicable
        let promotionData = null;
        if (type === 'PROMOTION' && promotionDetails) {
            promotionData = {
                oldDesignation: employee.designation || '',
                newDesignation: promotionDetails.newDesignation || '',
                oldDepartment: employee.department || '',
                newDepartment: promotionDetails.newDepartment || '',
                oldDepartmentId: employee.departmentId,
                newDepartmentId: promotionDetails.newDepartmentId,
                oldGrade: employee.grade || '',
                newGrade: promotionDetails.newGrade || '',
                oldRole: employee.role || '',
                newRole: promotionDetails.newRole || ''
            };
        }

        // Create salary revision record
        const revision = new SalaryRevision({
            tenantId,
            employeeId,
            type,
            effectiveFrom: new Date(effectiveFrom),
            appliedOn: new Date(),
            oldSnapshot: oldSnapshotCopy,
            newSnapshot: newSnapshotCopy,
            changeSummary,
            promotionDetails: promotionData,
            status: 'DRAFT',
            newTemplateId: salaryTemplateId,
            notes,
            audit: {
                createdAt: new Date(),
                createdBy: userId,
                ipAddress,
                userAgent
            }
        });

        await revision.save();

        res.status(201).json({
            success: true,
            message: 'Salary revision created successfully',
            data: revision
        });

    } catch (error) {
        console.error('Error creating salary revision:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create salary revision',
            error: error.message
        });
    }
};

/**
 * APPROVE SALARY REVISION
 * POST /api/hr/salary-revisions/:id/approve
 */
exports.approveSalaryRevision = async (req, res) => {
    try {
        const { id: revisionId } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user._id;

        const tenantDB = await getTenantDB(tenantId);
        const SalaryRevision = tenantDB.model('SalaryRevision');
        const Employee = tenantDB.model('Employee');
        const EmployeeSalarySnapshot = tenantDB.model('EmployeeSalarySnapshot');

        // Fetch revision
        const revision = await SalaryRevision.findById(revisionId);
        if (!revision) {
            return res.status(404).json({
                success: false,
                message: 'Salary revision not found'
            });
        }

        if (revision.status !== 'DRAFT' && revision.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve revision with status: ${revision.status}`
            });
        }

        // Create new salary snapshot
        const newSnapshot = new EmployeeSalarySnapshot({
            employee: revision.employeeId,
            tenant: tenantId,
            templateId: revision.newSnapshot.templateId,
            ctc: revision.newSnapshot.ctc,
            monthlyCTC: revision.newSnapshot.monthlyCTC,
            earnings: revision.newSnapshot.earnings,
            employerDeductions: revision.newSnapshot.employerDeductions,
            employeeDeductions: revision.newSnapshot.employeeDeductions,
            breakdown: revision.newSnapshot.breakdown,
            effectiveFrom: revision.effectiveFrom,
            locked: true,
            lockedAt: new Date(),
            lockedBy: userId,
            reason: revision.type,
            revisionId: revision._id,
            createdBy: userId
        });

        await newSnapshot.save();

        // Update revision with new snapshot ID
        revision.newSnapshot.snapshotId = newSnapshot._id;
        revision.newSnapshot.locked = true;

        // Fetch employee
        const employee = await Employee.findById(revision.employeeId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Add new snapshot to employee's snapshots array
        if (!employee.salarySnapshots) {
            employee.salarySnapshots = [];
        }
        employee.salarySnapshots.push(newSnapshot._id);

        // Update current snapshot reference
        employee.currentSalarySnapshotId = newSnapshot._id;
        employee.salarySnapshotId = newSnapshot._id; // Legacy field

        // If promotion, update employee details
        if (revision.type === 'PROMOTION' && revision.promotionDetails) {
            if (revision.promotionDetails.newDesignation) {
                employee.designation = revision.promotionDetails.newDesignation;
            }
            if (revision.promotionDetails.newDepartment) {
                employee.department = revision.promotionDetails.newDepartment;
            }
            if (revision.promotionDetails.newDepartmentId) {
                employee.departmentId = revision.promotionDetails.newDepartmentId;
            }
            if (revision.promotionDetails.newGrade) {
                employee.grade = revision.promotionDetails.newGrade;
            }
            if (revision.promotionDetails.newRole) {
                employee.role = revision.promotionDetails.newRole;
            }
            employee.lastPromotionDate = revision.effectiveFrom;
        }

        // Update last increment/revision date
        if (revision.type === 'INCREMENT') {
            employee.lastIncrementDate = revision.effectiveFrom;
        } else if (revision.type === 'REVISION') {
            employee.lastRevisionDate = revision.effectiveFrom;
        }

        await employee.save();

        // Update revision status
        revision.status = 'APPROVED';
        revision.approvedBy = userId;
        revision.approvedAt = new Date();
        revision.audit.appliedAt = new Date();
        revision.audit.appliedBy = userId;

        await revision.save();

        res.status(200).json({
            success: true,
            message: 'Salary revision approved successfully',
            data: {
                revision,
                newSnapshot,
                employee
            }
        });

    } catch (error) {
        console.error('Error approving salary revision:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve salary revision',
            error: error.message
        });
    }
};

/**
 * REJECT SALARY REVISION
 * POST /api/hr/salary-revisions/:id/reject
 */
exports.rejectSalaryRevision = async (req, res) => {
    try {
        const { id: revisionId } = req.params;
        const { reason } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user._id;

        const tenantDB = await getTenantDB(tenantId);
        const SalaryRevision = tenantDB.model('SalaryRevision');

        const revision = await SalaryRevision.findById(revisionId);
        if (!revision) {
            return res.status(404).json({
                success: false,
                message: 'Salary revision not found'
            });
        }

        if (revision.status !== 'DRAFT' && revision.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject revision with status: ${revision.status}`
            });
        }

        revision.status = 'REJECTED';
        revision.rejectedBy = userId;
        revision.rejectedAt = new Date();
        revision.rejectionReason = reason || '';

        await revision.save();

        res.status(200).json({
            success: true,
            message: 'Salary revision rejected',
            data: revision
        });

    } catch (error) {
        console.error('Error rejecting salary revision:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject salary revision',
            error: error.message
        });
    }
};

/**
 * GET EMPLOYEE SALARY HISTORY
 * GET /api/hr/employees/:id/salary-history
 */
exports.getEmployeeSalaryHistory = async (req, res) => {
    try {
        const { id: employeeId } = req.params;
        const tenantId = req.user.tenantId;

        const tenantDB = await getTenantDB(tenantId);
        const Employee = tenantDB.model('Employee');
        const SalaryRevision = tenantDB.model('SalaryRevision');
        const EmployeeSalarySnapshot = tenantDB.model('EmployeeSalarySnapshot');

        // Fetch employee
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Fetch all salary snapshots
        const snapshots = await EmployeeSalarySnapshot.find({
            employee: employeeId
        }).sort({ effectiveFrom: -1 });

        // Fetch all revisions
        const revisions = await SalaryRevision.find({
            employeeId
        })
            .sort({ effectiveFrom: -1 })
            .populate('approvedBy', 'firstName lastName email')
            .populate('rejectedBy', 'firstName lastName email')
            .populate('audit.createdBy', 'firstName lastName email');

        // Build timeline
        const timeline = [];

        // Add joining salary
        const joiningSnapshot = snapshots.find(s => s.reason === 'JOINING');
        if (joiningSnapshot) {
            timeline.push({
                type: 'JOINING',
                date: employee.joiningDate || joiningSnapshot.effectiveFrom,
                ctc: joiningSnapshot.ctc,
                snapshot: joiningSnapshot
            });
        }

        // Add all revisions
        revisions.forEach(revision => {
            timeline.push({
                type: revision.type,
                date: revision.effectiveFrom,
                oldCTC: revision.changeSummary.oldCTC,
                newCTC: revision.changeSummary.newCTC,
                change: revision.changeSummary.absoluteChange,
                percentageChange: revision.changeSummary.percentageChange,
                status: revision.status,
                revision
            });
        });

        // Sort timeline by date
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            data: {
                employee: {
                    _id: employee._id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    employeeId: employee.employeeId,
                    designation: employee.designation,
                    department: employee.department,
                    grade: employee.grade,
                    joiningDate: employee.joiningDate
                },
                currentCTC: employee.currentSalarySnapshotId ?
                    (snapshots.find(s => s._id.toString() === employee.currentSalarySnapshotId.toString())?.ctc || 0) : 0,
                snapshots,
                revisions,
                timeline
            }
        });

    } catch (error) {
        console.error('Error fetching salary history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary history',
            error: error.message
        });
    }
};

/**
 * GET ALL PENDING REVISIONS (for HR approval)
 * GET /api/hr/salary-revisions/pending
 */
exports.getPendingRevisions = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { type, limit = 50, skip = 0 } = req.query;

        const tenantDB = await getTenantDB(tenantId);
        const SalaryRevision = tenantDB.model('SalaryRevision');

        const query = {
            tenantId,
            status: { $in: ['DRAFT', 'PENDING_APPROVAL'] }
        };

        if (type) {
            query.type = type;
        }

        const revisions = await SalaryRevision.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .populate('employeeId', 'firstName lastName employeeId designation department')
            .populate('audit.createdBy', 'firstName lastName email');

        const total = await SalaryRevision.countDocuments(query);

        res.status(200).json({
            success: true,
            data: revisions,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: total > (parseInt(skip) + parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching pending revisions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending revisions',
            error: error.message
        });
    }
};

/**
 * GET REVISION BY ID
 * GET /api/hr/salary-revisions/:id
 */
exports.getRevisionById = async (req, res) => {
    try {
        const { id: revisionId } = req.params;
        const tenantId = req.user.tenantId;

        const tenantDB = await getTenantDB(tenantId);
        const SalaryRevision = tenantDB.model('SalaryRevision');

        const revision = await SalaryRevision.findById(revisionId)
            .populate('employeeId', 'firstName lastName employeeId designation department grade')
            .populate('approvedBy', 'firstName lastName email')
            .populate('rejectedBy', 'firstName lastName email')
            .populate('audit.createdBy', 'firstName lastName email');

        if (!revision) {
            return res.status(404).json({
                success: false,
                message: 'Salary revision not found'
            });
        }

        res.status(200).json({
            success: true,
            data: revision
        });

    } catch (error) {
        console.error('Error fetching revision:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revision',
            error: error.message
        });
    }
};

/**
 * DELETE DRAFT REVISION
 * DELETE /api/hr/salary-revisions/:id
 */
exports.deleteDraftRevision = async (req, res) => {
    try {
        const { id: revisionId } = req.params;
        const tenantId = req.user.tenantId;

        const tenantDB = await getTenantDB(tenantId);
        const SalaryRevision = tenantDB.model('SalaryRevision');

        const revision = await SalaryRevision.findById(revisionId);
        if (!revision) {
            return res.status(404).json({
                success: false,
                message: 'Salary revision not found'
            });
        }

        if (revision.status !== 'DRAFT') {
            return res.status(400).json({
                success: false,
                message: 'Can only delete DRAFT revisions'
            });
        }

        await SalaryRevision.findByIdAndDelete(revisionId);

        res.status(200).json({
            success: true,
            message: 'Draft revision deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting revision:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete revision',
            error: error.message
        });
    }
};

/**
 * Helper: Calculate breakdown from template
 */
function calculateBreakdown(template) {
    let grossA = 0;
    let grossB = 0;
    let grossC = 0;
    let totalDeductions = 0;

    // Sum earnings
    template.earnings.forEach(e => {
        grossA += e.monthlyAmount || 0;
    });

    // Sum employee deductions
    if (template.employeeDeductions) {
        template.employeeDeductions.forEach(d => {
            totalDeductions += d.monthlyAmount || 0;
        });
    }

    grossB = grossA;
    grossC = grossA;
    const takeHome = grossA - totalDeductions;

    return {
        grossA,
        grossB,
        grossC,
        takeHome,
        totalDeductions
    };
}

module.exports = exports;
