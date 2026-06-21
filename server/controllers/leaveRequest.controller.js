const mongoose = require('mongoose');
const notificationController = require('../controllers/notification.controller');
const leaveManagementService = require('../services/leaveManagement.service');
const gradeLeavePolicyService = require('../services/gradeLeavePolicy.service');
const workflowEngine = require('../services/workflowEngine.service');
const ShiftMasterSchema = require('../models/ShiftMaster');
const ShiftPolicySchema = require('../models/ShiftPolicy');
const { isWeeklyOffByShift } = require('../services/shiftPolicyEngine');
const { translateShiftPolicyToLegacyConfig } = require('../utils/shiftRuntime');
const { resolveAuthenticatedEmployee } = require('../utils/employeeAuthResolver');

const logLeaveLedger = async (req, { employeeId, leaveType, year, actionType, days, remarks, referenceId, referenceModel }) => {
    try {
        const { LeaveLedger, LeaveBalance } = getModels(req);
        const balanceObj = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType: leaveType.toUpperCase(), year }).lean();
        const newBalance = balanceObj ? balanceObj.available : 0;
        const previousBalance = newBalance - days;
        
        let creatorName = 'System';
        if (req && req.user) {
            if (req.user.firstName || req.user.lastName) {
                creatorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
            } else if (req.user.name) {
                creatorName = req.user.name;
            } else if (req.user.email) {
                creatorName = req.user.email;
            } else {
                creatorName = req.user.role || 'System';
            }
        }
        
        await LeaveLedger.create({
            tenant: req.tenantId,
            employee: employeeId,
            leaveType: leaveType.toUpperCase(),
            year,
            actionType,
            days,
            previousBalance,
            newBalance,
            remarks: remarks || `${actionType} leave transaction`,
            referenceId,
            referenceModel,
            date: new Date(),
            createdBy: creatorName
        });
    } catch (e) {
        console.error('[LEAVE_LEDGER_ERROR] Failed to write ledger entry:', e);
    }
};

const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database not initialized. Please ensure tenant middleware is running.');
    }
    try {
        return {
            LeaveRequest: req.tenantDB.model('LeaveRequest'),
            LeaveBalance: req.tenantDB.model('LeaveBalance'),
            LeaveLedger: req.tenantDB.model('LeaveLedger'),
            Employee: req.tenantDB.model('Employee'),
            LeavePolicy: req.tenantDB.model('LeavePolicy'),
            Notification: req.tenantDB.model('Notification'),
            Holiday: req.tenantDB.model('Holiday'),
            Attendance: req.tenantDB.model('Attendance'),
            AttendanceSettings: req.tenantDB.model('AttendanceSettings'),
            ShiftMaster: req.tenantDB.model('ShiftMaster', ShiftMasterSchema),
            ShiftPolicy: req.tenantDB.model('ShiftPolicy', ShiftPolicySchema),
        };
    } catch (err) {
        console.error('Error in getModels (leaveRequest):', err);
        throw new Error('Failed to get models from tenant database');
    }
};

const EMPTY_BALANCE_RESPONSE = {
    balances: [],
    hasLeavePolicy: false,
    leavePolicy: null
};

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

// Helper to calculate days (Sandwich Rule Active: Counts ALL days including weekends/holidays)
const calculateNetDays = async (req, startDate, endDate, employeeId = null) => {
    const { Employee, Holiday, AttendanceSettings, ShiftMaster, ShiftPolicy } = getModels(req);
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let settings = await AttendanceSettings.findOne({ tenant: req.tenantId }).lean().catch(() => null);
    if (!settings) settings = { weeklyOffDays: [0], sandwichLeave: false };

    let shiftConfig = null;
    if (employeeId) {
        const employee = await Employee.findOne({ 
            _id: employeeId, 
            $or: [{ mainCompanyId: req.tenantId }, { tenant: req.tenantId }] 
        }).select('shiftId').lean();
        if (employee?.shiftId) {
            const shiftMaster = await ShiftMaster.findOne({ _id: employee.shiftId, tenant: req.tenantId, status: 'Active' }).lean();
            if (shiftMaster) {
                const shiftPolicy = await ShiftPolicy.findOne({ shiftMasterId: shiftMaster._id, isCurrent: true }).lean();
                shiftConfig = translateShiftPolicyToLegacyConfig(shiftMaster, shiftPolicy);
            }
        }
    }

    const sandwichEnabled = !!(shiftConfig?.absentCfg?.sandwichLeaveEnabled ?? settings?.sandwichLeave);
    const includeWeekends = !!(shiftConfig?.absentCfg?.sandwichWeekendFill ?? sandwichEnabled);
    const includeHolidays = !!(shiftConfig?.absentCfg?.sandwichHolidayFill ?? sandwichEnabled);

    // Fall through to the day-by-day loop below to ensure 100% timezone-safe calculation

    const holidays = await Holiday.find({
        tenant: req.tenantId,
        date: { $lte: end },
        $or: [
            { endDate: { $exists: false } },
            { endDate: null, date: { $gte: start } },
            { endDate: { $gte: start } }
        ]
    }).lean();
    const holidaySet = new Set();
    holidays.forEach(h => {
        const s = new Date(h.date);
        s.setHours(0, 0, 0, 0);
        const e = h.endDate ? new Date(h.endDate) : s;
        e.setHours(0, 0, 0, 0);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            holidaySet.add(d.toISOString().slice(0, 10));
        }
    });

    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const current = new Date(d);
        current.setHours(0, 0, 0, 0);
        const dateStr = current.toISOString().slice(0, 10);
        const isHoliday = holidaySet.has(dateStr);
        const isWeeklyOff = shiftConfig
            ? isWeeklyOffByShift(current, shiftConfig).isWeeklyOff
            : (settings.weeklyOffDays || [0]).includes(current.getDay());

        if (isHoliday && !includeHolidays) continue;
        if (isWeeklyOff && !includeWeekends) continue;
        count++;
    }

    return count;
};

// Helper: Sync Leave to Attendance
const syncLeaveToAttendance = async (req, leaveRequest) => {
    const { Attendance, LeavePolicy, Employee } = getModels(req);
    const start = new Date(leaveRequest.startDate);
    const end = new Date(leaveRequest.endDate);

    // Get Color from Policy
    let color = '#3b82f6'; // Default
    try {
        const emp = await Employee.findById(leaveRequest.employee).select('leavePolicy');
        if (emp && emp.leavePolicy) {
            const policy = await LeavePolicy.findById(emp.leavePolicy);
            const rule = policy?.rules?.find(r => r.leaveType === leaveRequest.leaveType);
            if (rule?.color) color = rule.color;
        }
    } catch (e) {
        console.error("Color sync err:", e);
    }

    const curr = new Date(start);
    const halfDayTargetDate = leaveRequest.halfDayTarget === 'End' ? new Date(end) : new Date(start);
    halfDayTargetDate.setHours(0, 0, 0, 0);

    const fStart = new Date(start);
    const fEnd = new Date(end);
    fStart.setHours(0,0,0,0);
    fEnd.setHours(0,0,0,0);
    const isSingleDay = fStart.getTime() === fEnd.getTime();

    while (curr <= end) {
        const date = new Date(curr);
        date.setHours(0, 0, 0, 0);

        let isHalf = false;
        if (leaveRequest.isHalfDay) {
            const custom = leaveRequest.meta?.customHalfDays;
            if (custom && !isSingleDay) {
                if (date.getTime() === fStart.getTime() && custom.firstDayHalf) isHalf = true;
                if (date.getTime() === fEnd.getTime() && custom.lastDayHalf) isHalf = true;
            } else {
                isHalf = date.getTime() === halfDayTargetDate.getTime();
            }
        }

        await Attendance.findOneAndUpdate(
            { tenant: req.tenantId, employee: leaveRequest.employee, date },
            {
                status: isHalf ? 'half_day' : 'leave',
                leaveType: leaveRequest.leaveType,
                leaveColor: color,
            },
            { upsert: true, new: true }
        );
        curr.setDate(curr.getDate() + 1);
    }
};

// Helper: Calculate days between two dates (inclusive)
const calculateDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

async function refreshEmployeeLeaveSnapshot(req, employeeId, year) {
    const { Employee, LeaveBalance } = getModels(req);
    const employee = await Employee.findById(employeeId);
    if (!employee) {
        return;
    }

    await leaveManagementService.syncEmployeeLeaveSnapshotFromDocuments({
        employee,
        tenantId: req.tenantId,
        LeaveBalance,
        year
    });
}

