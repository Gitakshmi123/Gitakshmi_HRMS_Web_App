const mongoose = require('mongoose');
const leavePolicyService = require('../services/leavePolicy.service');
const leaveManagementService = require('../services/leaveManagement.service');
const gradeLeavePolicyService = require('../services/gradeLeavePolicy.service');
const { resolveAuthenticatedEmployee } = require('../utils/employeeAuthResolver');

// Helper to get models
const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database not initialized. Please ensure tenant middleware is running.');
    }
    try {
        return {
            LeavePolicy: req.tenantDB.model('LeavePolicy'),
            LeavePolicyCustomMapping: req.tenantDB.model('LeavePolicyCustomMapping'),
            Employee: req.tenantDB.model('Employee'),
            LeaveBalance: req.tenantDB.model('LeaveBalance'),
            Grade: req.tenantDB.model('Grade'),
            EmployeeSalarySnapshot: req.tenantDB.model('EmployeeSalarySnapshot')
        };
    } catch (err) {
        console.error('Error in getModels (leavePolicy):', err);
        throw new Error('Failed to get models from tenant database');
    }
};

async function healPolicyTenantScope(LeavePolicy, tenantId) {
    if (!tenantId) return;
    await LeavePolicy.updateMany(
        {
            $or: [
                { tenant: { $exists: false } },
                { tenant: null },
                { tenant: { $ne: tenantId } }
            ]
        },
        { $set: { tenant: tenantId } }
    );
}

