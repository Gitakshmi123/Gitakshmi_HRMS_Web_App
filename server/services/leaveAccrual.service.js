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
                let accrualAmount = getMonthlyAccrualAmount(rule);
                const maxLeaveCap = Number(rule.maxLeaveCap || 0);

                let eligibleDays = 0;
                let formulaApplied = '';
                let isAttendanceBased = !!rule.accrualDependsOnAttendance;

                if (isAttendanceBased) {
                    // Fetch attendance records for this month
                    const startDate = new Date(Number(year), Number(month) - 1, 1);
                    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

                    const Attendance = tenantDB.model('Attendance');
                    const attendances = await Attendance.find({
                        tenant: tenantId,
                        employee: employee._id,
                        date: { $gte: startDate, $lte: endDate }
                    });

                    for (const att of attendances) {
                        let recordWeight = 0;
                        const countPresent = rule.countPresent !== false;
                        const countOnDuty = rule.countOnDuty !== false;
                        const countCompOff = rule.countCompOff !== false;
                        const countHoliday = rule.countHoliday !== false;
                        const countWeeklyOff = rule.countWeeklyOff !== false;
                        const countPaidLeave = !!rule.countPaidLeave;

                        if (countPresent && att.status === 'present') {
                            recordWeight = 1;
                        } else if (countPresent && att.status === 'half_day') {
                            recordWeight = 0.5;
                        } else if (countOnDuty && att.isOnDuty) {
                            recordWeight = 1;
                        } else if (countCompOff && att.isCompOffDay) {
                            recordWeight = 1;
                        } else if (countHoliday && att.status === 'holiday') {
                            recordWeight = 1;
                        } else if (countWeeklyOff && att.status === 'weekly_off') {
                            recordWeight = 1;
                        } else if (countPaidLeave && att.status === 'leave') {
                            recordWeight = 1;
                        }
                        eligibleDays += recordWeight;
                    }

                    // Evaluate slabs
                    const slabs = rule.accrualSlabs && rule.accrualSlabs.length > 0 ? rule.accrualSlabs : [];
                    const activeSlabs = slabs.length > 0 
                        ? slabs 
                        : [{ minAttendanceDays: (rule.minAttendanceDays !== undefined && rule.minAttendanceDays !== null ? rule.minAttendanceDays : 20), creditDays: accrualAmount }];

                    const sortedSlabs = [...activeSlabs].sort((a, b) => b.minAttendanceDays - a.minAttendanceDays);

                    let matchedSlab = null;
                    for (const slab of sortedSlabs) {
                        if (eligibleDays >= slab.minAttendanceDays) {
                            matchedSlab = slab;
                            break;
                        }
                    }

                    if (matchedSlab) {
                        accrualAmount = matchedSlab.creditDays;
                        formulaApplied = `>=${matchedSlab.minAttendanceDays}`;
                    } else {
                        accrualAmount = 0;
                        formulaApplied = 'Else';
                    }
                }

                // If not attendance based and accrual rate <= 0, we can skip
                if (!isAttendanceBased && accrualAmount <= 0) {
                    continue;
                }

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

                const prevAvailable = balance.available || 0;

                if (accrualAmount > 0) {
                    balance.accrued = (balance.accrued || 0) + accrualAmount;
                    balance.total = (balance.opening || 0) + balance.accrued;

                    if (maxLeaveCap > 0) {
                        balance.total = Math.min(balance.total, maxLeaveCap);
                    }

                    balance.expiresAt = getBalanceExpiryDate(year, rule.expiryMonths);
                    await balance.save();
                }

                try {
                    const LeaveLedger = tenantDB.model('LeaveLedger');
                    await LeaveLedger.create({
                        tenant: tenantId,
                        employee: employee._id,
                        leaveType,
                        year,
                        actionType: 'Accrual',
                        days: accrualAmount,
                        previousBalance: prevAvailable,
                        newBalance: balance.available,
                        eligibleDays: isAttendanceBased ? eligibleDays : null,
                        formulaApplied: isAttendanceBased ? formulaApplied : '',
                        remarks: isAttendanceBased
                            ? (accrualAmount > 0 
                                ? `Monthly attendance credit: ${accrualAmount} EL (Eligible Days: ${eligibleDays}, slab: ${formulaApplied})`
                                : `Ineligible for monthly attendance credit: 0 EL (Eligible Days: ${eligibleDays}, criteria not met)`)
                            : `Monthly leave accrual credit`,
                        date: new Date()
                    });
                } catch (ledgerErr) {
                    console.error('[ACCRUAL_LEDGER_ERROR]', ledgerErr.message);
                }

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
                    accrued: accrualAmount,
                    eligibleDays: isAttendanceBased ? eligibleDays : null,
                    formulaApplied: isAttendanceBased ? formulaApplied : ''
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

                const prevAvailable = nextBalance.available || 0;
                nextBalance.opening = (nextBalance.opening || 0) + carryAmount;
                nextBalance.total = nextBalance.opening + (nextBalance.accrued || 0);

                if (Number(effectiveRule.maxLeaveCap || 0) > 0) {
                    nextBalance.total = Math.min(nextBalance.total, Number(effectiveRule.maxLeaveCap));
                }

                nextBalance.expiresAt = getBalanceExpiryDate(toYear, effectiveRule.expiryMonths);
                await nextBalance.save();

                try {
                    const LeaveLedger = tenantDB.model('LeaveLedger');
                    await LeaveLedger.create({
                        tenant: tenantId,
                        employee: balance.employee,
                        leaveType,
                        year: toYear,
                        actionType: 'Opening',
                        days: carryAmount,
                        previousBalance: prevAvailable,
                        newBalance: nextBalance.available,
                        remarks: `Carry forward credit from year ${fromYear}`,
                        date: new Date()
                    });
                } catch (ledgerErr) {
                    console.error('[CARRYFORWARD_LEDGER_ERROR]', ledgerErr.message);
                }

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