exports.getMyBalances = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { LeaveBalance, LeavePolicy } = getModels(req);
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const isHR = ['hr', 'admin', 'psa'].includes(req.user?.role);
        let emp;
        if (isHR && req.query.employeeId) {
            const { Employee } = getModels(req);
            emp = await Employee.findById(req.query.employeeId).select('_id leavePolicy tenant joiningDate leaveBalanceYear employeeType role department departmentId grade gradeId designation jobType band gender maritalStatus');
        } else {
            emp = await resolveAuthenticatedEmployee(req, {
                select: '_id leavePolicy tenant joiningDate leaveBalanceYear employeeType role department departmentId grade gradeId designation jobType band gender maritalStatus'
            });
        }

        if (!emp) {
            console.warn(`[DEBUG_LEAVE_BALANCES] Employee could not be resolved from auth payload. Returning empty balances.`);
            return res.json(EMPTY_BALANCE_RESPONSE);
        }

        // Force cast to ObjectId to ensure query reliability
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);
        const employeeObjectId = new mongoose.Types.ObjectId(emp._id);

        // CAST IDs to ensure consistency in multi-tenant mode
        const tenantObjectId = new mongoose.Types.ObjectId(tenantIdStr);

        if (!emp) {
            console.warn(`[DEBUG_LEAVE_BALANCES] Employee completely missing from DB: ${employeeObjectId}. Returning empty balances.`);
            return res.json(EMPTY_BALANCE_RESPONSE);
        }

        const effectiveTenantId = new mongoose.Types.ObjectId(emp.tenant || tenantObjectId);


        // Ensure "Attendance Based EL Policy" exists
        let attendancePolicy = await LeavePolicy.findOne({
            tenant: effectiveTenantId,
            name: 'Attendance Based EL Policy'
        });

        // Auto-migrate existing policy: upgrade CL/SL from 6→7 and enable prorateForNewJoiners
        if (attendancePolicy) {
            let needsSave = false;
            const updatedRules = (attendancePolicy.rules || []).map(rule => {
                const lt = String(rule.leaveType || '').toUpperCase();
                if (['CL', 'SL'].includes(lt)) {
                    let changed = false;
                    const updated = { ...rule.toObject ? rule.toObject() : rule };
                    if (Number(updated.totalPerYear) !== 7) {
                        updated.totalPerYear = 7;
                        changed = true;
                    }
                    if (!updated.prorateForNewJoiners) {
                        updated.prorateForNewJoiners = true;
                        changed = true;
                    }
                    if (changed) needsSave = true;
                    return updated;
                }
                return rule;
            });
            if (needsSave) {
                attendancePolicy.rules = updatedRules;
                await attendancePolicy.save();
                console.log('[LEAVE_POLICY_MIGRATE] Upgraded Attendance Based EL Policy CL/SL to 7 days with prorateForNewJoiners');
            }
        }

        if (!attendancePolicy) {
            attendancePolicy = await LeavePolicy.create({
                tenant: effectiveTenantId,
                name: 'Attendance Based EL Policy',
                description: 'Attendance based monthly EL accrual policy',
                status: 'ACTIVE',
                isActive: true,
                applicableTo: 'All',
                leaveTypes: ['EL', 'CL', 'SL'],
                rules: [
                    {
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
                    },
                    {
                        leaveType: 'CL',
                        totalPerYear: 7,
                        requiresApproval: true,
                        color: '#10b981',
                        carryForwardAllowed: false,
                        halfDayAllowed: true,
                        prorateForNewJoiners: true,
                        minAttendanceDays: 20
                    },
                    {
                        leaveType: 'SL',
                        totalPerYear: 7,
                        requiresApproval: true,
                        color: '#f59e0b',
                        carryForwardAllowed: false,
                        halfDayAllowed: true,
                        prorateForNewJoiners: true,
                        minAttendanceDays: 20
                    }
                ]
            });
        }

        // Auto-assign to Employee if leavePolicy is null, invalid, or matches a deleted one
        const EmployeeModel = req.tenantDB.model('Employee');
        const policyExists = emp.leavePolicy ? await LeavePolicy.findById(emp.leavePolicy) : null;
        if (!emp.leavePolicy || !policyExists) {
            emp.leavePolicy = attendancePolicy._id;
            await EmployeeModel.updateOne({ _id: emp._id }, { $set: { leavePolicy: attendancePolicy._id } });
        }

        // ALWAYS cast tenantId to ObjectId for query consistency
        const activePolicy = await leaveManagementService.resolveLeavePolicyForEmployee({
            LeavePolicy,
            tenantId: effectiveTenantId,
            employee: emp
        }) || (emp.leavePolicy?.rules
            ? emp.leavePolicy
            : await LeavePolicy.findById(emp.leavePolicy));

        if (!activePolicy) {
            return res.status(400).json({
                error: "LEAVE_POLICY_NOT_FOUND",
                message: "Assigned leave policy could not be found."
            });
        }

        await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
            employee: emp,
            tenantId: effectiveTenantId,
            tenantDB: req.tenantDB,
            year: year,
            policy: activePolicy
        });

        // Calculate joining month payable days for accurate CL/SL proration
        const isJoiningYear = emp.joiningDate && new Date(emp.joiningDate).getFullYear() === year;
        let joiningPayableDays = null;
        if (isJoiningYear) {
            try {
                joiningPayableDays = await leaveManagementService.getJoiningMonthPayableDays(emp, effectiveTenantId, req.tenantDB, year);
            } catch (_e) { /* non-critical */ }
        }

        await leaveManagementService.repairZeroLeaveBalancesFromPolicy({
            employee: emp,
            policy: activePolicy,
            tenantId: effectiveTenantId,
            models: {
                LeaveBalance,
                Grade: req.tenantDB.model('Grade')
            },
            year,
            prorate: true,
            joiningPayableDays
        });

        let balances = await LeaveBalance.find({
            employee: employeeObjectId,
            tenant: effectiveTenantId,
            year: year
        });

        const currentPolicy = activePolicy;

        // Match colors from policy rules and ensure consistent formatting
        if (currentPolicy && currentPolicy.rules && Array.isArray(currentPolicy.rules)) {
            balances = balances.map(b => {
                const rule = currentPolicy.rules.find(r => r && r.leaveType === b.leaveType);
                const bObj = b.toObject ? b.toObject() : b;
                bObj.color = rule?.color || '#3b82f6';
                return bObj;
            });
        }

        // ── Maternity / Paternity eligibility filter ──────────────────────────────
        // MATERNITY: Only Married Female employees
        // PATERNITY: Only Married Male employees
        const empGender = String(emp.gender || '').trim().toLowerCase();
        const empMarital = String(emp.maritalStatus || '').trim().toLowerCase();
        const isMarried = ['married', 'मेरेड', 'मेरेડ', 'विवाहित', 'vivahit'].includes(empMarital);

        balances = balances.filter(b => {
            const lt = String(b.leaveType || '').toUpperCase();
            if (lt === 'MATERNITY') {
                // Only show for married women
                return empGender === 'female' && isMarried;
            }
            if (lt === 'PATERNITY') {
                // Only show for married men
                return empGender === 'male' && isMarried;
            }
            return true; // All other leave types shown normally
        });

        // Fetch employee's most recent Accrual ledger log for attendance details
        const LeaveLedger = req.tenantDB.model('LeaveLedger');
        const lastAccrualLedger = await LeaveLedger.findOne({
            tenant: effectiveTenantId,
            employee: employeeObjectId,
            actionType: 'Accrual'
        }).sort({ date: -1 }).lean();

        let lastMonthAccrual = null;
        if (lastAccrualLedger) {
            lastMonthAccrual = {
                eligibleDays: lastAccrualLedger.eligibleDays,
                days: lastAccrualLedger.days,
                formulaApplied: lastAccrualLedger.formulaApplied,
                date: lastAccrualLedger.date,
                remarks: lastAccrualLedger.remarks
            };
        }

        // RETURN STRUCTURED OBJECT (Crucial for frontend detection)
        res.json({
            balances,
            hasLeavePolicy: !!emp.leavePolicy,
            leavePolicy: currentPolicy ? {
                id: currentPolicy._id,
                name: currentPolicy.name,
                rules: currentPolicy.rules
            } : null,
            lastMonthAccrual
        });
    } catch (error) {
        console.error("getMyBalances Error:", error);
        res.status(500).json({ error: "Failed to fetch balances" });
    }
};