async function restorePolicyFromExistingBalance({ employee, LeaveBalance, LeavePolicy, tenantId, year }) {
    if (!employee || employee.leavePolicy || !LeaveBalance || !LeavePolicy) {
        return null;
    }

    const balanceWithPolicy = await LeaveBalance.findOne({
        tenant: tenantId,
        employee: employee._id,
        year,
        policy: { $exists: true, $ne: null }
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    if (!balanceWithPolicy?.policy) {
        return null;
    }

    const policy = await LeavePolicy.findById(balanceWithPolicy.policy);
    if (!leaveManagementService.isPolicyEnabled(policy) || !Array.isArray(policy.rules) || policy.rules.length === 0) {
        return null;
    }

    employee.leavePolicy = policy._id;
    await employee.save();
    return policy;
}

exports.createPolicy = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantIdStr = req.user.tenantId || req.tenantId;
        if (!tenantIdStr) {
            return res.status(400).json({ error: "tenant_missing", message: "Tenant ID is required" });
        }
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        if (!req.tenantDB) {
            return res.status(500).json({ error: "tenant_db_unavailable", message: "Tenant database connection not available" });
        }

        const { LeavePolicy, Employee, LeaveBalance } = getModels(req);
        const { 
            name, 
            policyId,
            applicableTo = 'All', 
            rules = [], 
            departmentIds = [], 
            branchIds = [],
            roles = [], 
            gradeIds = [], 
            gradeCodes = [], 
            designations = [], 
            applicableJobTypes = [], 
            applicableBands = [], 
            applicableEmployeeTypes = [],
            specificEmployeeId, 
            status = 'ACTIVE' 
        } = req.body;

        const normalizedStatus = String(status || 'ACTIVE').toUpperCase();
        const normalizedRules = (rules || []).map((rule) => ({
            ...rule,
            leaveType: String(rule.leaveType || '').trim().toUpperCase()
        }));

        if (!name) {
            return res.status(400).json({ error: 'name_required', message: 'Policy name is required' });
        }

        // Check for duplicate policy name case-insensitively
        const duplicatePolicy = await LeavePolicy.findOne({
            tenant: tenantId,
            name: { $regex: new RegExp(`^\\s*${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }
        });
        if (duplicatePolicy) {
            return res.status(400).json({ error: 'duplicate_name', message: 'A leave policy with this name already exists.' });
        }

        if (normalizedRules.length === 0) {
            return res.status(400).json({ error: 'rules_required', message: 'At least one leave type rule is required' });
        }

        const policy = new LeavePolicy({
            tenant: tenantId,
            name,
            policyId,
            status: normalizedStatus,
            isActive: normalizedStatus === 'ACTIVE',
            applicableTo,
            departmentIds: departmentIds || [],
            branchIds: branchIds || [],
            roles,
            gradeIds,
            gradeCodes,
            designations: designations || [],
            applicableJobTypes: applicableJobTypes || [],
            applicableBands: applicableBands || [],
            applicableEmployeeTypes: applicableEmployeeTypes || [],
            specificEmployeeIds: req.body.specificEmployeeIds?.length > 0 
                ? req.body.specificEmployeeIds 
                : (specificEmployeeId ? [specificEmployeeId] : []),
            rules: normalizedRules,
            effectiveFrom: req.body.effectiveFrom || null,
            expiryDate: req.body.expiryDate || null
        });

        await policy.save();

        let applyResult = null;
        if (policy.isActive) {
            applyResult = await syncAllActivePoliciesForTenant(req, tenantId);
        }

        res.status(201).json({
            success: true,
            policy,
            appliedToExistingEmployees: applyResult?.employeesProcessed || 0,
            results: applyResult?.results || []
        });
    } catch (error) {
        console.error('createPolicy ERROR:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// Helper to dry up policy assignment
async function syncPolicyToEmployees(employees, policy, LeaveBalance, tenantId) {
    const year = new Date().getFullYear();
    for (const employee of employees) {
        employee.leavePolicy = policy._id;
        await employee.save();

        // Delete old balances for current year
        await LeaveBalance.deleteMany({ employee: employee._id, year });

        // Create new balances
        for (const rule of policy.rules) {
            await new LeaveBalance({
                tenant: tenantId,
                employee: employee._id,
                policy: policy._id,
                leaveType: rule.leaveType,
                year,
                total: rule.totalPerYear,
                used: 0,
                pending: 0,
                available: rule.totalPerYear
            }).save();
        }
    }
}

async function syncAllActivePoliciesForTenant(req, tenantId) {
    const { LeavePolicy } = getModels(req);
    const activePolicies = await leaveManagementService.getActiveLeavePolicies({ LeavePolicy, tenantId });

    if (!activePolicies.length) {
        return { employeesProcessed: 0, results: [] };
    }

    return leaveManagementService.applyPolicyToExistingEmployees({
        tenantId,
        tenantDB: req.tenantDB,
        policyId: activePolicies[0]._id,
        prorate: true
    });
}


exports.getPolicies = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            console.error("getPolicies ERROR: Missing user or tenantId in request");
            return res.status(401).json({ error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantIdStr = req.user.tenantId || req.tenantId;
        if (!tenantIdStr) {
            console.error("getPolicies ERROR: tenantId not available");
            return res.status(400).json({ error: "tenant_missing", message: "Tenant ID is required" });
        }
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeavePolicy } = getModels(req);
        await healPolicyTenantScope(LeavePolicy, tenantId);


        // Ensure "Attendance Based EL Policy" exists
        let attendancePolicy = await LeavePolicy.findOne({
            tenant: tenantId,
            name: 'Attendance Based EL Policy'
        });

        if (!attendancePolicy) {
            attendancePolicy = await LeavePolicy.create({
                tenant: tenantId,
                name: 'Attendance Based EL Policy',
                description: 'Attendance based monthly EL accrual policy',
                status: 'ACTIVE',
                isActive: true,
                applicableTo: 'All',
                leaveTypes: ['EL'],
                rules: [{
                    leaveType: 'EL',
                    totalPerYear: 21,
                    requiresApproval: true,
                    color: '#3b82f6',
                    carryForwardAllowed: true,
                    maxCarryForward: 15,
                    halfDayAllowed: true,
                    monthlyAccrual: true,
                    accrualType: 'monthly',
                    monthlyAccrualRate: 1.75,
                    accrualDependsOnAttendance: true,
                    minAttendanceDays: 20,
                    countPresent: true,
                    countOnDuty: true,
                    countCompOff: true,
                    countHoliday: true,
                    countWeeklyOff: true,
                    countPaidLeave: false,
                    accrualSlabs: [{ minAttendanceDays: 20, creditDays: 1.75 }]
                }]
            });
        }

        const policies = await LeavePolicy.find({ tenant: tenantId }).sort({ createdAt: -1 }).lean();
        res.json(policies.map((policy) => ({
            ...policy,
            isActive: policy.isActive !== undefined
                ? Boolean(policy.isActive)
                : String(policy.status || '').toUpperCase() === 'ACTIVE'
        })));
    } catch (error) {
        console.error("getPolicies ERROR:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: error.message || "Failed to fetch leave policies" });
    }
};

// EMPLOYEE: Get policies applicable to current employee with balance info
exports.getMyPolicies = async (req, res) => {
    try {
        if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: 'tenant_missing', message: 'Tenant ID is required' });
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeavePolicy, LeaveBalance } = getModels(req);
        let emp = await resolveAuthenticatedEmployee(req, {
            select: 'leavePolicy tenant joiningDate employeeType role department departmentId grade gradeId designation jobType band gender maritalStatus'
        });

        if (!emp) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const empGender = String(emp.gender || '').trim().toLowerCase();
        const empMarital = String(emp.maritalStatus || '').trim().toLowerCase();
        const isMarried = ['married', 'मेरेड', 'मेरेડ', 'विवाहित', 'vivahit'].includes(empMarital);

        // Ensure employee has a policy (auto-assign default if missing)
        try {
            const { ensureLeavePolicy } = require('../config/dbManager');
            emp = await ensureLeavePolicy(emp, req.tenantDB, tenantId) || emp;
        } catch (e) {
            console.error('[GET_MY_POLICIES] ensureLeavePolicy error:', e);
        }

        const activePolicies = await leaveManagementService.getActiveLeavePolicies({ LeavePolicy, tenantId });
        const { Grade } = getModels(req);
        const resolvedGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
            employee: emp,
            Grade,
            tenantId,
            date: new Date()
        });

        const applicablePolicies = activePolicies.filter((policy) =>
            leaveManagementService.isPolicyApplicableToEmployee(policy, emp, resolvedGrade)
        );
        const assignedPolicy = await leaveManagementService.getAssignedLeavePolicyForEmployee({ LeavePolicy, tenantId, employee: emp });
        const effectivePolicy = assignedPolicy || leaveManagementService.selectBestPolicyForEmployee({
            policies: activePolicies,
            employee: emp,
            grade: resolvedGrade
        }) ||
            await restorePolicyFromExistingBalance({
                employee: emp,
                LeaveBalance,
                LeavePolicy,
                tenantId,
                year: new Date().getFullYear()
            });

        if (effectivePolicy && !applicablePolicies.some((policy) => String(policy._id) === String(effectivePolicy._id))) {
            applicablePolicies.push(effectivePolicy);
        }

        if (!effectivePolicy && applicablePolicies.length === 0) {
            return res.json({ policies: [], effectivePolicyId: null, hasPolicies: false });
        }

        const now = new Date();
        if (effectivePolicy) {
            await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
                employee: emp,
                tenantId,
                tenantDB: req.tenantDB,
                year: now.getFullYear(),
                policy: effectivePolicy
            });

            // Calculate joining month payable days for accurate CL/SL proration
            const currentYear = now.getFullYear();
            const isJoiningYear = emp.joiningDate && new Date(emp.joiningDate).getFullYear() === currentYear;
            let joiningPayableDays = null;
            if (isJoiningYear) {
                try {
                    joiningPayableDays = await leaveManagementService.getJoiningMonthPayableDays(emp, tenantId, req.tenantDB, currentYear);
                } catch (_e) { /* non-critical */ }
            }

            await leaveManagementService.repairZeroLeaveBalancesFromPolicy({
                employee: emp,
                policy: effectivePolicy,
                tenantId,
                models: {
                    LeaveBalance,
                    Grade
                },
                year: currentYear,
                prorate: true,
                joiningPayableDays
            });
        }

        const result = [];
        const year = now.getFullYear();

        for (const policy of leaveManagementService.sortPoliciesForEmployee(applicablePolicies)) {
            // Rule-level eligibility & attached balances
            const rules = [];
            const effectiveRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({
                policy,
                employee: emp,
                grade: resolvedGrade
            });
            for (const rule of effectiveRules) {
                const lt = String(rule.leaveType || '').toUpperCase();
                if (lt === 'MATERNITY') {
                    if (empGender !== 'female' || !isMarried) continue;
                }
                if (lt === 'PATERNITY') {
                    if (empGender !== 'male' || !isMarried) continue;
                }

                // balance lookup
                const bal = await LeaveBalance.findOne({ tenant: tenantId, employee: emp._id, policy: policy._id, leaveType: rule.leaveType, year }).lean();

                // tenure check
                const monthsSinceJoin = emp.joiningDate ? Math.floor((Date.now() - new Date(emp.joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
                const minMonths = Math.max(policy.minimumTenureRequiredMonths || 0, rule.minimumTenureMonths || 0);
                const eligible = minMonths <= monthsSinceJoin && (!policy.applicableEmployeeTypes || policy.applicableEmployeeTypes.length === 0 || policy.applicableEmployeeTypes.map(a => a.toLowerCase()).includes((emp.employeeType || emp.jobType || emp.role || '').toLowerCase()));

                rules.push({
                    leaveType: rule.leaveType,
                    totalPerYear: rule.totalPerYear,
                    color: rule.color,
                    monthlyAccrual: rule.monthlyAccrual,
                    carryForwardAllowed: rule.carryForwardAllowed,
                    maxCarryForward: rule.maxCarryForward,
                    encashmentAllowed: rule.encashmentAllowed || policy.encashmentAllowed || false,
                    requiresApproval: rule.requiresApproval,
                    allowDuringProbation: rule.allowDuringProbation,
                    minimumTenureMonths: rule.minimumTenureMonths || policy.minimumTenureRequiredMonths || 0,
                    eligible: eligible,
                    eligibleFrom: bal?.eligibleFrom || null,
                    balance: bal ? {
                        total: bal.total,
                        used: bal.used,
                        pending: bal.pending,
                        available: bal.available,
                        locked: bal.locked
                    } : null
                });
            }

            result.push({
                _id: policy._id,
                name: policy.name,
                description: policy.description,
                applicableTo: policy.applicableTo,
                isEffective: effectivePolicy ? effectivePolicy._id.toString() === policy._id.toString() : false,
                rules,
                isActive: policy.isActive,
                effectiveFrom: policy.effectiveFrom,
                expiryDate: policy.expiryDate
            });
        }

        res.json({
            policies: result,
            effectivePolicyId: effectivePolicy?._id || null,
            hasPolicies: result.length > 0
        });
    } catch (err) {
        console.error('[GET_MY_POLICIES] Error:', err);
        res.status(500).json({ error: 'Failed to fetch policies' });
    }
};

exports.getPolicyById = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: 'tenant_missing' });
        const { LeavePolicy } = getModels(req);
        const policyObjectId = new mongoose.Types.ObjectId(req.params.id);
        const tenantObjectId = new mongoose.Types.ObjectId(tenantIdStr);
        const policy = await LeavePolicy.findOne({ _id: policyObjectId, tenant: tenantObjectId });
        if (!policy) return res.status(404).json({ error: 'Policy not found' });
        res.json(policy);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePolicy = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) {
            return res.status(400).json({ error: "tenant_missing", message: "Tenant ID is required" });
        }
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        if (!req.tenantDB) {
            return res.status(500).json({ error: "tenant_db_unavailable", message: "Tenant database connection not available" });
        }

        const { LeavePolicy } = getModels(req);

        // Find existing policy before update
        let existingPolicy = await LeavePolicy.findOne({ _id: req.params.id, tenant: tenantId });
        if (!existingPolicy) {
            const policyInTenantDb = await LeavePolicy.findById(req.params.id);
            if (policyInTenantDb) {
                policyInTenantDb.tenant = tenantId;
                await policyInTenantDb.save();
                existingPolicy = policyInTenantDb;
            }
        }
        if (!existingPolicy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const updateData = { ...req.body };

        if (updateData.name) {
            const duplicatePolicy = await LeavePolicy.findOne({
                tenant: tenantId,
                name: { $regex: new RegExp(`^\\s*${updateData.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') },
                _id: { $ne: req.params.id }
            });
            if (duplicatePolicy) {
                return res.status(400).json({ error: 'duplicate_name', message: 'A leave policy with this name already exists.' });
            }
        }
        if (updateData.specificEmployeeId && (!updateData.specificEmployeeIds || updateData.specificEmployeeIds.length === 0)) {
            updateData.specificEmployeeIds = [updateData.specificEmployeeId];
        }
        if (updateData.status) {
            updateData.status = String(updateData.status).toUpperCase();
            updateData.isActive = updateData.status === 'ACTIVE';
        }
        if (Array.isArray(updateData.rules)) {
            updateData.rules = updateData.rules.map((rule) => ({
                ...rule,
                leaveType: String(rule.leaveType || '').trim().toUpperCase()
            }));
        }

        // Update the policy document
        const policy = await LeavePolicy.findOneAndUpdate(
            { _id: req.params.id, tenant: tenantId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        let applyResult = null;
        if (policy.isActive || existingPolicy.isActive) {
            applyResult = await syncAllActivePoliciesForTenant(req, tenantId);
        }

        res.json({
            ...policy.toObject(),
            syncResults: applyResult ? {
                employeesUpdated: applyResult.employeesProcessed,
                details: applyResult.results
            } : {
                employeesUpdated: 0,
                details: []
            }
        });
    } catch (error) {
        console.error('[UPDATE_POLICY] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update policy' });
    }
};

exports.togglePolicyStatus = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: 'tenant_missing' });
        const { LeavePolicy } = getModels(req);
        const { id } = req.params;
        const requestedStatus = req.body.status
            ? String(req.body.status).toUpperCase()
            : (req.body.isActive ? 'ACTIVE' : 'INACTIVE');
        const policyObjectId = new mongoose.Types.ObjectId(id);
        const tenantObjectId = new mongoose.Types.ObjectId(tenantIdStr);

        const policy = await LeavePolicy.findOneAndUpdate(
            { _id: policyObjectId, tenant: tenantObjectId },
            {
                status: requestedStatus,
                isActive: requestedStatus === 'ACTIVE'
            },
            { new: true, runValidators: true }
        );

        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const applyResult = await syncAllActivePoliciesForTenant(req, tenantObjectId);
        return res.json({
            success: true,
            policy,
            appliedToExistingEmployees: applyResult.employeesProcessed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.deletePolicy = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) {
            return res.status(400).json({ error: "tenant_missing", message: "Tenant ID is required" });
        }
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);
        const policyObjectId = new mongoose.Types.ObjectId(req.params.id);

        const { LeavePolicy, Employee, LeaveBalance } = getModels(req);

        // Find the policy first
        const policy = await LeavePolicy.findOne({ _id: policyObjectId, tenant: tenantId });
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        // 1. Remove policy reference from all employees
        const employeesUpdated = await Employee.updateMany(
            { leavePolicy: policyObjectId, tenant: tenantId },
            { $unset: { leavePolicy: "" } }
        );

        // 2. Delete all leave balances associated with this policy
        const balancesDeleted = await LeaveBalance.deleteMany({
            policy: policyObjectId,
            tenant: tenantId
        });

        // 3. Delete the policy itself
        await LeavePolicy.findOneAndDelete({ _id: policyObjectId, tenant: tenantId });

        const resyncResult = await syncAllActivePoliciesForTenant(req, tenantId);

        res.json({
            message: 'Policy deleted successfully',
            employeesAffected: employeesUpdated.modifiedCount,
            balancesDeleted: balancesDeleted.deletedCount,
            reassignedEmployees: resyncResult.employeesProcessed
        });
    } catch (error) {
        console.error('Delete policy error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Admin: Force re-sync a policy to all applicable employees
exports.syncPolicy = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: 'tenant_missing' });
        const reqTenantId = new mongoose.Types.ObjectId(tenantIdStr);
        const { LeavePolicy } = getModels(req);
        const policyId = req.params.id;
        const policy = await LeavePolicy.findOne({ _id: policyId, tenant: reqTenantId });
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        const result = await leaveManagementService.applyPolicyToExistingEmployees({
            tenantId: reqTenantId,
            tenantDB: req.tenantDB,
            policyId: policy._id,
            prorate: true
        });

        res.json({ message: 'Policy synced', ...result });
    } catch (error) {
        console.error('[SYNC_POLICY] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to sync policy' });
    }
};

