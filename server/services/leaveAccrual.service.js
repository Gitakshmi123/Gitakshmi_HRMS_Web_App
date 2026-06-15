const leaveManagementService = require('./leaveManagement.service');
const gradeLeavePolicyService = require('./gradeLeavePolicy.service');

function getMonthlyAccrualAmount(rule) {
    const configuredRate = Number(rule.monthlyAccrualRate || 0);
    if (configuredRate > 0) {
        return configuredRate;
    }
    return Number(rule.totalPerYear || 0) / 12;
}

function getBalanceExpiryDate(year, expiryMonths) {
    if (!expiryMonths || Number(expiryMonths) <= 0) {
        return null;
    }
    return new Date(Number(year), Number(expiryMonths), 0);
}

async function expireOldBalances({ Employee, LeaveBalance, tenantId, year }) {
    const today = new Date();
    const expiredBalances = await LeaveBalance.find({
        tenant: tenantId,
        year,
        expiresAt: { $lte: today },
        available: { $gt: 0 }
    });

    for (const balance of expiredBalances) {
        balance.available = 0;
        await balance.save();

        const employee = await Employee.findById(balance.employee);
        if (employee) {
            await leaveManagementService.syncEmployeeLeaveSnapshotFromDocuments({
                employee,
                tenantId,
                LeaveBalance,
                year
            });
        }
    }
}

async function runMonthlyAccrual(tenantDB, tenantId, year, month) {
    const LeavePolicy = tenantDB.model('LeavePolicy');
    const Employee = tenantDB.model('Employee');
    const LeaveBalance = tenantDB.model('LeaveBalance');
    const Grade = tenantDB.model('Grade');
    const LeaveAccrualLog = tenantDB.model('LeaveAccrualLog');

    const existing = await LeaveAccrualLog.findOne({ tenant: tenantId, year, month });
    if (existing) {
        return { message: 'Already executed for this month', year, month };
    }

    await expireOldBalances({ Employee, LeaveBalance, tenantId, year });

    const policies = await LeavePolicy.find({
        tenant: tenantId,
        status: 'ACTIVE',
        isActive: true
    });
    const results = [];

    for (const policy of policies) {
        const employees = await Employee.find({ tenant: tenantId });

        for (const employee of employees) {
            if (!leaveManagementService.isPolicyApplicableToEmployee(policy, employee)) {
                continue;
            }

            const grade = await gradeLeavePolicyService.resolveEmployeeGrade({
                employee,
                Grade,
                tenantId,
                date: new Date(Number(year), Number(month || 1) - 1, 1)
            });
            const effectiveRules = gradeLeavePolicyService.resolvePolicyRulesForEmployee({ policy, employee, grade });

            for (const rule of effectiveRules) {
                if (!rule.monthlyAccrual) {
                    continue;
                }

                const leaveType = String(rule.leaveType || '').toUpperCase();
                const accrualAmount = getMonthlyAccrualAmount(rule);
                const maxLeaveCap = Number(rule.maxLeaveCap || 0);

                let balance = await LeaveBalance.findOne({
                    tenant: tenantId,
                    employee: employee._id,
                    leaveType,
                    year
                });

                if (!balance) {
                    await leaveManagementService.assignPolicyToEmployee({
                        employee,
                        tenantId,
                        policy,
                        year,
                        prorate: employee.joiningDate ? new Date(employee.joiningDate).getFullYear() === Number(year) : false,
                        models: { Employee, LeavePolicy, LeaveBalance, Grade }
                    });

                    balance = await LeaveBalance.findOne({
                        tenant: tenantId,
                        employee: employee._id,
                        leaveType,
                        year
                    });
                }

                if (!balance) {
                    continue;
                }

                balance.total = Number(balance.total || 0) + accrualAmount;
                balance.available = Number(balance.available || 0) + accrualAmount;

                if (maxLeaveCap > 0) {
                    balance.total = Math.min(balance.total, maxLeaveCap);
                    balance.available = Math.min(balance.available, maxLeaveCap);
                }

                balance.expiresAt = getBalanceExpiryDate(year, rule.expiryMonths);
                await balance.save();

                await leaveManagementService.syncEmployeeLeaveSnapshotFromDocuments({
                    employee,
                    tenantId,
                    LeaveBalance,
                    year
                });

                results.push({
                    employeeId: employee._id,
                    policyId: policy._id,
                    leaveType,
                    accrued: accrualAmount
                });
            }
        }
    }

    await LeaveAccrualLog.create({ tenant: tenantId, year, month, executedAt: new Date() });

    return { message: 'Monthly accrual executed', year, month, results };
}