exports.applyLeave = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeaveRequest, LeaveBalance, Employee, LeavePolicy, Holiday } = getModels(req);
        const { leaveType, startDate, endDate, reason, isHalfDay, halfDayTarget, halfDaySession, employeeId: targetId } = req.body;

        // If HR or PSA, they can apply on behalf
        const isHR = ['hr', 'admin', 'psa'].includes(req.user.role);
        let actorEmployee = await resolveAuthenticatedEmployee(req, {
            select: '_id role leavePolicy tenant joiningDate leaveBalanceYear employeeType department departmentId manager grade gradeId designation jobType band gender maritalStatus children'
        });
        const actorEmployeeId = actorEmployee?._id || req.user.id;
        const employeeId = (isHR && targetId) ? targetId : actorEmployee?._id;

        if (!isHR && !employeeId) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // ENFORCE: Employee must have a leave policy before applying for leave.
        // HR/admin users can apply on behalf of employees even if the employee has no policy assigned.
        if (!isHR) {
            let applicant = actorEmployee;

            // Attempt to auto-assign a default policy if missing
            try {
                const { ensureLeavePolicy } = require('../config/dbManager');
                applicant = await ensureLeavePolicy(applicant, req.tenantDB, req.tenantId);
                actorEmployee = applicant || actorEmployee;
            } catch (e) {
                console.error('[APPLY_LEAVE] ensureLeavePolicy error:', e);
            }

            if (!applicant || !applicant.leavePolicy) {
                return res.status(403).json({ message: "NO_LEAVE_POLICY_ASSIGNED" });
            }
        }

        // Fetch effective policy and resolve rules for validations
        const start = new Date(startDate);
        const end = new Date(endDate || startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch employee doc and policy first
        const employeeDoc = isHR
            ? await Employee.findById(employeeId).select('leavePolicy leaveBalanceYear joiningDate tenant employeeType role department departmentId grade gradeId gender maritalStatus children')
            : actorEmployee;
        if (!employeeDoc?.leavePolicy && !['LOP', 'Loss of Pay', 'Leave without Pay', 'Personal Leave'].includes(leaveType)) {
            return res.status(400).json({ error: 'NO_ACTIVE_LEAVE_POLICY', message: 'No active leave policy assigned.' });
        }

        const effectivePolicy = employeeDoc?.leavePolicy ? await LeavePolicy.findById(employeeDoc.leavePolicy) : null;
        const year = new Date(start).getFullYear();

        // Resolve rule for this leave type
        let activeRule = null;
        if (effectivePolicy) {
            const Grade = req.tenantDB.model('Grade');
            const employeeGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
                employee: employeeDoc,
                Grade,
                tenantId: req.tenantId,
                date: start
            });
            const resolvedRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({
                policy: effectivePolicy,
                employee: employeeDoc,
                grade: employeeGrade
            });
            activeRule = resolvedRules.find(r => r.leaveType.toUpperCase() === leaveType.toUpperCase());
        }

        // ── Maternity / Paternity eligibility gate (backend enforcement) ─────────
        const empGenderRaw = String((isHR ? employeeDoc?.gender : actorEmployee?.gender) || '').trim().toLowerCase();
        const empMaritalRaw = String((isHR ? employeeDoc?.maritalStatus : actorEmployee?.maritalStatus) || '').trim().toLowerCase();
        const empIsMarried = ['married', 'मेरेड', 'मेरेડ', 'विवाहित', 'vivahit'].includes(empMaritalRaw);
        const leaveTypeUpper = String(leaveType || '').toUpperCase();

        if (leaveTypeUpper === 'MATERNITY') {
            if (empGenderRaw !== 'female') {
                return res.status(400).json({ error: 'GENDER_INELIGIBLE', message: 'Maternity Leave is only applicable to female employees.' });
            }
            if (!empIsMarried) {
                return res.status(400).json({ error: 'MARITAL_INELIGIBLE', message: 'Maternity Leave is only applicable to married female employees.' });
            }

            // ── Child-count based entitlement check ───────────────────────────────
            if (activeRule && activeRule.maternityChildRules && activeRule.maternityChildRules.length > 0) {
                const empDoc = isHR ? employeeDoc : actorEmployee;
                const childCount = (empDoc?.children?.length) || 0;
                // This child (the one being born) is childCount + 1
                const thisChildNumber = childCount + 1;

                // Find the matching tier
                const matchedTier = activeRule.maternityChildRules.find(tier => {
                    const from = tier.childCountFrom || 1;
                    const to = tier.childCountTo;  // null = unlimited
                    return thisChildNumber >= from && (to === null || to === undefined || thisChildNumber <= to);
                });

                if (matchedTier) {
                    const requestedDays = await calculateNetDays(req, startDate, endDate || startDate, employeeId);
                    const effectiveDays = isHalfDay ? requestedDays - 0.5 : requestedDays;
                    const tierLabel = matchedTier.label || `Child #${thisChildNumber}`;
                    const maxAllowed = matchedTier.daysEntitled || 0;

                    if (maxAllowed > 0 && effectiveDays > maxAllowed) {
                        return res.status(400).json({
                            error: 'MATERNITY_DAYS_EXCEEDED',
                            message: `For ${tierLabel}, maternity leave entitlement is ${maxAllowed} days (you requested ${effectiveDays} days).`
                        });
                    }

                    // Store matched tier info in req.body.meta for record-keeping
                    req.body.meta = {
                        ...(req.body.meta || {}),
                        maternityTier: { label: tierLabel, childNumber: thisChildNumber, daysEntitled: maxAllowed, fullyPaid: matchedTier.fullyPaid, preDeliveryDaysAllowed: matchedTier.preDeliveryDaysAllowed }
                    };
                }
            }
        }

        if (leaveTypeUpper === 'PATERNITY') {
            if (empGenderRaw !== 'male') {
                return res.status(400).json({ error: 'GENDER_INELIGIBLE', message: 'Paternity Leave is only applicable to male employees.' });
            }
            if (!empIsMarried) {
                return res.status(400).json({ error: 'MARITAL_INELIGIBLE', message: 'Paternity Leave is only applicable to married male employees.' });
            }
        }

        // 1. Dynamic Date & Policy Validations
        if (!isHR && activeRule) {
            // Check Advance Notice
            if (activeRule.advanceNoticeDays > 0) {
                if (start >= today) {
                    const diffTime = start.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays < activeRule.advanceNoticeDays) {
                        return res.status(400).json({ error: `Advance notice of ${activeRule.advanceNoticeDays} days is required for ${leaveType} leave.` });
                    }
                } else {
                    const noticeDate = new Date(today);
                    noticeDate.setDate(noticeDate.getDate() + activeRule.advanceNoticeDays);
                    if (start < noticeDate) {
                        return res.status(400).json({ error: `This leave type requires at least ${activeRule.advanceNoticeDays} days of advance notice.` });
                    }
                }
            }

            // Check Post-Facto
            if (start < today) {
                const isPostFactoAllowed = activeRule.postFactoAllowed || activeRule.allowPostFacto;
                if (!isPostFactoAllowed) {
                    return res.status(400).json({ error: "Applying for leave in the past (post-facto) is not allowed for this leave type." });
                }
                
                const limit = activeRule.maxPostFactoCount || activeRule.maxPostFactoLimit || 0;
                if (limit > 0) {
                    // Check how many post-facto leaves were applied this year
                    const startOfYear = new Date(today.getFullYear(), 0, 1);
                    const pastPostFactoLeaves = await LeaveRequest.countDocuments({
                        tenant: req.tenantId,
                        employee: employeeId,
                        leaveType: leaveType,
                        startDate: { $lt: today, $gte: startOfYear },
                        createdAt: { $gte: startOfYear } // Rough heuristic for applied post-facto
                    });
                    
                    if (pastPostFactoLeaves >= limit) {
                        return res.status(400).json({ error: `You have exceeded the maximum allowed post-facto applications (${limit}) for this leave type.` });
                    }
                }
            }
            
            // Check Medical Certificate / Attachment requirement (Frontend must send attachmentUrl)
            const daysCountObj = await calculateNetDays(req, startDate, endDate || startDate, employeeId);
            const actualRequestedDays = isHalfDay ? (daysCountObj - 0.5) : daysCountObj;
            
            const medDays = activeRule.medicalCertRequiredAfterDays || activeRule.medicalCertificateMandatoryAfterDays || 0;
            if (medDays > 0 && actualRequestedDays >= medDays) {
                if (!req.body.attachmentUrl && !req.body.attachment) {
                    return res.status(400).json({ error: `A medical certificate or attachment is strictly mandatory for leaves of ${medDays} or more days.` });
                }
            }
            
            // Check minimum leave fraction
            if (activeRule.minimumLeaveFraction > 0 && actualRequestedDays < activeRule.minimumLeaveFraction) {
                 return res.status(400).json({ error: `Minimum leave duration is ${activeRule.minimumLeaveFraction} days.` });
            }
        } else if (!isHR && start < today) {
             // Fallback for custom LOP without rules
             // return res.status(400).json({ error: "Past dates are not allowed." });
        }

        if (end < start) return res.status(400).json({ error: "End date precedes start date." });
        if (start.getDay() === 0 || end.getDay() === 0) return res.status(400).json({ error: "Leave cannot start/end on Sunday." });

        const holidayCheck = await Holiday.findOne({
            tenant: req.tenantId,
            date: { $lte: end },
            $or: [
                { endDate: { $exists: false } },
                { endDate: null, date: { $gte: start } },
                { endDate: { $gte: start } }
            ]
        });
        if (holidayCheck) return res.status(400).json({ error: `Selected date is a public holiday: ${holidayCheck.name}` });

        // 2. Overlap Check
        const overlap = await LeaveRequest.findOne({
            tenant: req.tenantId, employee: employeeId, status: { $in: ['Pending', 'Approved'] },
            $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
        });
        if (overlap) return res.status(400).json({ error: "Overlap detected with existing request." });

        // 3. Balance Validation & Paid/Unpaid Logic (Auto-Split)
        const daysCount = await calculateNetDays(req, startDate, endDate || startDate, employeeId);
        
        const fStart = new Date(startDate);
        const fEnd = new Date(endDate || startDate);
        fStart.setHours(0,0,0,0);
        fEnd.setHours(0,0,0,0);
        const isSingleDay = fStart.getTime() === fEnd.getTime();
        let sub = 0;
        if (isHalfDay) {
            const custom = req.body.meta?.customHalfDays;
            if (custom && !isSingleDay) {
                if (custom.firstDayHalf) sub += 0.5;
                if (custom.lastDayHalf) sub += 0.5;
            } else {
                sub = 0.5;
            }
        }
        const days = daysCount - sub;

        if (days <= 0) return res.status(400).json({ error: "Selected period contains no working days." });

        // Medical certificate validation
        if (!isHR && activeRule && activeRule.medicalCertRequiredAfterDays > 0 && days >= activeRule.medicalCertRequiredAfterDays) {
            if (!req.body.medicalCertUrl) {
                return res.status(400).json({ error: `Medical certificate is mandatory for ${leaveType} leave of ${activeRule.medicalCertRequiredAfterDays} days or more.` });
            }
        }


        if (employeeDoc && effectivePolicy) {
            await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
                employee: employeeDoc,
                tenantId: req.tenantId,
                tenantDB: req.tenantDB,
                year,
                policy: effectivePolicy
            });
        }

        let paidDays = 0;
        let unpaidDays = 0;
        let balance = null;

        if (['LOP', 'Loss of Pay', 'Leave without Pay', 'Personal Leave'].includes(leaveType)) {
            // Explicit LOP
            paidDays = 0;
            unpaidDays = days;
        } else {
            balance = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType, year });

            if (!balance) {
                // No balance found -> Treated as 100% Unpaid personal leave
                paidDays = 0;
                unpaidDays = days;
            } else {
                // Consume Available Balance
                paidDays = Math.min(balance.available, days);
                unpaidDays = days - paidDays;
            }
        }

        // 4. Create Request & Block Balance
        const leaveRequest = new LeaveRequest({
            tenant: req.tenantId,
            employee: employeeId,
            leaveType,
            startDate: start,
            endDate: end,
            reason,
            daysCount: days,
            paidLeaveDays: paidDays,
            unpaidLeaveDays: unpaidDays,
            status: isHR ? 'Approved' : 'Pending', 
            appliedBy: isHR ? 'HR' : 'Employee',
            hrComment: isHR ? (reason || 'Applied by HR') : undefined,
            isHalfDay: !!isHalfDay,
            halfDayTarget: isHalfDay ? (halfDayTarget || (endDate ? 'End' : 'Start')) : undefined,
            halfDaySession: isHalfDay ? halfDaySession : undefined,
            approvedBy: isHR ? actorEmployeeId : undefined,
            approvedAt: isHR ? new Date() : undefined,
            medicalCertUrl: req.body.medicalCertUrl || undefined,
            meta: req.body.meta || {}
        });

        // Update Balance
        if (balance && paidDays > 0) {
            if (leaveRequest.status === 'Approved') {
                balance.used += paidDays;
            } else {
                balance.pending += paidDays;
            }
            await balance.save();
            await refreshEmployeeLeaveSnapshot(req, employeeId, year);
        }

        await leaveRequest.save();

        if (paidDays > 0) {
            await logLeaveLedger(req, {
                employeeId,
                leaveType,
                year,
                actionType: 'Applied',
                days: -paidDays,
                remarks: `Leave applied: ${startDate} to ${endDate || startDate}`,
                referenceId: leaveRequest._id,
                referenceModel: 'LeaveRequest'
            });
        }

        let workflowStartResult = null;

        if (!isHR) {
            try {
                const Automation = req.tenantDB.model('Automation');
                const hasAutomation = await Automation.findOne({
                    tenantId: req.tenantId,
                    triggerEvent: 'LEAVE_REQUESTED',
                    isActive: true
                }).lean();

                const contextSnapshot = {
                    employeeId,
                    leaveType,
                    startDate: start,
                    endDate: end,
                    leaveDays: days,
                    daysCount: days,
                    paidLeaveDays: paidDays,
                    unpaidLeaveDays: unpaidDays,
                    departmentId: employeeDoc?.departmentId,
                    branchId: employeeDoc?.branchId,
                    divisionId: employeeDoc?.divisionId,
                    designationId: employeeDoc?.designationId,
                    gradeId: employeeDoc?.gradeId,
                    employeeType: employeeDoc?.employeeType,
                };

                if (hasAutomation) {
                    const { dispatchEvent } = require('../services/automationEngine.service');
                    console.log(`[LeaveRequestController] Found active LEAVE_REQUESTED automation for tenant: ${req.tenantId}. Dispatching...`);
                    await dispatchEvent(req.tenantId, 'LEAVE_REQUESTED', {
                        ...(leaveRequest.toObject ? leaveRequest.toObject() : leaveRequest),
                        ...contextSnapshot
                    });

                    // Refresh leave request to retrieve updated metadata from database
                    const refreshedRequest = await LeaveRequest.findById(leaveRequest._id);
                    if (refreshedRequest && refreshedRequest.meta?.workflowInstanceId) {
                        workflowStartResult = { started: true, instance: { _id: refreshedRequest.meta.workflowInstanceId } };
                        leaveRequest.meta = refreshedRequest.meta;
                    } else {
                        workflowStartResult = { started: false, reason: 'automation_executed' };
                    }
                } else {
                    workflowStartResult = await workflowEngine.startWorkflow({
                        req,
                        tenantDB: req.tenantDB,
                        tenantId: req.tenantId,
                        moduleKey: 'leave',
                        entityType: 'LeaveRequest',
                        entityId: leaveRequest._id,
                        requesterEmployeeId: employeeId,
                        requesterUserId: req.user.id,
                        contextSnapshot,
                    });

                    leaveRequest.meta = {
                        ...(leaveRequest.meta || {}),
                        workflowInstanceId: workflowStartResult?.instance?._id,
                        workflowStartStatus: workflowStartResult?.started ? 'STARTED' : workflowStartResult?.reason,
                    };
                    await leaveRequest.save();
                }
            } catch (workflowError) {
                workflowStartResult = { started: false, reason: 'start_error' };
                leaveRequest.meta = {
                    ...(leaveRequest.meta || {}),
                    workflowStartStatus: 'FAILED',
                    workflowStartError: workflowError.message,
                };
                await leaveRequest.save();
                console.error('[LEAVE_WORKFLOW_START_FAILED]', workflowError.message);
            }
        }

        // 5. Notifications
        const emp = await Employee.findById(employeeId);
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
        const typeLabel = unpaidDays > 0 ? `${leaveType} (Partial LOP)` : leaveType;

        if (isHR) {
            // Notify employee that HR applied leave
            await notificationController.createNotification(req, {
                receiverId: employeeId, receiverRole: 'employee', entityType: 'LeaveRequest', entityId: leaveRequest._id,
                title: 'Leave Applied by HR', message: `HR has applied and approved ${typeLabel} for you (${days} days)`
            });
        } else if (!workflowStartResult?.started) {
            // Standard notification to HR/Manager
            await notificationController.createNotification(req, {
                receiverId: req.tenantId, receiverRole: 'hr', entityType: 'LeaveRequest', entityId: leaveRequest._id,
                title: `New Leave Request: ${empName}`, message: `${empName} applied for ${typeLabel} (${days} days)`
            });

            if (emp && emp.manager) {
                await notificationController.createNotification(req, {
                    receiverId: emp.manager, receiverRole: 'manager', entityType: 'LeaveRequest', entityId: leaveRequest._id,
                    title: `Team Leave Request: ${empName}`, message: `${empName} applied for ${typeLabel} (${days} days)`
                });
            }
        }

        if (leaveRequest.status === 'Approved') {
            await syncLeaveToAttendance(req, leaveRequest);
        }

        res.status(201).json(leaveRequest);
    } catch (error) {
        console.error("Apply Leave Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.approveLeave = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeaveRequest, LeaveBalance, Employee, Holiday, AttendanceSettings, ShiftMaster, ShiftPolicy, LeavePolicy } = getModels(req);
        const { id } = req.params;
        const { remark, startDate, endDate, isHalfDay, halfDayTarget, halfDaySession } = req.body;
        const actorEmployee = await resolveAuthenticatedEmployee(req, { select: '_id role' });
        const actorEmployeeId = actorEmployee?._id || req.user.id;

        const request = await LeaveRequest.findOne({ _id: id, tenant: req.tenantId });
        if (!request) return res.status(404).json({ error: "Request not found" });

        // Check for Early Return Request first
        if (request.meta?.earlyReturnRequest?.status === 'Pending') {
            // AUTHORIZATION CHECK
            const targetEmp = await Employee.findOne({ 
                _id: request.employee, 
                $or: [{ mainCompanyId: req.tenantId }, { tenant: req.tenantId }] 
            });

            let userRole = (req.user.role || '').toLowerCase();
            let isAuthorized = ['hr', 'admin', 'psa', 'company_admin', 'user'].includes(userRole);

            if (!isAuthorized && userRole === 'employee') {
                const dbRole = (actorEmployee?.role || '').toLowerCase();
                if (['hr', 'admin', 'company_admin', 'user'].includes(dbRole)) {
                    isAuthorized = true;
                    userRole = dbRole;
                }
            }

            const isManager = targetEmp && targetEmp.manager && actorEmployee?._id && targetEmp.manager.toString() === actorEmployee._id.toString();

            if (!isAuthorized && !isManager) {
                return res.status(403).json({ error: "Unauthorized: Only HR or direct manager can approve leaves." });
            }

            // PROCESS EARLY RETURN APPROVAL
            const start = new Date(request.startDate);
            const originalEnd = new Date(request.endDate);
            const newEnd = new Date(request.meta.earlyReturnRequest.newEndDate);
            const employeeId = request.employee;

            start.setHours(0,0,0,0);
            originalEnd.setHours(0,0,0,0);
            newEnd.setHours(0,0,0,0);

            if (newEnd < start) {
                // Full cancellation
                // Restore used balance
                const balance = await LeaveBalance.findOne({ employee: employeeId, tenant: req.tenantId, leaveType: request.leaveType, year: start.getFullYear() });
                const paidToRefund = request.paidLeaveDays || 0;
                if (balance) {
                    balance.used = Math.max(0, (balance.used || 0) - paidToRefund);
                    if (typeof balance.available === 'number') {
                        balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
                    }
                    await balance.save();
                    await refreshEmployeeLeaveSnapshot(req, employeeId, start.getFullYear());
                }

                // Remove attendance
                await Attendance.deleteMany({
                    tenant: req.tenantId,
                    employee: employeeId,
                    date: { $gte: start, $lte: originalEnd },
                    status: { $in: ['leave', 'half_day'] }
                });

                request.status = 'Cancelled';
                request.cancelledAt = new Date();
                request.actionBy = actorEmployeeId;
                request.adminRemark = remark || 'Early Return Approved (Full Cancel)';
                request.meta.earlyReturnRequest.status = 'Approved';
                request.meta.earlyReturnRequest.approvedAt = new Date();
                request.meta.earlyReturnRequest.actionBy = actorEmployeeId;
                request.meta = { ...request.meta, earlyReturn: true, originalEndDate: originalEnd };
                request.markModified('meta');
                await request.save();

                if (paidToRefund > 0) {
                    await logLeaveLedger(req, {
                        employeeId: request.employee,
                        leaveType: request.leaveType,
                        year: start.getFullYear(),
                        actionType: 'Cancelled',
                        days: paidToRefund,
                        remarks: `Leave fully cancelled due to early return: ${remark || 'Approved'}`,
                        referenceId: request._id,
                        referenceModel: 'LeaveRequest'
                    });
                }

                // Notify employee
                await notificationController.createNotification(req, {
                    receiverId: employeeId, receiverRole: 'employee', entityType: 'LeaveRequest', entityId: request._id,
                    title: 'Early Return Approved', message: `Your early return request has been approved. Leave fully cancelled.`
                });

                return res.json({ success: true, message: "Early return (full cancellation) approved successfully", data: request });
            }

            // Partial Cancellation
            const oldPaid = request.paidLeaveDays || 0;
            
            // Calculate new days
            const newDaysCount = await calculateNetDays(req, start.toISOString(), newEnd.toISOString(), employeeId);
            const newDays = request.isHalfDay ? (newDaysCount - 0.5) : newDaysCount;
            
            if (newDays <= 0) return res.status(400).json({ error: "Selected period contains no working days." });

            let p = 0, u = 0;
            if (['LOP', 'Loss of Pay', 'Leave without Pay', 'Personal Leave'].includes(request.leaveType)) {
                u = newDays;
            } else {
                const b = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType: request.leaveType, year: start.getFullYear() });
                const trueAvailable = b ? (b.available + oldPaid) : 0;
                p = Math.min(trueAvailable, newDays);
                u = newDays - p;
            }
            const newPaid = p;
            const newUnpaid = u;

            // Refund balance
            const refundPaid = oldPaid - newPaid;
            if (refundPaid > 0) {
                const balance = await LeaveBalance.findOne({ employee: employeeId, tenant: req.tenantId, leaveType: request.leaveType, year: start.getFullYear() });
                if (balance) {
                    balance.used = Math.max(0, (balance.used || 0) - refundPaid);
                    if (typeof balance.available === 'number') {
                        balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
                    }
                    await balance.save();
                    await refreshEmployeeLeaveSnapshot(req, employeeId, start.getFullYear());
                }
            }

            // Update Request
            request.endDate = newEnd;
            request.daysCount = newDays;
            request.paidLeaveDays = newPaid;
            request.unpaidLeaveDays = newUnpaid;
            request.adminRemark = remark || 'Early Return Approved';
            request.meta.earlyReturnRequest.status = 'Approved';
            request.meta.earlyReturnRequest.approvedAt = new Date();
            request.meta.earlyReturnRequest.actionBy = actorEmployeeId;
            request.meta = { ...request.meta, earlyReturn: true, originalEndDate: originalEnd };
            request.markModified('meta');
            await request.save();

            if (refundPaid > 0) {
                await logLeaveLedger(req, {
                    employeeId: request.employee,
                    leaveType: request.leaveType,
                    year: start.getFullYear(),
                    actionType: 'Adjustment',
                    days: refundPaid,
                    remarks: `Early Return Adjustment: restored ${refundPaid} days`,
                    referenceId: request._id,
                    referenceModel: 'LeaveRequest'
                });
            }

            // Clear Attendance from newEnd + 1 up to originalEnd
            const clearStart = new Date(newEnd);
            clearStart.setDate(clearStart.getDate() + 1);
            
            await Attendance.deleteMany({
                tenant: req.tenantId,
                employee: employeeId,
                date: { $gte: clearStart, $lte: originalEnd },
                status: { $in: ['leave', 'half_day'] }
            });

            // Notify employee
            await notificationController.createNotification(req, {
                receiverId: employeeId, receiverRole: 'employee', entityType: 'LeaveRequest', entityId: request._id,
                title: 'Early Return Approved', message: `Your early return request has been approved. Leave reduced to ${newDays} days.`
            });

            return res.json({ success: true, message: "Early return approved successfully", data: request });
        }

        if (request.status !== 'Pending') return res.status(400).json({ error: `Cannot approve request with status: ${request.status}` });

        if (request.meta?.workflowInstanceId && request.meta?.workflowStartStatus === 'STARTED') {
            try {
                const instance = await workflowEngine.processWorkflowAction({
                    tenantDB: req.tenantDB,
                    tenantId: req.tenantId,
                    instanceId: request.meta.workflowInstanceId,
                    req,
                    action: 'APPROVED',
                    comment: remark || 'Approved',
                });
                return res.json({ success: true, message: "Workflow approval processed", data: instance });
            } catch (workflowError) {
                return res.status(workflowError.statusCode || 400).json({ error: workflowError.message });
            }
        }

        // 1. AUTHORIZATION CHECK
        const targetEmp = await Employee.findOne({ 
            _id: request.employee, 
            $or: [{ mainCompanyId: req.tenantId }, { tenant: req.tenantId }] 
        });

        let userRole = (req.user.role || '').toLowerCase();
        let isAuthorized = ['hr', 'admin', 'psa', 'company_admin', 'user'].includes(userRole);

        if (!isAuthorized && userRole === 'employee') {
            const dbRole = (actorEmployee?.role || '').toLowerCase();
            if (['hr', 'admin', 'company_admin', 'user'].includes(dbRole)) {
                isAuthorized = true;
                userRole = dbRole;
            }
        }

        const isManager = targetEmp && targetEmp.manager && actorEmployee?._id && targetEmp.manager.toString() === actorEmployee._id.toString();

        if (!isAuthorized && !isManager) {
            return res.status(403).json({ error: "Unauthorized: Only HR or direct manager can approve leaves." });
        }

        // 2. PROCESS LEAVE
        // If HR provides new dates/settings, recalculate everything
        const finalStartDate = startDate ? new Date(startDate) : request.startDate;
        const finalEndDate = endDate ? new Date(endDate) : request.endDate;
        const finalIsHalfDay = isHalfDay !== undefined ? !!isHalfDay : request.isHalfDay;
        const finalHalfDayTarget = halfDayTarget || request.halfDayTarget;
        const finalHalfDaySession = halfDaySession || request.halfDaySession;

        const leaveYear = new Date(finalStartDate).getFullYear();
        const balance = await LeaveBalance.findOne({
            employee: request.employee,
            tenant: req.tenantId,
            leaveType: request.leaveType,
            year: leaveYear
        });

        // Release OLD pending balance first (based on original request)
        if (balance) {
            const oldPaid = request.paidLeaveDays || 0;
            balance.pending = Math.max(0, (balance.pending || 0) - oldPaid);
        }

        // Calculate NEW days count
        const newNetDays = await calculateNetDays(req, finalStartDate, finalEndDate, request.employee);
        
        const fStart = new Date(finalStartDate);
        const fEnd = new Date(finalEndDate);
        fStart.setHours(0,0,0,0);
        fEnd.setHours(0,0,0,0);
        const isSingleDay = fStart.getTime() === fEnd.getTime();
        let sub = 0;
        if (finalIsHalfDay) {
            const custom = request.meta?.customHalfDays;
            if (custom && !isSingleDay) {
                if (custom.firstDayHalf) sub += 0.5;
                if (custom.lastDayHalf) sub += 0.5;
            } else {
                sub = 0.5;
            }
        }
        const newDaysCount = newNetDays - sub;
        
        let newPaid = 0;
        let newUnpaid = 0;

        if (['LOP', 'Loss of Pay', 'Leave without Pay', 'Personal Leave'].includes(request.leaveType)) {
            newUnpaid = newDaysCount;
        } else if (balance) {
            newPaid = Math.min(balance.available + (request.paidLeaveDays || 0), newDaysCount); // available already has pending subtracted, so add back old paid to get true available
            newUnpaid = newDaysCount - newPaid;
        } else {
            newUnpaid = newDaysCount;
        }

        // Update balance with NEW used portion
        if (balance) {
            balance.used = (balance.used || 0) + newPaid;
            // Defensive: ensure available is recalculated correctly
            balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
            await balance.save();
            await refreshEmployeeLeaveSnapshot(req, request.employee, leaveYear);
        }

        const oldPaid = request.paidLeaveDays || 0;
        request.startDate = finalStartDate;
        request.endDate = finalEndDate;
        request.isHalfDay = finalIsHalfDay;
        request.halfDayTarget = finalHalfDayTarget;
        request.halfDaySession = finalHalfDaySession;
        request.daysCount = newDaysCount;
        request.paidLeaveDays = newPaid;
        request.unpaidLeaveDays = newUnpaid;
        
        request.status = 'Approved';
        request.approvedAt = new Date();
        request.actionBy = actorEmployeeId;
        request.adminRemark = remark || 'Approved';
        await request.save();

        const diff = oldPaid - newPaid;
        if (diff !== 0) {
            await logLeaveLedger(req, {
                employeeId: request.employee,
                leaveType: request.leaveType,
                year: leaveYear,
                actionType: 'Adjustment',
                days: diff,
                remarks: `Approved with duration adjustment by HR`,
                referenceId: request._id,
                referenceModel: 'LeaveRequest'
            });
        }

        // Re-sync to attendance with new dates
        await syncLeaveToAttendance(req, request);

        try {
            const { dispatchEvent } = require('../services/automationEngine.service');
            await dispatchEvent(req.tenantId, 'LEAVE_APPROVED', request.toObject ? request.toObject() : request);
        } catch (dispatchErr) {
            console.error('[approveLeave] LEAVE_APPROVED dispatch error:', dispatchErr);
        }

        res.json({ success: true, message: "Leave approved successfully", data: request });

    } catch (err) {
        console.error("[APPROVE_LEAVE] Error:", err);
        res.status(500).json({ error: "Internal server error during leave approval" });
    }
};