exports.applyPolicyToExistingEmployees = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;
        const { policyId } = req.body;
        const result = await leaveManagementService.applyPolicyToExistingEmployees({
            tenantId,
            tenantDB: req.tenantDB,
            policyId: policyId || null,
            prorate: true
        });

        return res.json({
            success: true,
            message: 'Policy applied to existing employees',
            ...result
        });
    } catch (error) {
        console.error('[APPLY_POLICY_TO_EXISTING] Error:', error);
        return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Failed to apply policy' });
    }
};

function normalizeLpaFromAnnualValue(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric > 1000 ? numeric / 100000 : numeric;
}

function getEmployeeAnnualCtc(employee = {}, snapshot = null) {
    const snapshotCtc = Number(snapshot?.ctc || snapshot?.totalCTC || snapshot?.annualCTC || snapshot?.breakdown?.ctc || 0);
    if (snapshotCtc > 0) return snapshotCtc;

    const employeeCtc = Number(employee?.annualCTC || employee?.totalCTC || employee?.ctc || employee?.salary || 0);
    if (employeeCtc > 0) {
        return employeeCtc > 1000 ? employeeCtc : employeeCtc * 100000;
    }

    return 0;
}

async function findEmployeeSalarySnapshot(EmployeeSalarySnapshot, employee) {
    if (!EmployeeSalarySnapshot || !employee?._id) return null;

    const snapshotId = employee.currentSalarySnapshotId || employee.currentSnapshotId;
    if (snapshotId && mongoose.Types.ObjectId.isValid(String(snapshotId))) {
        const byId = await EmployeeSalarySnapshot.findById(snapshotId).lean().catch(() => null);
        if (byId) return byId;
    }

    return EmployeeSalarySnapshot.findOne({ employee: employee._id })
        .sort({ effectiveFrom: -1, createdAt: -1 })
        .lean()
        .catch(() => null);
}

