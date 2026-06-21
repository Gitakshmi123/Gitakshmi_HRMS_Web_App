const mongoose = require('mongoose');
const gradeLeavePolicyService = require('./gradeLeavePolicy.service');

const DEFAULT_LEAVE_KEYS = ['SL', 'PL', 'CL', 'LWP', 'EL'];
const POLICY_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
};
const POLICY_PRIORITY = {
    Specific: 500,
    Grade: 450,
    Band: 430,
    JobType: 425,
    Designation: 410,
    Department: 400,
    Role: 300,
    Intern: 200,
    All: 100
};

function getFallbackLeavePolicyModel(LeavePolicy) {
    try {
        const rootDb = mongoose.connection;
        if (!rootDb || rootDb.readyState !== 1 || rootDb === LeavePolicy?.db) {
            return null;
        }

        if (rootDb.models?.LeavePolicy) {
            return rootDb.model('LeavePolicy');
        }

        return rootDb.model('LeavePolicy', require('../models/LeavePolicy'));
    } catch (error) {
        console.warn(`[LEAVE_POLICY_FALLBACK] Unable to access root LeavePolicy model: ${error.message}`);
        return null;
    }
}

function normalizeLeaveKey(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeComparableText(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeJobType(value) {
    return normalizeComparableText(value).replace(/[\s_-]+/g, '');
}

function normalizeBand(value) {
    return String(value || '')
        .replace(/^band\s*/i, '')
        .trim()
        .toLowerCase();
}

function roundLeaveValue(value) {
    return Math.max(0, Math.round(Number(value) || 0));
}

function validateJoiningDate(joiningDate) {
    const parsedDate = new Date(joiningDate);
    if (Number.isNaN(parsedDate.getTime())) {
        const error = new Error('Invalid joining date');
        error.statusCode = 400;
        throw error;
    }
    return parsedDate;
}

function getApplicableYear(joiningDate = new Date()) {
    return new Date(joiningDate).getFullYear();
}

async function getEmployeeJoiningMonthPayableDays(employee, tenantId, tenantDB, year) {
    if (!employee?.joiningDate) return 0;
    
    const doj = new Date(employee.joiningDate);
    const joinYear = doj.getFullYear();
    const joinMonth = doj.getMonth(); // 0-indexed
    
    const startOfMonth = new Date(Date.UTC(joinYear, joinMonth, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(joinYear, joinMonth + 1, 0, 23, 59, 59, 999));
    
    let AttendanceModel;
    try {
        const dbConnection = tenantDB || employee.db || employee.constructor.db || mongoose.connection;
        AttendanceModel = dbConnection.model('Attendance');
    } catch (err) {
        console.warn('[LEAVE_PRORATION] Attendance model not found on connection, using default connection:', err.message);
        try {
            AttendanceModel = mongoose.connection.model('Attendance');
        } catch (e) {
            console.error('[LEAVE_PRORATION] Failed to resolve Attendance model:', e.message);
            return 0;
        }
    }
    
    if (!AttendanceModel) return 0;
    
    const records = await AttendanceModel.find({
        tenant: tenantId || employee.tenant,
        employee: employee._id,
        date: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();
    
    const totalDaysInMonth = new Date(joinYear, joinMonth + 1, 0).getDate();
    const maxPossibleDays = totalDaysInMonth - doj.getDate() + 1;
    
    if (maxPossibleDays < 20) {
        console.log('[LEAVE_PRORATION] Employee ' + employee._id + ' joining date ' + employee.joiningDate + ' allows max ' + maxPossibleDays + ' payable days (< 20). Eligible days set to 0.');
        return 0;
    }
    
    const currentDate = new Date();
    const isCurrentOrFutureMonth = (joinYear > currentDate.getFullYear()) || 
        (joinYear === currentDate.getFullYear() && joinMonth >= currentDate.getMonth());
        
    if (isCurrentOrFutureMonth || records.length === 0) {
        console.log('[LEAVE_PRORATION] Employee ' + employee._id + ' is current/future month or has 0 records. Defaulting payableDays to 20 for initialization.');
        return 20;
    }
    
    let payableDays = 0;
    for (const record of records) {
        const isPresent = record.status === 'present';
        const isHalfDay = record.status === 'half_day';
        const isOD = record.isOnDuty === true || record.isWFH === true;
        const isCO = record.isCompOffDay === true;
        const isPH = record.status === 'holiday';
        
        if (isPresent || isOD || isCO || isPH) {
            payableDays += 1;
        } else if (isHalfDay) {
            payableDays += 0.5;
        }
    }
    
    console.log('[LEAVE_PRORATION] Employee ' + employee._id + ' joining month ' + joinYear + '-' + (joinMonth+1) + ' attendance records: ' + records.length + ', calculated payableDays: ' + payableDays);
    return payableDays;
}

function calculateProratedLeave(yearlyLeave, joiningDate, leaveKey = null, joiningPayableDays = null, year = new Date().getFullYear()) {
    if (!joiningDate) {
        return roundLeaveValue(yearlyLeave);
    }
    const validJoiningDate = validateJoiningDate(joiningDate);
    const effectiveYear = Number(year);
    const cycleStart = new Date(effectiveYear, 0, 1, 0, 0, 0, 0);
    const joinDateMidnight = new Date(validJoiningDate.getFullYear(), validJoiningDate.getMonth(), validJoiningDate.getDate(), 0, 0, 0, 0);
    
    if (joinDateMidnight < cycleStart) {
        return roundLeaveValue(yearlyLeave);
    }
    
    const isClOrSl = leaveKey && ['CL', 'SL'].includes(leaveKey.toUpperCase());
    if (isClOrSl) {
        const payableDays = joiningPayableDays !== null ? joiningPayableDays : 20;
        if (payableDays < 20) {
            console.log('[LEAVE_PRORATION] CL/SL proration resulting in 0 due to payableDays=' + payableDays + ' < 20');
            return 0;
        }
    }
    
    const joiningMonth = validJoiningDate.getMonth() + 1;
    const remainingMonths = 12 - joiningMonth + 1;
    const calculated = (Number(yearlyLeave || 0) / 12) * remainingMonths;
    return isClOrSl ? Number(calculated.toFixed(2)) : roundLeaveValue(calculated);
}

function calculateProratedLeaveForYear(yearlyLeave, joiningDate, year, leaveCycleStartMonth = 0, leaveKey = null, joiningPayableDays = null) {
    if (!joiningDate) {
        return roundLeaveValue(yearlyLeave);
    }

    const validJoiningDate = validateJoiningDate(joiningDate);
    const effectiveYear = Number(year) || new Date().getFullYear();
    const cycleStart = new Date(effectiveYear, leaveCycleStartMonth, 1, 0, 0, 0, 0);
    const cycleEnd = new Date(effectiveYear + 1, leaveCycleStartMonth, 0, 23, 59, 59, 999);
    const joinDateMidnight = new Date(validJoiningDate.getFullYear(), validJoiningDate.getMonth(), validJoiningDate.getDate(), 0, 0, 0, 0);

    if (joinDateMidnight > cycleEnd) {
        return 0;
    }

    if (joinDateMidnight < cycleStart) {
        const isClOrSl = leaveKey && ['CL', 'SL'].includes(leaveKey.toUpperCase());
        return isClOrSl ? Number(Number(yearlyLeave).toFixed(2)) : roundLeaveValue(yearlyLeave);
    }

    const isClOrSl = leaveKey && ['CL', 'SL'].includes(leaveKey.toUpperCase());
    if (isClOrSl) {
        const payableDays = joiningPayableDays !== null ? joiningPayableDays : 20;
        if (payableDays < 20) {
            console.log('[LEAVE_PRORATION] CL/SL proration resulting in 0 due to payableDays=' + payableDays + ' < 20');
            return 0;
        }
    }

    const joiningMonth = validJoiningDate.getMonth() + 1;
    const remainingMonths = 12 - joiningMonth + 1;
    const result = (Number(yearlyLeave || 0) / 12) * remainingMonths;
    const roundedResult = isClOrSl ? Number(result.toFixed(2)) : roundLeaveValue(result);
    console.log('[LEAVE_PRORATION_DIAG] leaveKey=' + leaveKey + ' yearlyLeave=' + yearlyLeave + ' remainingMonths=' + remainingMonths + ' result=' + roundedResult);
    return roundedResult;
}

function buildPolicyLeaveMap(policy, employee = null, grade = null) {
    const balance = {};

    for (const key of DEFAULT_LEAVE_KEYS) {
        balance[key] = 0;
    }

    const rules = employee
        ? gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade })
        : (Array.isArray(policy?.rules) ? policy.rules : []);
    for (const rule of rules) {
        const leaveKey = normalizeLeaveKey(rule?.leaveType);
        if (!leaveKey) {
            continue;
        }

        balance[leaveKey] = roundLeaveValue(rule.totalPerYear);
    }

    return balance;
}

function calculateEmployeeLeaveBalance(policy, joiningDate, { prorate = true, employee = null, grade = null, joiningPayableDays = null, year = new Date().getFullYear() } = {}) {
    const balance = {};
    for (const key of DEFAULT_LEAVE_KEYS) {
        balance[key] = 0;
    }

    const rules = employee
        ? gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade })
        : (Array.isArray(policy?.rules) ? policy.rules : []);

    for (const rule of rules) {
        const leaveKey = normalizeLeaveKey(rule?.leaveType);
        if (!leaveKey) continue;

        const yearlyLeave = roundLeaveValue(rule.totalPerYear);
        balance[leaveKey] = prorate && rule.prorateForNewJoiners === true
            ? calculateProratedLeave(yearlyLeave, joiningDate, leaveKey, joiningPayableDays, year)
            : (['CL', 'SL'].includes(leaveKey.toUpperCase()) ? Number(Number(rule.totalPerYear).toFixed(2)) : yearlyLeave);
    }

    return balance;
}

function calculateMonthsSinceJoin(joiningDate) {
    if (!joiningDate) {
        return 0;
    }

    return Math.max(
        0,
        Math.floor((Date.now() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
}

function evaluatePolicyRuleEligibility(employee, policy = {}, rule = {}) {
    const employeeType = String(employee?.employeeType || employee?.jobType || employee?.role || '').toLowerCase();
    const requiredMonths = Math.max(
        Number(policy?.minimumTenureRequiredMonths || 0),
        Number(rule?.minimumTenureMonths || 0)
    );
    const monthsSinceJoin = calculateMonthsSinceJoin(employee?.joiningDate);

    if (Array.isArray(policy?.applicableEmployeeTypes) && policy.applicableEmployeeTypes.length > 0) {
        const allowedTypes = policy.applicableEmployeeTypes.map((type) => String(type || '').toLowerCase());
        if (!allowedTypes.includes(employeeType)) {
            console.log(`[LEAVE_ELIGIBILITY_DIAG] Locked: employeeType mismatch. employeeType=${employeeType} allowedTypes=${allowedTypes}`);
            return { eligible: false, eligibleFrom: null };
        }
    }

    if (['Band', 'JobType'].includes(policy?.applicableTo) && Array.isArray(policy?.applicableBands) && policy.applicableBands.length > 0) {
        const empBand = String(employee?.band || '').replace(/^band\s+/i, '').trim().toLowerCase();
        const allowedBands = policy.applicableBands.map(b => String(b || '').replace(/^band\s+/i, '').trim().toLowerCase());
        if (!allowedBands.includes(empBand)) {
            console.log(`[LEAVE_ELIGIBILITY_DIAG] Locked: band mismatch. empBand=${empBand} allowedBands=${allowedBands}`);
            return { eligible: false, eligibleFrom: null };
        }
    }

    if (requiredMonths > 0 && monthsSinceJoin < requiredMonths) {
        const eligibleFrom = employee?.joiningDate ? new Date(employee.joiningDate) : null;
        if (eligibleFrom) {
            eligibleFrom.setMonth(eligibleFrom.getMonth() + requiredMonths);
        }
        console.log(`[LEAVE_ELIGIBILITY_DIAG] Locked: tenure mismatch. monthsSinceJoin=${monthsSinceJoin} requiredMonths=${requiredMonths}`);
        return { eligible: false, eligibleFrom };
    }

    return { eligible: true, eligibleFrom: null };
}

function buildExpectedPolicyBalanceSnapshot({
    policy,
    employee,
    grade = null,
    year,
    prorate = true,
    leaveCycleStartMonth = 0,
    joiningPayableDays = null
}) {
    const rules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade });
    const expectedSnapshot = {};

    for (const rule of rules) {
        const leaveKey = normalizeLeaveKey(rule?.leaveType);
        if (!leaveKey) {
            continue;
        }

        const eligibility = evaluatePolicyRuleEligibility(employee, policy, rule);
        const shouldProrateRule = prorate && rule.prorateForNewJoiners === true;
        const isClOrSl = ['CL', 'SL'].includes(leaveKey.toUpperCase());
        const total = eligibility.eligible
            ? (
                shouldProrateRule
                    ? calculateProratedLeaveForYear(rule.totalPerYear, employee?.joiningDate, year, leaveCycleStartMonth, leaveKey, joiningPayableDays)
                    : (isClOrSl ? Number(Number(rule.totalPerYear).toFixed(2)) : roundLeaveValue(rule.totalPerYear))
            )
            : 0;

        console.log(`[LEAVE_SYNC_DIAG] leaveKey=${leaveKey} total=${total} eligible=${eligibility.eligible} shouldProrate=${shouldProrateRule} ruleTotal=${rule.totalPerYear} joiningDate=${employee?.joiningDate} year=${year}`);

        expectedSnapshot[leaveKey] = {
            total,
            locked: !eligibility.eligible,
            eligibleFrom: eligibility.eligibleFrom || null
        };
    }

    return expectedSnapshot;
}

function isPolicyApplicableToEmployee(policy, employee, resolvedGrade = null) {
    if (!policy || !employee) {
        return false;
    }

    console.log(`[POLICY_MATCH] Checking policy "${policy.name}" (${policy._id}) for employee "${employee.firstName} ${employee.lastName}" (${employee._id})`);
    console.log(`[POLICY_MATCH] Policy applicableTo: ${policy.applicableTo}`);

    if (policy.applicableTo === 'All') {
        console.log(`[POLICY_MATCH] Match found (All Employees)`);
        return true;
    }

    if (policy.applicableTo === 'Department') {
        const empDepartmentId = employee.departmentId?._id || employee.departmentId;
        const empDepartmentName = normalizeComparableText(employee.departmentId?.name || employee.department);
        const match = Array.isArray(policy.departmentIds) && policy.departmentIds.some((departmentId) => {
            const policyDepartmentId = departmentId?._id || departmentId;
            const policyDepartmentName = normalizeComparableText(departmentId?.name);
            return (
                (policyDepartmentId && empDepartmentId && String(policyDepartmentId) === String(empDepartmentId)) ||
                (policyDepartmentName && empDepartmentName && policyDepartmentName === empDepartmentName)
            );
        });
        console.log(`[POLICY_MATCH] Department match: ${match} (empDepartmentId=${empDepartmentId || ''}, empDepartment=${empDepartmentName})`);
        return match;
    }

    if (policy.applicableTo === 'Role') {
        const match = Array.isArray(policy.roles) && policy.roles.some((role) => String(role).toLowerCase() === String(employee.role || '').toLowerCase());
        console.log(`[POLICY_MATCH] Role match: ${match}`);
        return match;
    }

    if (policy.applicableTo === 'Designation') {
        const empDesignation = String(employee.designation || employee.role || '').toLowerCase();
        const match = Array.isArray(policy.designations) && policy.designations.some(d => String(d).toLowerCase() === empDesignation);
        console.log(`[POLICY_MATCH] Designation match: ${match}`);
        return match;
    }

    if (policy.applicableTo === 'JobType') {
        const empJobType = normalizeJobType(employee.employeeType || employee.jobType || '');
        const empBand = normalizeBand(employee.band || '');

        const hasJobTypes = Array.isArray(policy.applicableJobTypes) && policy.applicableJobTypes.length > 0;
        const hasBands = Array.isArray(policy.applicableBands) && policy.applicableBands.length > 0;

        console.log(`[POLICY_MATCH] JobType Scope: empJobType=${empJobType}, empBand=${empBand}`);

        if (!hasJobTypes && !hasBands) {
            console.log(`[POLICY_MATCH] JobType match: false (no criteria defined)`);
            return false;
        }

        const jobTypeMatch = !hasJobTypes || policy.applicableJobTypes.some(t => normalizeJobType(t) === empJobType);
        const bandMatch = !hasBands || policy.applicableBands.some(b => normalizeBand(b) === empBand);

        console.log(`[POLICY_MATCH] JobType match: ${jobTypeMatch && bandMatch} (type=${jobTypeMatch}, band=${bandMatch})`);
        return jobTypeMatch && bandMatch;
    }

    if (policy.applicableTo === 'Band') {
        const empBand = normalizeBand(employee.band || '');
        const allowedBands = (Array.isArray(policy.applicableBands) ? policy.applicableBands : [])
            .map(normalizeBand);
        const match = allowedBands.includes(empBand);
        console.log(`[POLICY_MATCH] Band match: ${match} (emp=${empBand}, allowed=${allowedBands})`);
        return match;
    }

    if (policy.applicableTo === 'Specific') {
        const match = Array.isArray(policy.specificEmployeeIds) && policy.specificEmployeeIds.some((employeeId) => employeeId?.toString() === employee._id?.toString());
        console.log(`[POLICY_MATCH] Specific match: ${match}`);
        return match;
    }

    if (policy.applicableTo === 'Grade') {
        const match = gradeLeavePolicyService.isPolicyGradeMatch(policy, employee, resolvedGrade);
        console.log(`[POLICY_MATCH] Grade match: ${match}`);
        return match;
    }

    if (policy.applicableTo === 'Intern') {
        const match = ['intern', 'internship'].includes(String(employee.employeeType || employee.role || '').toLowerCase());
        console.log(`[POLICY_MATCH] Intern match: ${match}`);
        return match;
    }

    if (policy.applicableTo === 'Custom') {
        // Evaluate Branch Match
        if (Array.isArray(policy.branchIds) && policy.branchIds.length > 0) {
            const empBranchId = employee.branchId?._id || employee.branchId;
            if (!empBranchId || !policy.branchIds.some(id => String(id) === String(empBranchId))) {
                console.log(`[POLICY_MATCH] Custom match failed: Branch mismatch`);
                return false;
            }
        }
        // Evaluate Department Match
        if (Array.isArray(policy.departmentIds) && policy.departmentIds.length > 0) {
            const empDepartmentId = employee.departmentId?._id || employee.departmentId;
            if (!empDepartmentId || !policy.departmentIds.some(id => String(id) === String(empDepartmentId))) {
                console.log(`[POLICY_MATCH] Custom match failed: Department mismatch`);
                return false;
            }
        }
        // Evaluate Designation Match
        if (Array.isArray(policy.designations) && policy.designations.length > 0) {
            const empDesignation = String(employee.designation || employee.role || '').toLowerCase().trim();
            if (!empDesignation || !policy.designations.some(d => String(d).toLowerCase().trim() === empDesignation)) {
                console.log(`[POLICY_MATCH] Custom match failed: Designation mismatch`);
                return false;
            }
        }
        // Evaluate Grade Match
        if ((Array.isArray(policy.gradeIds) && policy.gradeIds.length > 0) || (Array.isArray(policy.gradeCodes) && policy.gradeCodes.length > 0)) {
            const empGradeValue = String(resolvedGrade?.gradeCode || resolvedGrade?.gradeValue || employee.grade || '').toLowerCase().trim();
            const empGradeId = employee.gradeId?._id || employee.gradeId || resolvedGrade?._id;
            
            const idMatch = Array.isArray(policy.gradeIds) && policy.gradeIds.length > 0 && empGradeId && policy.gradeIds.some(id => String(id) === String(empGradeId));
            const codeMatch = Array.isArray(policy.gradeCodes) && policy.gradeCodes.length > 0 && empGradeValue && policy.gradeCodes.some(c => String(c).toLowerCase().trim() === empGradeValue);
            
            if (!idMatch && !codeMatch) {
                console.log(`[POLICY_MATCH] Custom match failed: Grade mismatch`);
                return false;
            }
        }
        // Evaluate Employee Type Match
        if (Array.isArray(policy.applicableEmployeeTypes) && policy.applicableEmployeeTypes.length > 0) {
            const empType = String(employee.employeeType || '').toLowerCase().trim();
            if (!empType || !policy.applicableEmployeeTypes.some(t => String(t).toLowerCase().trim() === empType)) {
                console.log(`[POLICY_MATCH] Custom match failed: EmployeeType mismatch`);
                return false;
            }
        }
        console.log(`[POLICY_MATCH] Custom match: true (All criteria satisfied)`);
        return true;
    }

    console.log(`[POLICY_MATCH] No match found for applicableTo="${policy.applicableTo}"`);
    return false;
}

function getPolicyPriority(policy) {
    return POLICY_PRIORITY[policy?.applicableTo] || 0;
}

function sortPoliciesForEmployee(policies = []) {
    return [...policies].sort((firstPolicy, secondPolicy) => {
        const priorityDiff = getPolicyPriority(secondPolicy) - getPolicyPriority(firstPolicy);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }

        const secondUpdatedAt = new Date(secondPolicy?.updatedAt || secondPolicy?.createdAt || 0).getTime();
        const firstUpdatedAt = new Date(firstPolicy?.updatedAt || firstPolicy?.createdAt || 0).getTime();
        if (secondUpdatedAt !== firstUpdatedAt) {
            return secondUpdatedAt - firstUpdatedAt;
        }

        return String(secondPolicy?._id || '').localeCompare(String(firstPolicy?._id || ''));
    });
}

async function getActiveLeavePolicies({ LeavePolicy, tenantId }) {
    const filter = {
        tenant: tenantId,
        $or: [
            { status: POLICY_STATUS.ACTIVE },
            { status: POLICY_STATUS.ACTIVE.toLowerCase() },
            { isActive: true },
            { $and: [{ status: { $exists: false } }, { isActive: { $ne: false } }] }
        ]
    };
    const policies = await LeavePolicy.find(filter).sort({ updatedAt: -1, createdAt: -1 });
    if (policies.length > 0) {
        return policies;
    }

    const fallbackLeavePolicy = getFallbackLeavePolicyModel(LeavePolicy);
    if (!fallbackLeavePolicy) {
        return policies;
    }

    const fallbackPolicies = await fallbackLeavePolicy.find(filter).sort({ updatedAt: -1, createdAt: -1 });
    if (fallbackPolicies.length > 0) {
        console.log(`[LEAVE_POLICY_FALLBACK] Loaded ${fallbackPolicies.length} active policies from root DB for tenant ${tenantId}`);
    }
    return fallbackPolicies;
}

function isPolicyEnabled(policy) {
    if (!policy) {
        return false;
    }

    const status = String(policy.status || '').toUpperCase();
    return policy.isActive === true || status === POLICY_STATUS.ACTIVE || (!status && policy.isActive !== false);
}

async function getAssignedLeavePolicyForEmployee({ LeavePolicy, tenantId, employee }) {
    const assignedPolicyId = employee?.leavePolicy?._id || employee?.leavePolicy;
    if (!assignedPolicyId || !mongoose.Types.ObjectId.isValid(String(assignedPolicyId))) {
        return null;
    }

    let assignedPolicy = await LeavePolicy.findOne({
        _id: assignedPolicyId,
        tenant: tenantId
    });

    if (!assignedPolicy) {
        assignedPolicy = await LeavePolicy.findById(assignedPolicyId);
    }

    if (!assignedPolicy) {
        const fallbackLeavePolicy = getFallbackLeavePolicyModel(LeavePolicy);
        if (fallbackLeavePolicy) {
            assignedPolicy = await fallbackLeavePolicy.findOne({
                _id: assignedPolicyId,
                tenant: tenantId
            }) || await fallbackLeavePolicy.findById(assignedPolicyId);
            if (assignedPolicy) {
                console.log(`[LEAVE_POLICY_FALLBACK] Loaded assigned policy ${assignedPolicyId} from root DB`);
            }
        }
    }

    if (assignedPolicy && String(assignedPolicy.tenant) !== String(tenantId)) {
        console.log(`[LEAVE_SYNC] Assigned policy ${assignedPolicyId} tenant mismatch: ${assignedPolicy.tenant} vs ${tenantId}.`);
    }

    if (!assignedPolicy || !isPolicyEnabled(assignedPolicy) || !Array.isArray(assignedPolicy.rules) || assignedPolicy.rules.length === 0) {
        return null;
    }

    return assignedPolicy;
}

function selectBestPolicyForEmployee({ policies = [], employee, grade = null }) {
    if (!employee) {
        return null;
    }

    const applicablePolicies = policies.filter((policy) => isPolicyApplicableToEmployee(policy, employee, grade));
    if (applicablePolicies.length === 0) {
        return null;
    }

    return sortPoliciesForEmployee(applicablePolicies)[0] || null;
}

async function resolveLeavePolicyForEmployee({ LeavePolicy, tenantId, employee, policies = null }) {
    if (!employee) {
        return null;
    }

    const assignedPolicy = await getAssignedLeavePolicyForEmployee({ LeavePolicy, tenantId, employee });
    if (assignedPolicy) {
        return assignedPolicy;
    }

    const activePolicies = Array.isArray(policies)
        ? policies
        : await getActiveLeavePolicies({ LeavePolicy, tenantId });

    const Grade = LeavePolicy.db.model('Grade');
    const resolvedGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
        employee,
        Grade,
        tenantId,
        date: new Date()
    });

    return selectBestPolicyForEmployee({ policies: activePolicies, employee, grade: resolvedGrade });
}

