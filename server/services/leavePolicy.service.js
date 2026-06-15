const mongoose = require('mongoose');
const gradeLeavePolicyService = require('./gradeLeavePolicy.service');

/**
 * Leave Policy Service Layer
 * Handles all business logic for leave policies and balance synchronization
 */

/**
 * Calculate leave balance for an employee based on joining date and policy rules
 * Handles partial year joining cases
 */
function calculateProRatedBalance(rule, joiningDate, year, leaveCycleStartMonth = 0) {
    const { totalPerYear } = rule;

    // Calculate leave cycle start date for the year
    const cycleStart = new Date(year, leaveCycleStartMonth, 1);
    const cycleEnd = new Date(year + 1, leaveCycleStartMonth, 0);

    if (joiningDate && joiningDate > cycleEnd) {
        return 0;
    }

    // If employee joined after cycle start, calculate pro-rated balance
    if (joiningDate && joiningDate > cycleStart) {
        const monthsRemaining = Math.max(
            0,
            ((cycleEnd.getFullYear() - joiningDate.getFullYear()) * 12) +
            (cycleEnd.getMonth() - joiningDate.getMonth()) +
            1
        );
        const totalMonths = 12;
        return Math.round((Number(totalPerYear || 0) / totalMonths) * monthsRemaining);
    }

    return Number(totalPerYear || 0);
}

/**
 * Sync policy rules to employee leave balances
 * Preserves existing used/pending leaves and only updates totals
 */
async function isEmployeeEligibleForRule(employee, policy, rule) {
    // Normalize strings for comparison
    const normalize = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const empType = normalize(employee.employeeType || employee.jobType || employee.role || '');

    // Company / policy level min tenure
    const policyMinMonths = policy.minimumTenureRequiredMonths || 0;
    const ruleMinMonths = rule.minimumTenureMonths || 0;
    const requiredMonths = Math.max(policyMinMonths, ruleMinMonths);

    let monthsSinceJoin = 0;
    if (employee.joiningDate) {
        const diff = Date.now() - new Date(employee.joiningDate).getTime();
        monthsSinceJoin = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
    }

    // Check employee type applicability if defined
    if (Array.isArray(policy.applicableEmployeeTypes) && policy.applicableEmployeeTypes.length > 0) {
        const allowed = policy.applicableEmployeeTypes.map(a => normalize(a));
        if (!allowed.includes(empType)) {
            // Not eligible due to contract/type
            // No eligibleFrom date unless rule defines, so return false
            return { applicable: false, eligibleFrom: null, reason: 'Employee type not eligible' };
        }
    }

    // Check tenure-based eligibility
    if (requiredMonths > 0 && monthsSinceJoin < requiredMonths) {
        // Eligible from joiningDate + requiredMonths
        const eligibleFrom = new Date(employee.joiningDate);
        eligibleFrom.setMonth(eligibleFrom.getMonth() + requiredMonths);
        return { applicable: false, eligibleFrom, reason: 'Minimum tenure required' };
    }

    // Probation rule: if rule.disallows during probation and employee tenure < some threshold
    if (!rule.allowDuringProbation && rule.minimumTenureMonths && monthsSinceJoin < rule.minimumTenureMonths) {
        const eligibleFrom = new Date(employee.joiningDate);
        eligibleFrom.setMonth(eligibleFrom.getMonth() + rule.minimumTenureMonths);
        return { applicable: false, eligibleFrom, reason: 'Probation restriction' };
    }

    // All checks passed
    return { applicable: true, eligibleFrom: null, reason: 'Eligible' };
}