exports.getCustomMappings = async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const { LeavePolicyCustomMapping } = getModels(req);
        const mappings = await LeavePolicyCustomMapping.find({ tenant: tenantId }).sort({ minLpa: 1, maxLpa: 1 }).lean();
        res.json({ success: true, data: mappings });
    } catch (error) {
        console.error('[CUSTOM_MAPPING_LIST] Error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Failed to load custom mappings' });
    }
};

exports.createCustomMapping = async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const { LeavePolicyCustomMapping, Grade } = getModels(req);
        const payload = { ...req.body };
        let gradeDoc = null;

        if (payload.gradeId && mongoose.Types.ObjectId.isValid(String(payload.gradeId))) {
            gradeDoc = await Grade.findOne({ _id: payload.gradeId, tenant: tenantId }).lean();
        }

        const mapping = await LeavePolicyCustomMapping.create({
            tenant: tenantId,
            label: payload.label || `${payload.minLpa || 0}-${payload.maxLpa || 0} LPA`,
            minLpa: Number(payload.minLpa || 0),
            maxLpa: Number(payload.maxLpa || 0),
            band: String(payload.band || '').trim(),
            gradeId: gradeDoc?._id || null,
            gradeName: gradeDoc?.name || payload.gradeName || payload.gradeCode || '',
            gradeCode: gradeDoc?.code || payload.gradeCode || payload.gradeName || '',
            description: payload.description || '',
            isActive: payload.isActive !== false
        });

        res.status(201).json({ success: true, data: mapping });
    } catch (error) {
        console.error('[CUSTOM_MAPPING_CREATE] Error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Failed to create custom mapping' });
    }
};