async function syncEmployeeLeaveSnapshotFromDocuments({ employee, tenantId, LeaveBalance, year }) {
    const balances = await LeaveBalance.find({
        tenant: tenantId,
        employee: employee._id,
        year
    }).lean();

    const snapshot = {};
    for (const key of DEFAULT_LEAVE_KEYS) {
        snapshot[key] = 0;
    }

    for (const balance of balances) {
        const leaveKey = normalizeLeaveKey(balance.leaveType);
        snapshot[leaveKey] = roundLeaveValue(balance.available);
    }

    employee.leaveBalance = snapshot;
    employee.leaveBalanceYear = Number(year);
    await employee.save();

    return snapshot;
}

async function getActiveLeavePolicy({ LeavePolicy, tenantId }) {
    const policies = await getActiveLeavePolicies({ LeavePolicy, tenantId });
    const policy = policies[0] || null;

    if (!policy) {
        const error = new Error('No active leave policy found for this company');
        error.statusCode = 400;
        throw error;
    }

    return policy;
}

async function syncEmployeeLeaveDocuments({
    employee,
    policy,
    tenantId,
    models,
    year,
    prorate = true
}) {
    const { LeaveBalance, Grade } = models;
    const effectiveYear = Number(year) || getApplicableYear(employee.joiningDate || new Date());
    const grade = await gradeLeavePolicyService.resolveEmployeeGrade({
        employee,
        Grade,
        tenantId,
        date: new Date(effectiveYear, 0, 1)
    });
    const effectiveRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade });
    
    // Calculate joining month payable days if it is the joining year
    const isJoiningYear = employee.joiningDate && new Date(employee.joiningDate).getFullYear() === effectiveYear;
    let joiningPayableDays = null;
    if (prorate && isJoiningYear) {
        joiningPayableDays = await getEmployeeJoiningMonthPayableDays(employee, tenantId, LeaveBalance.db, effectiveYear);
    }

    const computedBalance = calculateEmployeeLeaveBalance(policy, employee.joiningDate, {
        prorate,
        employee,
        grade,
        joiningPayableDays,
        year: effectiveYear
    });
    const policyLeaveKeys = Array.from(new Set(
        effectiveRules
            .map((rule) => normalizeLeaveKey(rule?.leaveType))
            .filter(Boolean)
    ));
    const expectedSnapshot = buildExpectedPolicyBalanceSnapshot({
        policy,
        employee,
        grade,
        year: effectiveYear,
        prorate,
        joiningPayableDays
    });

    employee.leavePolicy = policy._id;
    employee.leaveBalance = Object.fromEntries(
        Object.entries(computedBalance).map(([leaveKey, yearlyBalance]) => [
            leaveKey,
            expectedSnapshot[leaveKey]?.total ?? yearlyBalance
        ])
    );
    employee.leaveBalanceYear = effectiveYear;
    await employee.save();

    const existingDocs = await LeaveBalance.find({
        tenant: tenantId,
        employee: employee._id,
        year: effectiveYear
    });

    const docsByType = new Map(existingDocs.map((doc) => [normalizeLeaveKey(doc.leaveType), doc]));

    for (const leaveKey of policyLeaveKeys) {
        const expected = expectedSnapshot[leaveKey] || { total: computedBalance[leaveKey] || 0, locked: false, eligibleFrom: null };
        const total = expected.total || 0;
        console.log(`[LEAVE_SYNC_DOCS] leaveKey=${leaveKey} total=${total} expectedTotal=${expected.total} computedTotal=${computedBalance[leaveKey]}`);
        const existing = docsByType.get(leaveKey);
        const rule = effectiveRules.find((item) => normalizeLeaveKey(item.leaveType) === leaveKey) || {};
        const expiryAt = Number(rule.expiryMonths || 0) > 0
            ? new Date(effectiveYear, 0 + Number(rule.expiryMonths), 0)
            : null;
        const maxLeaveCap = Number(rule.maxLeaveCap || 0);
        if (existing) {
            const used = existing.used || 0;
            const pending = existing.pending || 0;
            
            existing.policy = policy._id;
            existing.leaveType = leaveKey;
            
            if (existing.isOpeningManual) {
                // Keep existing.opening and accrued
                existing.total = existing.opening + (existing.accrued || 0);
            } else {
                const totalWithUsage = expected.locked ? Math.max(total, used + pending) : total;
                existing.opening = expected.locked ? Math.max(total, used + pending) : total;
                existing.total = existing.opening + (existing.accrued || 0);
                if (!expected.locked && maxLeaveCap > 0) {
                    existing.total = Math.max(used + pending, Math.min(existing.total, maxLeaveCap));
                }
            }
            
            existing.available = Math.max(0, existing.total - used - pending);
            if (!existing.isOpeningManual && !expected.locked && maxLeaveCap > 0) {
                existing.available = Math.min(existing.available, maxLeaveCap);
            }
            if (expected.locked) {
                existing.available = 0;
            }
            existing.locked = expected.locked;
            existing.eligibleFrom = expected.eligibleFrom;
            existing.expiresAt = expiryAt;
            existing.meta = {
                ...(existing.meta || {}),
                gradeId: grade?._id || null,
                gradeCode: grade?.code || '',
                quotaSource: grade ? 'grade' : 'policy'
            };
            try {
                await existing.save();
            } catch (saveErr) {
                if (saveErr.name === 'DocumentNotFoundError' || saveErr.message.includes('No document found')) {
                    console.warn(`[LEAVE_SYNC] Balance document ${existing._id} was removed concurrently. Skipping save.`);
                } else {
                    throw saveErr;
                }
            }
            docsByType.delete(leaveKey);
            continue;
        }

        const initialTotal = !expected.locked && maxLeaveCap > 0 ? Math.min(total, maxLeaveCap) : total;
        const newBalDoc = await LeaveBalance.create({
            tenant: tenantId,
            employee: employee._id,
            policy: policy._id,
            leaveType: leaveKey,
            year: effectiveYear,
            opening: initialTotal,
            accrued: 0,
            isOpeningManual: false,
            total: initialTotal,
            used: 0,
            pending: 0,
            available: expected.locked ? 0 : initialTotal,
            locked: expected.locked,
            eligibleFrom: expected.eligibleFrom,
            expiresAt: expiryAt,
            meta: {
                gradeId: grade?._id || null,
                gradeCode: grade?.code || '',
                quotaSource: grade ? 'grade' : 'policy'
            }
        });

        try {
            const LeaveLedger = LeaveBalance.db.model('LeaveLedger');
            await LeaveLedger.create({
                tenant: tenantId,
                employee: employee._id,
                leaveType: leaveKey,
                year: effectiveYear,
                actionType: 'Opening',
                days: initialTotal,
                previousBalance: 0,
                newBalance: expected.locked ? 0 : initialTotal,
                remarks: `Initial policy balance allocation`,
                date: new Date()
            });
        } catch (ledgerErr) {
            console.error('[SYNC_DOCS_LEDGER_ERROR]', ledgerErr.message);
        }
    }

    if (docsByType.size > 0) {
        await LeaveBalance.deleteMany({
            _id: { $in: Array.from(docsByType.values()).map((doc) => doc._id) }
        });
    }

    await syncEmployeeLeaveSnapshotFromDocuments({
        employee,
        tenantId,
        LeaveBalance,
        year: effectiveYear
    });

    return computedBalance;
}