async function syncPolicyToEmployee(employee, policy, LeaveBalance, tenantId, year, leaveCycleStartMonth = 0, session = null, Grade = null) {
    if (!employee || !policy || !policy.rules || !Array.isArray(policy.rules)) {
        throw new Error('Invalid employee, policy, or rules');
    }

    // Ensure employee has policy assigned
    if (!employee.leavePolicy || employee.leavePolicy.toString() !== policy._id.toString()) {
        employee.leavePolicy = policy._id;
        if (session) await employee.save({ session }); else await employee.save();
    }

    // Get existing balances for this employee and year
    const query = LeaveBalance.find({
        employee: employee._id,
        tenant: tenantId,
        year
    });
    if (session) query.session(session);
    const existingBalances = await query;

    // Create a map of existing balances by leaveType
    const balanceMap = new Map();
    existingBalances.forEach(b => {
        balanceMap.set(b.leaveType, b);
    });

    // Defensive check: ensure rules is an array
    if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
        console.warn(`[SYNC_POLICY] Policy ${policy._id} has no valid rules array`);
        return {
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            balancesUpdated: 0,
            balancesRemoved: 0,
            warning: 'Policy has no rules'
        };
    }

    const balancePromises = [];
    let updatedCount = 0;

    const grade = await gradeLeavePolicyService.resolveEmployeeGrade({
        employee,
        Grade,
        tenantId,
        date: new Date(Number(year), 0, 1)
    });
    const effectiveRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade });

    for (const rule of effectiveRules) {
        if (!rule || typeof rule !== 'object' || !rule.leaveType || rule.totalPerYear === undefined) {
            console.warn(`[SYNC_POLICY] Skipping invalid rule:`, rule);
            continue;
        }

        const existingBalance = balanceMap.get(rule.leaveType);

        // Eligibility check
        const eligibility = await isEmployeeEligibleForRule(employee, policy, rule);

        // If not eligible, set eligibleFrom and locked flag, total = 0
        if (!eligibility.applicable) {
            if (existingBalance) {
                existingBalance.eligibleFrom = eligibility.eligibleFrom || existingBalance.eligibleFrom;
                existingBalance.locked = true;
                existingBalance.policy = policy._id;
                // keep used/pending intact
                if (session) balancePromises.push(existingBalance.save({ session })); else balancePromises.push(existingBalance.save());
                updatedCount++;
            } else {
                const newBalance = new LeaveBalance({
                    tenant: tenantId,
                    employee: employee._id,
                    policy: policy._id,
                    leaveType: rule.leaveType,
                    year,
                    total: 0,
                    used: 0,
                    pending: 0,
                    available: 0,
                    eligibleFrom: eligibility.eligibleFrom || null,
                    locked: true
                });
                if (session) balancePromises.push(newBalance.save({ session })); else balancePromises.push(newBalance.save());
                updatedCount++;
            }
            continue;
        }

        // Calculate pro-rated balance if needed
        const calculatedTotal = calculateProRatedBalance(
            rule,
            employee.joiningDate,
            year,
            leaveCycleStartMonth
        );

        if (existingBalance) {
            // Update existing balance - preserve used/pending, update total
            const used = existingBalance.used || 0;
            const pending = existingBalance.pending || 0;

            // If total changed, adjust available balance proportionally
            // But never reduce below used + pending
            const newTotal = Math.max(calculatedTotal, used + pending);

            existingBalance.total = newTotal;
            existingBalance.policy = policy._id;
            existingBalance.available = newTotal - used - pending;
            existingBalance.locked = false;
            existingBalance.eligibleFrom = null;
            if (session) balancePromises.push(existingBalance.save({ session })); else balancePromises.push(existingBalance.save());
            updatedCount++;
        } else {
            // Create new balance
            const newBalance = new LeaveBalance({
                tenant: tenantId,
                employee: employee._id,
                policy: policy._id,
                leaveType: rule.leaveType,
                year,
                total: calculatedTotal,
                used: 0,
                pending: 0,
                available: calculatedTotal,
                locked: false
            });
            if (session) balancePromises.push(newBalance.save({ session })); else balancePromises.push(newBalance.save());
            updatedCount++;
        }
    }

    // Remove balances for leave types that no longer exist in policy
    const currentLeaveTypes = new Set(
        (Array.isArray(effectiveRules) ? effectiveRules : [])
            .filter(r => r && r.leaveType)
            .map(r => r.leaveType)
    );
    const balancesToRemove = existingBalances.filter(b => !currentLeaveTypes.has(b.leaveType));

    if (balancesToRemove.length > 0) {
        const idsToRemove = balancesToRemove.map(b => b._id);
        if (session) await LeaveBalance.deleteMany({ _id: { $in: idsToRemove } }).session(session); else await LeaveBalance.deleteMany({ _id: { $in: idsToRemove } });
    }

    if (balancePromises.length > 0) await Promise.all(balancePromises);

    return {
        employeeId: employee._id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        balancesUpdated: updatedCount,
        balancesRemoved: balancesToRemove.length
    };
}