exports.updateCustomMapping = async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const { LeavePolicyCustomMapping, Grade } = getModels(req);
        const payload = { ...req.body };
        let gradeDoc = null;

        if (payload.gradeId && mongoose.Types.ObjectId.isValid(String(payload.gradeId))) {
            gradeDoc = await Grade.findOne({ _id: payload.gradeId, tenant: tenantId }).lean();
        }

        const update = {
            label: payload.label || `${payload.minLpa || 0}-${payload.maxLpa || 0} LPA`,
            minLpa: Number(payload.minLpa || 0),
            maxLpa: Number(payload.maxLpa || 0),
            band: String(payload.band || '').trim(),
            gradeId: gradeDoc?._id || null,
            gradeName: gradeDoc?.name || payload.gradeName || payload.gradeCode || '',
            gradeCode: gradeDoc?.code || payload.gradeCode || payload.gradeName || '',
            description: payload.description || '',
            isActive: payload.isActive !== false
        };

        const mapping = await LeavePolicyCustomMapping.findOneAndUpdate(
            { _id: req.params.id, tenant: tenantId },
            update,
            { new: true, runValidators: true }
        );

        if (!mapping) return res.status(404).json({ success: false, error: 'Mapping not found' });
        res.json({ success: true, data: mapping });
    } catch (error) {
        console.error('[CUSTOM_MAPPING_UPDATE] Error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Failed to update custom mapping' });
    }
};