async function repairZeroLeaveBalancesFromPolicy({
    employee,
    policy,
    tenantId,
    models,
    year,
    prorate = true,
    joiningPayableDays = null
}) {
    const { LeaveBalance, Grade } = models;
    if (!employee || !policy || !LeaveBalance) {
        return { repaired: 0 };
    }

    const effectiveYear = Number(year) || new Date().getFullYear();
    const grade = Grade
        ? await gradeLeavePolicyService.resolveEmployeeGrade({
            employee,
            Grade,
            tenantId,
            date: new Date(effectiveYear, 0, 1)
        })
        : null;
    const rules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade });
    let repaired = 0;

    for (const rule of rules) {
        const leaveKey = normalizeLeaveKey(rule?.leaveType);
        const ruleTotal = roundLeaveValue(rule?.totalPerYear);
        if (!leaveKey || ruleTotal <= 0) {
            continue;
        }

        const eligibility = evaluatePolicyRuleEligibility(employee, policy, rule);
        if (!eligibility.eligible) {
            continue;
        }

        const total = prorate && rule.prorateForNewJoiners === true
            ? calculateProratedLeaveForYear(ruleTotal, employee?.joiningDate, effectiveYear, 0, leaveKey, joiningPayableDays)
            : ruleTotal;
        if (total <= 0) {
            continue;
        }

        const existing = await LeaveBalance.findOne({
            tenant: tenantId,
            employee: employee._id,
            leaveType: leaveKey,
            year: effectiveYear
        });

        if (!existing) {
            await LeaveBalance.create({
                tenant: tenantId,
                employee: employee._id,
                policy: policy._id,
                leaveType: leaveKey,
                year: effectiveYear,
                total,
                used: 0,
                pending: 0,
                available: total,
                locked: false,
                meta: {
                    repairSource: 'assigned_policy_rule',
                    repairedAt: new Date()
                }
            });
            repaired += 1;
            continue;
        }

        if (!existing.locked && Number(existing.total || 0) <= 0) {
            existing.policy = policy._id;
            existing.total = Math.max(total, Number(existing.used || 0) + Number(existing.pending || 0));
            existing.available = Math.max(0, existing.total - Number(existing.used || 0) - Number(existing.pending || 0));
            existing.meta = {
                ...(existing.meta || {}),
                repairSource: 'assigned_policy_rule',
                repairedAt: new Date()
            };
            await existing.save();
            repaired += 1;
        }
    }

    if (repaired > 0) {
        await syncEmployeeLeaveSnapshotFromDocuments({
            employee,
            tenantId,
            LeaveBalance,
            year: effectiveYear
        });
    }

    return { repaired };
}