async function runCarryForwardForYear(tenantDB, tenantId, fromYear, toYear) {
    const LeavePolicy = tenantDB.model('LeavePolicy');
    const Employee = tenantDB.model('Employee');
    const LeaveBalance = tenantDB.model('LeaveBalance');
    const Grade = tenantDB.model('Grade');
    const policies = await LeavePolicy.find({ tenant: tenantId, status: 'ACTIVE', isActive: true });
    const carryResults = [];

    for (const policy of policies) {
        for (const rule of policy.rules || []) {
            const leaveType = String(rule.leaveType || '').toUpperCase();
            const maxCarryForward = Number(rule.maxCarryForward || 0);
            const balances = await LeaveBalance.find({ tenant: tenantId, year: fromYear, leaveType });

            for (const balance of balances) {
                const employee = await Employee.findById(balance.employee);
                if (!employee) {
                    continue;
                }
                const grade = await gradeLeavePolicyService.resolveEmployeeGrade({
                    employee,
                    Grade,
                    tenantId,
                    date: new Date(Number(toYear), 0, 1)
                });
                const effectiveRule = gradeLeavePolicyService.resolveEffectiveRuleForGrade({
                    rule,
                    employee,
                    grade
                }).rule;
                if (!effectiveRule.carryForwardAllowed) {
                    continue;
                }
                const effectiveMaxCarryForward = Number(effectiveRule.maxCarryForward || maxCarryForward || 0);
                const carryAmount = Math.min(Math.max(0, Number(balance.available || 0)), effectiveMaxCarryForward);
                if (carryAmount <= 0) {
                    continue;
                }

                let nextBalance = await LeaveBalance.findOne({
                    tenant: tenantId,
                    employee: balance.employee,
                    leaveType,
                    year: toYear
                });

                if (!nextBalance) {
                    await leaveManagementService.assignPolicyToEmployee({
                        employee,
                        tenantId,
                        policy,
                        year: toYear,
                        prorate: false,
                        models: { Employee, LeavePolicy, LeaveBalance, Grade }
                    });

                    nextBalance = await LeaveBalance.findOne({
                        tenant: tenantId,
                        employee: balance.employee,
                        leaveType,
                        year: toYear
                    });
                }

                if (!nextBalance) {
                    continue;
                }

                nextBalance.total = Number(nextBalance.total || 0) + carryAmount;
                nextBalance.available = Number(nextBalance.available || 0) + carryAmount;

                if (Number(effectiveRule.maxLeaveCap || 0) > 0) {
                    nextBalance.total = Math.min(nextBalance.total, Number(effectiveRule.maxLeaveCap));
                    nextBalance.available = Math.min(nextBalance.available, Number(effectiveRule.maxLeaveCap));
                }

                nextBalance.expiresAt = getBalanceExpiryDate(toYear, effectiveRule.expiryMonths);
                await nextBalance.save();

                if (employee) {
                    await leaveManagementService.syncEmployeeLeaveSnapshotFromDocuments({
                        employee,
                        tenantId,
                        LeaveBalance,
                        year: toYear
                    });
                }

                carryResults.push({
                    employeeId: balance.employee,
                    leaveType,
                    carryAmount
                });
            }
        }
    }

    return { message: 'Carry forward executed', fromYear, toYear, carryResults };
}

module.exports = { runMonthlyAccrual, runCarryForwardForYear };