exports.deleteCustomMapping = async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const { LeavePolicyCustomMapping } = getModels(req);
        const deleted = await LeavePolicyCustomMapping.findOneAndDelete({ _id: req.params.id, tenant: tenantId });
        if (!deleted) return res.status(404).json({ success: false, error: 'Mapping not found' });
        res.json({ success: true, deletedId: req.params.id });
    } catch (error) {
        console.error('[CUSTOM_MAPPING_DELETE] Error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Failed to delete custom mapping' });
    }
};

exports.applyCustomMappings = async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId || req.tenantId);
        const { LeavePolicyCustomMapping, Employee, EmployeeSalarySnapshot } = getModels(req);
        const mappings = await LeavePolicyCustomMapping.find({ tenant: tenantId, isActive: true }).sort({ minLpa: 1 }).lean();
        const employees = await Employee.find({ tenant: tenantId, status: { $nin: ['deleted', 'Deleted', 'DELETED'] } });
        const results = [];

        for (const employee of employees) {
            const snapshot = await findEmployeeSalarySnapshot(EmployeeSalarySnapshot, employee);
            const annualCtc = getEmployeeAnnualCtc(employee, snapshot);
            const lpa = normalizeLpaFromAnnualValue(annualCtc);
            if (lpa <= 0) continue;

            const mapping = mappings.find((item) => lpa >= Number(item.minLpa || 0) && lpa <= Number(item.maxLpa || 0));
            if (!mapping) continue;

            const oldBand = employee.band || '';
            const oldGrade = employee.grade || '';
            const oldGradeId = employee.gradeId || null;

            employee.band = mapping.band;
            employee.gradeId = mapping.gradeId || null;
            employee.grade = mapping.gradeName || mapping.gradeCode || employee.grade;
            await employee.save();

            try {
                await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
                    employee,
                    tenantId,
                    tenantDB: req.tenantDB,
                    year: new Date().getFullYear()
                });
            } catch (syncErr) {
                console.warn(`[CUSTOM_MAPPING_APPLY] Leave sync failed for ${employee.employeeId}: ${syncErr.message}`);
            }

            results.push({
                employeeId: employee._id,
                employeeCode: employee.employeeId,
                name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
                lpa,
                mappingId: mapping._id,
                band: { from: oldBand, to: employee.band },
                grade: { from: oldGrade, to: employee.grade },
                gradeId: { from: oldGradeId, to: employee.gradeId }
            });
        }

        res.json({ success: true, employeesUpdated: results.length, results });
    } catch (error) {
        console.error('[CUSTOM_MAPPING_APPLY] Error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Failed to apply custom mappings' });
    }
};