async function assignPolicyToEmployee({
    employee,
    models,
    tenantId,
    policy = null,
    year = null,
    prorate = true
}) {
    const { LeavePolicy } = models;
    const activePolicy = policy || await resolveLeavePolicyForEmployee({ LeavePolicy, tenantId, employee });
    if (!activePolicy) {
        console.warn(`[POLICY_ASSIGN] No applicable leave policy found for employee ${employee._id}. Skipping auto-assignment.`);
        return {};
    }
    return syncEmployeeLeaveDocuments({
        employee,
        policy: activePolicy,
        tenantId,
        models,
        year,
        prorate
    });
}

async function applyPolicyToExistingEmployees({
    tenantId,
    tenantDB,
    policyId = null,
    prorate = true,
    year = null
}) {
    const Employee = tenantDB.model('Employee');
    const LeavePolicy = tenantDB.model('LeavePolicy');
    const LeaveBalance = tenantDB.model('LeaveBalance');
    const Grade = tenantDB.model('Grade');
    const models = { Employee, LeavePolicy, LeaveBalance, Grade };

    const policy = policyId
        ? await LeavePolicy.findOne({ _id: policyId, tenant: tenantId })
        : await getActiveLeavePolicy({ LeavePolicy, tenantId });

    if (!policy) {
        const error = new Error('Leave policy not found');
        error.statusCode = 404;
        throw error;
    }

    const activePolicies = await getActiveLeavePolicies({ LeavePolicy, tenantId });
    const employees = await Employee.find({ tenant: tenantId });
    const results = [];

    for (const employee of employees) {
        const resolvedGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
            employee,
            Grade,
            tenantId,
            date: new Date()
        });

        const resolvedPolicy = selectBestPolicyForEmployee({ 
            policies: activePolicies, 
            employee, 
            grade: resolvedGrade 
        });

        if (!resolvedPolicy) {
            continue;
        }

        const balance = await assignPolicyToEmployee({
            employee,
            models,
            tenantId,
            policy: resolvedPolicy,
            year,
            prorate
        });

        results.push({
            employeeId: employee._id,
            employeeCode: employee.employeeId,
            policyId: resolvedPolicy._id,
            policyName: resolvedPolicy.name,
            leaveBalance: balance
        });
    }

    return { policy, employeesProcessed: results.length, results };
}