/**
 * Sync policy to all applicable employees
 * Handles All, Department, Role, and Specific employee assignments
 */
async function syncPolicyToAllEmployees(policy, models, tenantId, year, leaveCycleStartMonth = 0) {
    const { Employee, LeaveBalance, Grade } = models;
    const results = [];

    // Find all employees who should have this policy
    let employees = [];

    if (policy.applicableTo === 'All') {
        employees = await Employee.find({ tenant: tenantId, status: 'Active' });
    } else if (policy.applicableTo === 'Department' && policy.departmentIds && policy.departmentIds.length > 0) {
        const deptObjectIds = policy.departmentIds.map(id =>
            mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
        );
        employees = await Employee.find({
            departmentId: { $in: deptObjectIds },
            tenant: tenantId,
            status: 'Active'
        });
    } else if (policy.applicableTo === 'Role' && policy.roles && policy.roles.length > 0) {
        employees = await Employee.find({
            role: { $in: policy.roles },
            tenant: tenantId,
            status: 'Active'
        });
    } else if (policy.applicableTo === 'Grade') {
        const gradeIds = Array.isArray(policy.gradeIds) ? policy.gradeIds : [];
        const gradeCodes = Array.isArray(policy.gradeCodes) ? policy.gradeCodes : [];
        const gradeFilters = [
            ...(gradeIds.length ? [{ gradeId: { $in: gradeIds } }] : []),
            ...(gradeCodes.length ? [{ grade: { $in: gradeCodes } }] : []),
        ];
        employees = gradeFilters.length
            ? await Employee.find({
                tenant: tenantId,
                status: 'Active',
                $or: gradeFilters
            })
            : [];
    } else if (policy.applicableTo === 'Intern') {
        employees = await Employee.find({
            tenant: tenantId,
            status: 'Active',
            $or: [
                { employeeType: { $in: ['Intern', 'Internship'] } },
                { role: { $in: ['Intern', 'Internship'] } }
            ]
        });
    } else if (policy.applicableTo === 'Specific') {
        // For specific employees, check if policy has specificEmployeeIds field
        // or find employees already assigned to this policy
        if (policy.specificEmployeeIds && Array.isArray(policy.specificEmployeeIds) && policy.specificEmployeeIds.length > 0) {
            const empObjectIds = policy.specificEmployeeIds.map(id =>
                mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
            );
            employees = await Employee.find({
                _id: { $in: empObjectIds },
                tenant: tenantId,
                status: 'Active'
            });
        } else {
            // Fallback: find employees already assigned to this policy
            employees = await Employee.find({
                leavePolicy: policy._id,
                tenant: tenantId,
                status: 'Active'
            });
        }
    }

    // Sync policy to each employee
    for (const employee of employees) {
        try {
            const result = await syncPolicyToEmployee(
                employee,
                policy,
                LeaveBalance,
                tenantId,
                year,
                leaveCycleStartMonth,
                null,
                Grade
            );
            results.push(result);
        } catch (error) {
            console.error(`[SYNC_POLICY] Error syncing to ${employee.firstName} ${employee.lastName}:`, error);
            results.push({
                employeeId: employee._id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Recalculate balances for an employee when policy is updated
 * Uses MongoDB transaction for atomicity
 */
async function recalculateEmployeeBalances(employeeId, policyId, models, tenantId, year, leaveCycleStartMonth = 0) {
    const { Employee, LeaveBalance, LeavePolicy } = models;

    const session = await models.LeaveBalance.db.startSession();

    try {
        await session.withTransaction(async () => {
            const employee = await Employee.findById(employeeId).session(session);
            if (!employee) throw new Error('Employee not found');

            const policy = await LeavePolicy.findById(policyId).session(session);
            if (!policy || !policy.rules) throw new Error('Policy not found or has no rules');

            await syncPolicyToEmployee(
                employee,
                policy,
                LeaveBalance,
                tenantId,
                year,
                leaveCycleStartMonth,
                session,
                models.Grade
            );
        });
    } finally {
        await session.endSession();
    }
}

module.exports = {
    calculateProRatedBalance,
    syncPolicyToEmployee,
    syncPolicyToAllEmployees,
    recalculateEmployeeBalances
};