// --- Accrual & Carry Forward Endpoints (HR actions) ---
const accrualService = require('../services/leaveAccrual.service');

exports.accrueMonthly = async (req, res) => {
    try {
        if (!req.user?.tenantId) return res.status(400).json({ error: 'tenant_missing' });
        const tenantId = req.user.tenantId;
        const { year, month } = req.body; // month 1-12
        if (!year || !month) return res.status(400).json({ error: 'year_and_month_required' });

        const result = await accrualService.runMonthlyAccrual(req.tenantDB, tenantId, year, month);
        res.json(result);
    } catch (err) {
        console.error('[ACCRUE_MONTHLY] Error:', err);
        res.status(500).json({ error: err.message || 'Failed to run monthly accrual' });
    }
};

exports.carryForward = async (req, res) => {
    try {
        if (!req.user?.tenantId) return res.status(400).json({ error: 'tenant_missing' });
        const tenantId = req.user.tenantId;
        const { fromYear, toYear } = req.body;
        if (!fromYear || !toYear) return res.status(400).json({ error: 'fromYear_toYear_required' });

        const result = await accrualService.runCarryForwardForYear(req.tenantDB, tenantId, fromYear, toYear);
        res.json(result);
    } catch (err) {
        console.error('[CARRY_FORWARD] Error:', err);
        res.status(500).json({ error: err.message || 'Failed to run carry forward' });
    }
};