async function resetYearlyLeaveBalancesForTenant({ tenantId, tenantDB, year = new Date().getFullYear() }) {
    const Employee = tenantDB.model('Employee');
    const LeavePolicy = tenantDB.model('LeavePolicy');
    const LeaveBalance = tenantDB.model('LeaveBalance');
    const Grade = tenantDB.model('Grade');
    const policies = await getActiveLeavePolicies({ LeavePolicy, tenantId });

    const employees = await Employee.find({ tenant: tenantId });
    let resetCount = 0;

    for (const employee of employees) {
        const resolvedGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
            employee,
            Grade,
            tenantId,
            date: new Date(Number(year), 0, 1)
        });

        const policy = selectBestPolicyForEmployee({ 
            policies, 
            employee, 
            grade: resolvedGrade 
        });

        if (!policy) {
            continue;
        }

        await syncEmployeeLeaveDocuments({
            employee,
            policy,
            tenantId,
            models: { Employee, LeavePolicy, LeaveBalance, Grade },
            year,
            prorate: false
        });
        resetCount += 1;
    }

    return { policyIds: policies.map((policy) => policy._id), resetCount, year };
}

async function ensureEmployeeLeaveBalanceForYear({
    employee,
    tenantId,
    tenantDB,
    year = new Date().getFullYear(),
    policy = null
}) {
    console.log(`[LEAVE_SYNC_ENTRY] Emp: ${employee?._id}, Tenant: ${tenantId}`);
    const Employee = tenantDB.model('Employee');
    const LeavePolicy = tenantDB.model('LeavePolicy');
    const LeaveBalance = tenantDB.model('LeaveBalance');
    const Grade = tenantDB.model('Grade');
    const activePolicies = await getActiveLeavePolicies({ LeavePolicy, tenantId });
    const grade = await gradeLeavePolicyService.resolveEmployeeGrade({
        employee,
        Grade,
        tenantId,
        date: new Date(Number(year), 0, 1)
    });
    const bestMatchingPolicy = selectBestPolicyForEmployee({ policies: activePolicies, employee, grade });
    const assignedPolicy = await getAssignedLeavePolicyForEmployee({ LeavePolicy, tenantId, employee });
    let targetPolicy = policy || assignedPolicy || bestMatchingPolicy;
    
    if (targetPolicy && String(targetPolicy.tenant) !== String(tenantId)) {
        console.log(`[LEAVE_SYNC] Target policy ${targetPolicy._id} tenant mismatch: ${targetPolicy.tenant} vs ${tenantId}.`);
    }

    if (!targetPolicy) {
        const error = new Error('No applicable leave policy found for this employee');
        error.statusCode = 400;
        throw error;
    }

    if (!isPolicyApplicableToEmployee(targetPolicy, employee)) {
        const gradeForApplicability = await gradeLeavePolicyService.resolveEmployeeGrade({
            employee,
            Grade,
            tenantId,
            date: new Date()
        });

        if (!isPolicyApplicableToEmployee(targetPolicy, employee, gradeForApplicability)) {
            const reassignedPolicy = selectBestPolicyForEmployee({ policies: activePolicies, employee, grade: gradeForApplicability });
            if (reassignedPolicy) {
                targetPolicy = reassignedPolicy;
            } else {
                console.warn(`[POLICY_ENFORCEMENT] Warning: Assigned policy "${targetPolicy.name}" does not match employee scope, and no replacement was found. Continuing with existing policy to prevent crash.`);
            }
        }
    }
    const effectiveRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({
        policy: targetPolicy,
        employee,
        grade
    });
    const policyLeaveKeys = Array.from(new Set(
        effectiveRules
            .map((rule) => normalizeLeaveKey(rule?.leaveType))
            .filter(Boolean)
    ));
    const isJoiningYear = employee.joiningDate && new Date(employee.joiningDate).getFullYear() === Number(year);
    
    // Calculate joining month payable days if it is the joining year
    let joiningPayableDays = null;
    if (isJoiningYear) {
        joiningPayableDays = await getEmployeeJoiningMonthPayableDays(employee, tenantId, tenantDB, year);
    }

    const expectedSnapshot = buildExpectedPolicyBalanceSnapshot({
        policy: targetPolicy,
        employee,
        grade,
        year,
        prorate: isJoiningYear,
        joiningPayableDays
    });
    const existingBalances = await LeaveBalance.find({
        tenant: tenantId,
        employee: employee._id,
        year
    }).select('leaveType policy total locked eligibleFrom isOpeningManual').lean();
    const existingLeaveKeys = new Set(existingBalances.map((balance) => normalizeLeaveKey(balance.leaveType)));
    const hasMissingBalances = policyLeaveKeys.some((leaveKey) => !existingLeaveKeys.has(leaveKey));
    const hasExtraBalances = existingBalances.some((balance) => !policyLeaveKeys.includes(normalizeLeaveKey(balance.leaveType)));
    const hasStalePolicyBalances = existingBalances.some((balance) => {
        const leaveKey = normalizeLeaveKey(balance.leaveType);
        return policyLeaveKeys.includes(leaveKey) && String(balance.policy || '') !== String(targetPolicy._id || '');
    });
    const hasIncorrectEntitlement = existingBalances.some((balance) => {
        const leaveKey = normalizeLeaveKey(balance.leaveType);
        const expected = expectedSnapshot[leaveKey];

        if (!expected) {
            return false;
        }

        if (balance.isOpeningManual) {
            return false;
        }

        const existingEligibleFrom = balance.eligibleFrom ? new Date(balance.eligibleFrom).toISOString().slice(0, 10) : null;
        const expectedEligibleFrom = expected.eligibleFrom ? new Date(expected.eligibleFrom).toISOString().slice(0, 10) : null;

        return (
            Number(balance.total || 0) !== Number(expected.total || 0) ||
            Boolean(balance.locked) !== Boolean(expected.locked) ||
            existingEligibleFrom !== expectedEligibleFrom
        );
    });
    const needsReset =
        Number(employee.leaveBalanceYear) !== Number(year) ||
        hasMissingBalances ||
        hasExtraBalances ||
        (policyLeaveKeys.length > 0 && existingBalances.length === 0) ||
        hasStalePolicyBalances ||
        hasIncorrectEntitlement;

    if (!needsReset) {
        const snapshot = await syncEmployeeLeaveSnapshotFromDocuments({
            employee,
            tenantId,
            LeaveBalance,
            year
        });
        return {
            employee,
            policy: targetPolicy,
            leaveBalance: snapshot,
            year
        };
    }

    const refreshedBalance = await syncEmployeeLeaveDocuments({
        employee,
        policy: targetPolicy,
        tenantId,
        models: { Employee, LeavePolicy, LeaveBalance, Grade },
        year,
        prorate: isJoiningYear
    });

    return {
        employee,
        policy: targetPolicy,
        leaveBalance: refreshedBalance,
        year
    };
}

module.exports = {
    DEFAULT_LEAVE_KEYS,
    POLICY_STATUS,
    buildPolicyLeaveMap,
    calculateEmployeeLeaveBalance,
    calculateProratedLeave,
    calculateProratedLeaveForYear,
    getActiveLeavePolicies,
    getActiveLeavePolicy,
    getPolicyPriority,
    isPolicyApplicableToEmployee,
    assignPolicyToEmployee,
    applyPolicyToExistingEmployees,
    resetYearlyLeaveBalancesForTenant,
    resolveLeavePolicyForEmployee,
    selectBestPolicyForEmployee,
    sortPoliciesForEmployee,
    ensureEmployeeLeaveBalanceForYear,
    syncEmployeeLeaveSnapshotFromDocuments,
    syncEmployeeLeaveDocuments,
    repairZeroLeaveBalancesFromPolicy,
    buildExpectedPolicyBalanceSnapshot,
    evaluatePolicyRuleEligibility,
    getAssignedLeavePolicyForEmployee,
    isPolicyEnabled,
    validateJoiningDate,
    getJoiningMonthPayableDays: getEmployeeJoiningMonthPayableDays
};