exports.rejectLeave = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeaveRequest, LeaveBalance, Employee } = getModels(req);
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const actorEmployee = await resolveAuthenticatedEmployee(req, { select: '_id role' });
        const actorEmployeeId = actorEmployee?._id || req.user.id;

        const request = await LeaveRequest.findOne({ _id: id, tenant: req.tenantId });
        if (!request) return res.status(404).json({ error: "Request not found" });

        // Check for Early Return Request first
        if (request.meta?.earlyReturnRequest?.status === 'Pending') {
            // AUTHORIZATION CHECK
            const targetEmp = await Employee.findOne({ 
                _id: request.employee, 
                $or: [{ mainCompanyId: req.tenantId }, { tenant: req.tenantId }] 
            });

            let userRole = (req.user.role || '').toLowerCase();
            let isAuthorized = ['hr', 'admin', 'psa', 'company_admin', 'user'].includes(userRole);

            if (!isAuthorized && userRole === 'employee') {
                const dbRole = (actorEmployee?.role || '').toLowerCase();
                if (['hr', 'admin', 'company_admin', 'user'].includes(dbRole)) {
                    isAuthorized = true;
                    userRole = dbRole;
                }
            }

            const isManager = targetEmp && targetEmp.manager && actorEmployee?._id && targetEmp.manager.toString() === actorEmployee._id.toString();

            if (!isAuthorized && !isManager) {
                return res.status(403).json({ error: "Unauthorized: Only HR or direct manager can reject leaves." });
            }

            // PROCESS EARLY RETURN REJECTION
            request.meta.earlyReturnRequest.status = 'Rejected';
            request.meta.earlyReturnRequest.rejectedAt = new Date();
            request.meta.earlyReturnRequest.rejectionReason = rejectionReason || 'Rejected';
            request.meta.earlyReturnRequest.actionBy = actorEmployeeId;
            request.markModified('meta');
            await request.save();

            // Notify employee
            await notificationController.createNotification(req, {
                receiverId: request.employee, receiverRole: 'employee', entityType: 'LeaveRequest', entityId: request._id,
                title: 'Early Return Rejected', message: `Your early return request has been rejected: ${rejectionReason || 'No remark'}`
            });

            return res.json({ success: true, message: "Early return request rejected successfully", data: request });
        }

        if (request.status !== 'Pending') return res.status(400).json({ error: "Request is not pending" });

        if (request.meta?.workflowInstanceId && request.meta?.workflowStartStatus === 'STARTED') {
            try {
                const instance = await workflowEngine.processWorkflowAction({
                    tenantDB: req.tenantDB,
                    tenantId: req.tenantId,
                    instanceId: request.meta.workflowInstanceId,
                    req,
                    action: 'REJECTED',
                    comment: rejectionReason || 'Rejected',
                });
                return res.json({ success: true, message: "Workflow rejection processed", data: instance });
            } catch (workflowError) {
                return res.status(workflowError.statusCode || 400).json({ error: workflowError.message });
            }
        }

        // 1. AUTHORIZATION CHECK
        const targetEmp = await Employee.findOne({ 
            _id: request.employee, 
            $or: [{ mainCompanyId: req.tenantId }, { tenant: req.tenantId }] 
        });

        let userRole = (req.user.role || '').toLowerCase();
        let isAuthorized = ['hr', 'admin', 'psa', 'company_admin', 'user'].includes(userRole);

        if (!isAuthorized && userRole === 'employee') {
            const dbRole = (actorEmployee?.role || '').toLowerCase();
            if (['hr', 'admin', 'company_admin', 'user'].includes(dbRole)) {
                isAuthorized = true;
            }
        }

        const isManager = targetEmp && targetEmp.manager && actorEmployee?._id && targetEmp.manager.toString() === actorEmployee._id.toString();

        if (!isAuthorized && !isManager) {
            return res.status(403).json({ error: "Unauthorized: Only HR or direct manager can reject leaves." });
        }

        // 2. PROCESS REJECTION
        const leaveYear = new Date(request.startDate).getFullYear();
        const balance = await LeaveBalance.findOne({
            employee: request.employee,
            tenant: req.tenantId,
            leaveType: request.leaveType,
            year: leaveYear
        });

        if (balance) {
            const paid = request.paidLeaveDays || 0;
            // Release pending allocation for the paid portion
            balance.pending = Math.max(0, (balance.pending || 0) - paid);
            // Recompute available defensively
            if (typeof balance.available === 'number') {
                balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
            }
            await balance.save();
            await refreshEmployeeLeaveSnapshot(req, request.employee, leaveYear);
        }

        request.status = 'Rejected';
        request.rejectedAt = new Date();
        request.actionBy = actorEmployeeId;
        request.rejectionReason = rejectionReason || 'Rejected';
        await request.save();

        if (request.paidLeaveDays > 0) {
            await logLeaveLedger(req, {
                employeeId: request.employee,
                leaveType: request.leaveType,
                year: leaveYear,
                actionType: 'Rejected',
                days: request.paidLeaveDays,
                remarks: `Leave request rejected: ${rejectionReason || 'No remark'}`,
                referenceId: request._id,
                referenceModel: 'LeaveRequest'
            });
        }

        try {
            const { dispatchEvent } = require('../services/automationEngine.service');
            await dispatchEvent(req.tenantId, 'LEAVE_REJECTED', request.toObject ? request.toObject() : request);
        } catch (dispatchErr) {
            console.error('[rejectLeave] LEAVE_REJECTED dispatch error:', dispatchErr);
        }

        res.json({ success: true, message: "Leave rejected successfully", data: request });

    } catch (err) {
        console.error("[REJECT_LEAVE] Error:", err);
        res.status(500).json({ error: "Internal server error during leave rejection" });
    }
};