// Temporary debug endpoint: create a default 'Standard Leave Policy' and assign to all employees
exports.ensureDefaultPolicyForTenant = async (req, res) => {
    try {
        const { LeavePolicy, Employee, LeaveBalance } = getModels(req);
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: 'tenant_missing' });
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        // Check if an active 'Standard Leave Policy' already exists
        let policy = await LeavePolicy.findOne({ tenant: tenantId, name: 'Standard Leave Policy', isActive: true });
        if (!policy) {
            policy = new LeavePolicy({
                tenant: tenantId,
                name: 'Standard Leave Policy',
                applicableTo: 'All',
                isActive: true,
                rules: [
                    { leaveType: 'Casual Leave', totalPerYear: 12, color: '#f59e0b' },
                    { leaveType: 'Sick Leave', totalPerYear: 7, color: '#ef4444' },
                    { leaveType: 'Privilege Leave', totalPerYear: 15, color: '#10b981' }
                ]
            });
            await policy.save();
        }

        // Assign to all active employees and create balances for current year
        const year = new Date().getFullYear();
        const employees = await Employee.find({ tenant: tenantId, status: 'Active' });
        let updatedCount = 0;
        for (const emp of employees) {
            if (!emp.leavePolicy || emp.leavePolicy.toString() !== policy._id.toString()) {
                emp.leavePolicy = policy._id;
                await emp.save();
                updatedCount++;

                // Create balances if missing
                for (const rule of policy.rules) {
                    const exists = await LeaveBalance.findOne({ tenant: tenantId, employee: emp._id, leaveType: rule.leaveType, year });
                    if (!exists) {
                        await new LeaveBalance({ tenant: tenantId, employee: emp._id, policy: policy._id, leaveType: rule.leaveType, year, total: rule.totalPerYear, used: 0, pending: 0, available: rule.totalPerYear }).save();
                    }
                }
            }
        }

        res.json({ message: 'Default policy ensured', policyId: policy._id, employeesUpdated: updatedCount });
    } catch (error) {
        console.error('[ENSURE_DEFAULT] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Assign policy to employee and initialize balances
exports.assignPolicyToEmployee = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) {
            return res.status(400).json({ error: "tenant_missing", message: "Tenant ID is required" });
        }
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { Employee, LeavePolicy, LeaveBalance, Grade } = getModels(req);
        const { employeeId, policyId } = req.body;

        if (!employeeId || !policyId) {
            return res.status(400).json({ error: 'employeeId and policyId are required' });
        }

        const employeeObjectId = new mongoose.Types.ObjectId(employeeId);
        const policyObjectId = new mongoose.Types.ObjectId(policyId);

        const employee = await Employee.findOne({ _id: employeeObjectId, tenant: tenantId });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const policy = await LeavePolicy.findOne({ _id: policyObjectId, tenant: tenantId });
        if (!policy) return res.status(404).json({ error: 'Policy not found' });

        const models = { Employee, LeavePolicy, LeaveBalance, Grade };
        await leaveManagementService.assignPolicyToEmployee({
            employee,
            tenantId,
            policy,
            year: new Date(employee.joiningDate || new Date()).getFullYear(),
            prorate: true,
            models
        });

        res.json({ message: 'Policy assigned and balances initialized', policy });
    } catch (error) {
        console.error('[ASSIGN_POLICY] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to assign policy' });
    }
};