exports.getTeamLeaves = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { Employee, LeaveRequest } = getModels(req);
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const managerEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });

        if (!managerEmployee?._id) {
            return res.json({
                data: [],
                meta: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
            });
        }

        // Find employees who report to this user
        const tenantObjectId = new mongoose.Types.ObjectId(req.tenantId);
        const managerObjectId = new mongoose.Types.ObjectId(managerEmployee._id);

        const reports = await Employee.find({
            manager: managerObjectId,
            tenant: tenantObjectId
        }).select('_id');
        const reportIds = reports.map(r => r._id);

        if (reportIds.length === 0) {
            return res.json({
                data: [],
                meta: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
            });
        }

        const total = await LeaveRequest.countDocuments({
            employee: { $in: reportIds }
        });

        const requests = await LeaveRequest.find({
            employee: { $in: reportIds }
        })
            .populate('employee')
            .populate('actionBy', 'firstName lastName profilePic')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Map to include a single actionDateTime field for the frontend table
        const mappedRequests = requests.map(r => {
            const rObj = r.toObject();
            rObj.actionDateTime = r.approvedAt || r.rejectedAt || r.cancelledAt || null;
            return rObj;
        });

        res.json({
            data: mappedRequests,
            meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.getAllLeaves = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            console.error("getAllLeaves ERROR: Missing user or tenantId in request");
            return res.status(401).json({ error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantId = req.user.tenantId || req.tenantId;
        if (!tenantId || !mongoose.Types.ObjectId.isValid(String(tenantId))) {
            console.error("getAllLeaves ERROR: tenantId is missing or invalid:", tenantId);
            return res.status(400).json({ error: "tenant_invalid", message: "Valid Tenant ID is required" });
        }

        // CAST tenantId for consistent matching
        const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));

        // Ensure tenantDB is available
        if (!req.tenantDB) {
            console.warn("[getAllLeaves] WARNING: req.tenantDB missing. Attempting lazy load...");
            if (req.user && (req.user.tenantId || req.user.tenant)) {
                try {
                    const tid = req.user.tenantId || req.user.tenant;
                    const getTenantDB = require('../utils/tenantDB');
                    req.tenantDB = await getTenantDB(tid);
                    req.tenantId = tid; // Sync
                    // console.log(`[getAllLeaves] Lazy loaded tenantDB for ${tid}`);
                } catch (e) {
                    console.error("[getAllLeaves] Lazy load failed:", e);
                    return res.status(500).json({
                        success: false,
                        error: "lazy_load_failed",
                        message: `Lazy load of tenant DB failed: ${e.message}`,
                        stack: e.stack
                    });
                }
            }
            if (!req.tenantDB) {
                console.error("getAllLeaves ERROR: Tenant database connection not available");
                return res.status(500).json({
                    success: false,
                    error: "tenant_db_unavailable",
                    message: "Tenant database connection not available despite lazy load attempt.",
                    details: {
                        userTenant: req.user?.tenantId,
                        reqTenant: req.tenantId
                    }
                });
            }
        }

        const { LeaveRequest, LeaveBalance } = getModels(req);

        // Extract pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await LeaveRequest.countDocuments({});

        const leaves = await LeaveRequest.find({})
            .populate('employee')
            .populate('actionBy', 'firstName lastName profilePic')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const year = new Date().getFullYear();
        // Map to include a single actionDateTime field and employee balances for the frontend table
        const mappedLeaves = await Promise.all(leaves.map(async (l) => {
            const lObj = l.toObject();
            lObj.actionDateTime = l.approvedAt || l.rejectedAt || l.cancelledAt || null;
            if (l.employee) {
                const balances = await LeaveBalance.find({
                    employee: l.employee._id,
                    tenant: tenantObjectId,
                    year
                }).select('leaveType total used pending available').lean();
                lObj.employeeBalances = balances;
            } else {
                lObj.employeeBalances = [];
            }
            return lObj;
        }));

        res.json({
            data: mappedLeaves,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("getAllLeaves ERROR:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: error.message || "Failed to fetch leave requests" });
    }
};

exports.getApprovedDates = async (req, res) => {
    try {
        const { LeaveRequest } = getModels(req);
        const currentEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!currentEmployee?._id) {
            return res.json([]);
        }
        const employeeId = new mongoose.Types.ObjectId(currentEmployee._id);
        const tenantId = new mongoose.Types.ObjectId(req.tenantId);

        const approvedLeaves = await LeaveRequest.find({
            employee: employeeId,
            tenant: tenantId,
            status: 'Approved'
        }).select('startDate endDate');

        // Normalize format: [{ startDate, endDate }]
        const ranges = approvedLeaves.map(l => ({
            startDate: l.startDate,
            endDate: l.endDate
        }));

        res.json(ranges);
    } catch (error) {
        console.error("[getApprovedDates] Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getMyLeaves = async (req, res) => {
    try {
        const { LeaveRequest } = getModels(req);
        const currentEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!currentEmployee?._id) {
            return res.json([]);
        }
        const employeeId = currentEmployee._id;
        const employeeObjectId = new mongoose.Types.ObjectId(employeeId);

        const leaves = await LeaveRequest.find({
            employee: employeeObjectId
        })
            .populate('actionBy', 'firstName lastName profilePic')
            .sort({ createdAt: -1 });

        const mappedLeaves = leaves.map(l => {
            const lObj = l.toObject();
            lObj.actionDateTime = l.approvedAt || l.rejectedAt || l.cancelledAt || null;
            return lObj;
        });

        res.json(mappedLeaves);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.editLeave = async (req, res) => {
    try {
        const { LeaveRequest, LeaveBalance } = getModels(req);
        const { id } = req.params;
        const { leaveType, startDate, endDate, reason, isHalfDay, halfDayTarget, halfDaySession } = req.body;
        const currentEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!currentEmployee?._id) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const employeeId = currentEmployee._id;

        const request = await LeaveRequest.findOne({ _id: id, employee: employeeId, tenant: req.tenantId });
        if (!request) return res.status(404).json({ error: "Request not found" });

        if (request.status !== 'Pending') {
            return res.status(400).json({ error: `Cannot edit leave in ${request.status} status. Only Pending requests can be edited.` });
        }

        const start = new Date(startDate);
        const end = new Date(endDate || startDate);
        const oldDays = request.daysCount;
        const oldPaid = request.paidLeaveDays || 0;
        const oldType = request.leaveType;

        const Employee = req.tenantDB.model('Employee');
        const LeavePolicy = req.tenantDB.model('LeavePolicy');

        // Fetch employee doc and policy first
        const employeeDoc = await Employee.findById(employeeId).select('leavePolicy leaveBalanceYear joiningDate tenant employeeType role department departmentId grade gradeId');
        if (!employeeDoc?.leavePolicy && !['LOP', 'Loss of Pay', 'Leave without Pay', 'Personal Leave'].includes(leaveType)) {
            return res.status(400).json({ error: 'NO_ACTIVE_LEAVE_POLICY', message: 'No active leave policy assigned.' });
        }

        const effectivePolicy = employeeDoc?.leavePolicy ? await LeavePolicy.findById(employeeDoc.leavePolicy) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const year = start.getFullYear();

        // Resolve rule for this leave type
        let activeRule = null;
        if (effectivePolicy) {
            const Grade = req.tenantDB.model('Grade');
            const employeeGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
                employee: employeeDoc,
                Grade,
                tenantId: req.tenantId,
                date: start
            });
            const resolvedRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({
                policy: effectivePolicy,
                employee: employeeDoc,
                grade: employeeGrade
            });
            activeRule = resolvedRules.find(r => r.leaveType.toUpperCase() === leaveType.toUpperCase());
        }

        // 1. Notice Days / Post Facto Validations
        if (activeRule) {
            if (start >= today) {
                const diffTime = start.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < activeRule.advanceNoticeDays) {
                    return res.status(400).json({ error: `Advance notice of ${activeRule.advanceNoticeDays} days is required for ${leaveType} leave.` });
                }
            } else {
                // Past date
                if (!activeRule.postFactoAllowed) {
                    return res.status(400).json({ error: "Past dates are not allowed for this leave type." });
                }
                if (activeRule.maxPostFactoCount > 0) {
                    const yearStart = new Date(year, 0, 1);
                    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
                    const postFactoCount = await LeaveRequest.countDocuments({
                        _id: { $ne: id },
                        tenant: req.tenantId,
                        employee: employeeId,
                        leaveType,
                        $expr: { $lt: ["$startDate", "$createdAt"] },
                        status: { $ne: 'Rejected' },
                        createdAt: { $gte: yearStart, $lte: yearEnd }
                    });
                    if (postFactoCount >= activeRule.maxPostFactoCount) {
                        return res.status(400).json({ error: `You have reached the maximum limit of ${activeRule.maxPostFactoCount} post-facto applications for ${leaveType} this year.` });
                    }
                }
            }
        }

        // Settings for Cycle
        const Settings = req.tenantDB.model('AttendanceSettings');

        // Overlap Check (excluding self)
        if (start.getDay() === 0 || end.getDay() === 0) return res.status(400).json({ error: "Leave cannot start/end on Sunday." });
        const overlap = await LeaveRequest.findOne({
            _id: { $ne: id }, tenant: req.tenantId, employee: employeeId, status: { $in: ['Pending', 'Approved'] },
            $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
        });
        if (overlap) return res.status(400).json({ error: "Overlap detected with existing request." });

        const newDaysCount = await calculateNetDays(req, startDate, endDate || startDate, employeeId);
        
        const fStart = new Date(startDate);
        const fEnd = new Date(endDate || startDate);
        fStart.setHours(0,0,0,0);
        fEnd.setHours(0,0,0,0);
        const isSingleDay = fStart.getTime() === fEnd.getTime();
        let sub = 0;
        if (isHalfDay) {
            const custom = req.body.meta?.customHalfDays;
            if (custom && !isSingleDay) {
                if (custom.firstDayHalf) sub += 0.5;
                if (custom.lastDayHalf) sub += 0.5;
            } else {
                sub = 0.5;
            }
        }
        const newDays = newDaysCount - sub;

        if (newDays <= 0) return res.status(400).json({ error: "Selected period contains no working days." });

        // Medical certificate validation
        if (activeRule && activeRule.medicalCertRequiredAfterDays > 0 && newDays >= activeRule.medicalCertRequiredAfterDays) {
            if (!req.body.medicalCertUrl && !request.medicalCertUrl) {
                return res.status(400).json({ error: `Medical certificate is mandatory for ${leaveType} leave of ${activeRule.medicalCertRequiredAfterDays} days or more.` });
            }
        }

        // 2. Balance Logic
        if (oldType === leaveType) {
            const balance = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType, year });
            if (!balance) return res.status(400).json({ error: "Balance not found." });
            if (balance.available + oldDays < newDays) {
                return res.status(400).json({ error: `Insufficient balance. Available: ${balance.available + oldDays}` });
            }
            balance.pending = balance.pending - oldDays + newDays;
            await balance.save();
            await refreshEmployeeLeaveSnapshot(req, employeeId, year);
        } else {
            const oldBalance = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType: oldType, year });
            const newBalance = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType, year });
            if (!newBalance) return res.status(400).json({ error: `Balance not found for ${leaveType}.` });
            if (newBalance.available < newDays) {
                return res.status(400).json({ error: `Insufficient balance in ${leaveType}. Available: ${newBalance.available}` });
            }
            if (oldBalance) {
                oldBalance.pending -= oldDays;
                await oldBalance.save();
            }
            newBalance.pending += newDays;
            await newBalance.save();
            await refreshEmployeeLeaveSnapshot(req, employeeId, year);
        }

        const { paidDays: newPaidDays, unpaidDays: newUnpaidDays } = await (async () => {
            let p = 0, u = 0;
            if (['LOP', 'Loss of Pay', 'Leave without Pay', 'Personal Leave'].includes(leaveType)) {
                u = newDays;
            } else {
                const b = await LeaveBalance.findOne({ tenant: req.tenantId, employee: employeeId, leaveType, year });
                const available = b ? (b.available + (oldType === leaveType ? oldPaid : 0)) : 0;
                p = Math.min(available, newDays);
                u = newDays - p;
            }
            return { paidDays: p, unpaidDays: u };
        })();

        // 3. Update Request
        request.leaveType = leaveType;
        request.startDate = start;
        request.endDate = end;
        request.reason = reason;
        request.daysCount = newDays;
        request.paidLeaveDays = newPaidDays;
        request.unpaidLeaveDays = newUnpaidDays;
        request.isHalfDay = !!isHalfDay;
        request.halfDayTarget = isHalfDay ? (halfDayTarget || (endDate ? 'End' : 'Start')) : undefined;
        request.halfDaySession = isHalfDay ? halfDaySession : undefined;
        if (req.body.medicalCertUrl) {
            request.medicalCertUrl = req.body.medicalCertUrl;
        }
        if (req.body.meta) {
            request.meta = {
                ...(request.meta || {}),
                ...req.body.meta
            };
            request.markModified('meta');
        }
        await request.save();

        // 4. Log transactions to Ledger
        if (oldType !== leaveType) {
            if (oldPaid > 0) {
                await logLeaveLedger(req, {
                    employeeId,
                    leaveType: oldType,
                    year,
                    actionType: 'Adjustment',
                    days: oldPaid,
                    remarks: `Adjustment: Leave type changed from ${oldType} to ${leaveType}`,
                    referenceId: request._id,
                    referenceModel: 'LeaveRequest'
                });
            }
            if (newPaidDays > 0) {
                await logLeaveLedger(req, {
                    employeeId,
                    leaveType,
                    year,
                    actionType: 'Applied',
                    days: -newPaidDays,
                    remarks: `Leave applied: ${startDate} to ${endDate || startDate}`,
                    referenceId: request._id,
                    referenceModel: 'LeaveRequest'
                });
            }
        } else {
            const netDiff = oldPaid - newPaidDays;
            if (netDiff !== 0) {
                await logLeaveLedger(req, {
                    employeeId,
                    leaveType,
                    year,
                    actionType: 'Adjustment',
                    days: netDiff,
                    remarks: `Adjustment: Leave details updated`,
                    referenceId: request._id,
                    referenceModel: 'LeaveRequest'
                });
            }
        }

        res.json({ message: "Leave request updated", data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.cancelLeave = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeaveRequest, LeaveBalance } = getModels(req);
        const { id } = req.params;
        const currentEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!currentEmployee?._id) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const employeeId = currentEmployee._id;
        const actorEmployeeId = currentEmployee._id;

        const request = await LeaveRequest.findOne({ _id: id, employee: employeeId, tenant: req.tenantId });
        if (!request) return res.status(404).json({ error: "Request not found" });

        // Enterprise Rule: Direct cancellation not allowed for Approved leaves
        if (request.status === 'Approved') {
            return res.status(400).json({ error: "Approved leaves cannot be cancelled directly. Please use Attendance Regularization if you were present." });
        }

        if (['Rejected', 'Cancelled'].includes(request.status)) {
            return res.status(400).json({ error: `Request already ${request.status}` });
        }

        const balance = await LeaveBalance.findOne({
            employee: employeeId, tenant: req.tenantId, leaveType: request.leaveType, year: new Date(request.startDate).getFullYear()
        });

        if (balance) {
            if (request.status === 'Pending') {
                const paid = request.paidLeaveDays || 0;
                balance.pending = Math.max(0, (balance.pending || 0) - paid);
                if (typeof balance.available === 'number') {
                    balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
                }
            }
            await balance.save();
            await refreshEmployeeLeaveSnapshot(req, employeeId, new Date(request.startDate).getFullYear());
        }

        request.status = 'Cancelled';
        request.cancelledAt = new Date();
        request.actionBy = actorEmployeeId;
        await request.save();

        if (request.paidLeaveDays > 0) {
            await logLeaveLedger(req, {
                employeeId: request.employee,
                leaveType: request.leaveType,
                year: new Date(request.startDate).getFullYear(),
                actionType: 'Cancelled',
                days: request.paidLeaveDays,
                remarks: `Leave request cancelled by employee`,
                referenceId: request._id,
                referenceModel: 'LeaveRequest'
            });
        }

        res.json({ message: "Leave request cancelled", data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.earlyReturn = async (req, res) => {
    try {
        const { LeaveRequest, LeaveBalance, Attendance, Employee } = getModels(req);
        const { id } = req.params;
        let { newEndDate, actualReturnDate, reason, comments } = req.body;
        
        const currentEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!currentEmployee?._id) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const employeeId = currentEmployee._id;

        const request = await LeaveRequest.findOne({ _id: id, employee: employeeId, tenant: req.tenantId });
        if (!request) return res.status(404).json({ error: "Request not found" });

        if (request.status !== 'Approved') {
            return res.status(400).json({ error: "Only Approved leaves can be partially cancelled/returned early." });
        }

        if (!actualReturnDate && newEndDate) {
            const tempDate = new Date(newEndDate);
            tempDate.setDate(tempDate.getDate() + 1);
            actualReturnDate = tempDate.toISOString();
        }
        
        if (!newEndDate && actualReturnDate) {
            const tempDate = new Date(actualReturnDate);
            tempDate.setDate(tempDate.getDate() - 1);
            newEndDate = tempDate.toISOString();
        }

        const start = new Date(request.startDate);
        const originalEnd = new Date(request.endDate);
        const newEnd = new Date(newEndDate);
        
        start.setHours(0,0,0,0);
        originalEnd.setHours(0,0,0,0);
        newEnd.setHours(0,0,0,0);

        if (newEnd >= originalEnd) {
            return res.status(400).json({ error: "New end date must be earlier than the original end date." });
        }

        request.meta = {
            ...request.meta,
            earlyReturnRequest: {
                actualReturnDate: new Date(actualReturnDate),
                newEndDate: newEnd,
                reason: reason || 'Early Return',
                comments: comments || '',
                status: 'Pending',
                requestedAt: new Date()
            }
        };

        request.markModified('meta');
        await request.save();

        // Notifications
        const emp = await Employee.findById(employeeId);
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
        const returnDateStr = new Date(actualReturnDate).toLocaleDateString('en-GB');

        // Notify HR
        await notificationController.createNotification(req, {
            receiverId: req.tenantId, receiverRole: 'hr', entityType: 'LeaveRequest', entityId: request._id,
            title: `Early Return Request: ${empName}`, 
            message: `${empName} has requested an early return on ${returnDateStr} (${reason || 'Work completed earlier'})`
        });

        // Notify Manager
        if (emp && emp.manager) {
            await notificationController.createNotification(req, {
                receiverId: emp.manager, receiverRole: 'manager', entityType: 'LeaveRequest', entityId: request._id,
                title: `Early Return Request: ${empName}`, 
                message: `${empName} has requested an early return on ${returnDateStr} (${reason || 'Work completed earlier'})`
            });
        }

        res.json({ message: "Early return request submitted successfully, pending approval.", data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.setOpeningBalance = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeaveBalance, Employee, LeavePolicy } = getModels(req);
        const { employeeId, leaveType, opening, year } = req.body;

        if (!employeeId || !leaveType || opening === undefined || !year) {
            return res.status(400).json({ error: "Missing required fields: employeeId, leaveType, opening, year" });
        }

        const targetYear = parseInt(year);
        const openingVal = parseFloat(opening);

        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ error: "Employee not found" });

        const activePolicy = await leaveManagementService.resolveLeavePolicyForEmployee({
            LeavePolicy,
            tenantId: req.tenantId,
            employee
        });

        if (activePolicy) {
            await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
                employee,
                tenantId: req.tenantId,
                tenantDB: req.tenantDB,
                year: targetYear,
                policy: activePolicy
            });
        }

        let balance = await LeaveBalance.findOne({
            tenant: req.tenantId,
            employee: employeeId,
            leaveType: leaveType.toUpperCase(),
            year: targetYear
        });

        if (!balance) {
            balance = new LeaveBalance({
                tenant: req.tenantId,
                employee: employeeId,
                policy: activePolicy?._id || null,
                leaveType: leaveType.toUpperCase(),
                year: targetYear,
                used: 0,
                pending: 0
            });
        }

        const prevAvailable = balance.available || 0;
        balance.opening = openingVal;
        balance.isOpeningManual = true;
        balance.total = openingVal + (balance.accrued || 0);
        await balance.save();

        await refreshEmployeeLeaveSnapshot(req, employeeId, targetYear);

        const LeaveLedger = req.tenantDB.model('LeaveLedger');
        await LeaveLedger.create({
            tenant: req.tenantId,
            employee: employeeId,
            leaveType: leaveType.toUpperCase(),
            year: targetYear,
            actionType: 'Opening',
            days: openingVal,
            previousBalance: prevAvailable,
            newBalance: balance.available,
            remarks: `Manual opening balance override by HR`,
            date: new Date()
        });

        res.json({ success: true, message: "Opening balance updated successfully", balance });
    } catch (e) {
        console.error("setOpeningBalance Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.getLeaveLedger = async (req, res) => {
    try {
        const tenantIdStr = req.user?.tenantId || req.tenantId;
        if (!tenantIdStr) return res.status(400).json({ error: "tenant_missing" });
        req.tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        const { LeaveLedger } = getModels(req);
        const isHR = ['hr', 'admin', 'psa'].includes(req.user.role);
        
        let employeeId = req.query.employeeId;
        if (!isHR || !employeeId) {
            const currentEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
            if (!currentEmployee?._id) {
                return res.status(404).json({ error: "Employee not found" });
            }
            employeeId = currentEmployee._id;
        }

        const query = {
            tenant: req.tenantId,
            employee: new mongoose.Types.ObjectId(employeeId)
        };

        if (req.query.leaveType) {
            query.leaveType = String(req.query.leaveType).toUpperCase();
        }
        if (req.query.year) {
            query.year = parseInt(req.query.year);
        }

        const ledger = await LeaveLedger.find(query)
            .sort({ date: -1, createdAt: -1 })
            .lean();

        res.json(ledger);
    } catch (e) {
        console.error("getLeaveLedger Error:", e);
        res.status(500).json({ error: e.message });
    }
};
