const mongoose = require('mongoose');

/**
 * LeaveCalculatorService
 * Backend logic for managing leave balances, accruals, and deductions.
 */
class LeaveCalculatorService {
    constructor(tenantDB) {
        this.tenantDB = tenantDB;
        this.Models = {
            LeaveBalance: tenantDB.model('LeaveBalance'),
            LeavePolicy: tenantDB.model('ZohoLeavePolicy'),
            Employee: tenantDB.model('Employee')
        };
    }

    /**
     * Calculate initial balance for a new joiner (Pro-rata)
     */
    calculateProRataEntitlement(yearlyDays, joiningDate) {
        const joinDate = new Date(joiningDate);
        const joinMonth = joinDate.getMonth(); // 0-11
        const remainingMonths = 12 - joinMonth;
        
        // Example: Joins in July (index 6). Remaining = 12 - 6 = 6 months.
        // Entitlement = (15 / 12) * 6 = 7.5 days.
        const entitlement = (yearlyDays / 12) * remainingMonths;
        return parseFloat(entitlement.toFixed(2));
    }

    /**
     * Process monthly accrual for an employee
     * To be called by a cron job or manual trigger
     */
    async processMonthlyAccrual(employeeId, policy, year) {
        const { LeaveBalance } = this.Models;
        
        const balance = await LeaveBalance.findOne({
            employee: employeeId,
            leaveType: policy.leaveType,
            year: year
        });

        if (!balance) return;

        // Calculate monthly share
        const monthlyShare = policy.entitlement.daysPerYear / 12;
        
        balance.total += monthlyShare;
        // The pre-save hook in LeaveBalance will update 'available'
        await balance.save();

        return balance;
    }

    /**
     * Handle Leave Application Deduction
     * Handles Half-day and Negative Balance rules
     */
    async deductLeave(employeeId, leaveType, days, isHalfDay, year) {
        const { LeaveBalance, LeavePolicy } = this.Models;

        const balance = await LeaveBalance.findOne({
            employee: employeeId,
            leaveType: leaveType,
            year: year
        });

        if (!balance) throw new Error("No leave balance found for this type.");

        // 1. Fetch Policy to check negative balance rules
        const policy = await LeavePolicy.findOne({ 
            tenant: balance.tenant, 
            leaveType: leaveType 
        });

        const amountToDeduct = isHalfDay ? 0.5 : days;

        // 2. Check Negative Balance Constraints
        if (balance.available < amountToDeduct) {
            const isNegativeAllowed = policy?.advanced?.allowNegativeBalance || false;
            const maxNegative = policy?.advanced?.maxNegativeBalance || 0;

            if (!isNegativeAllowed) {
                throw new Error(`Insufficient leave balance. Available: ${balance.available}`);
            }

            if (Math.abs(balance.available - amountToDeduct) > maxNegative) {
                throw new Error(`Negative balance limit exceeded. Max allowed: -${maxNegative}`);
            }
        }

        // 3. Update Pending (usually leave apply adds to pending, approval adds to used)
        balance.pending += amountToDeduct;
        await balance.save();

        return balance;
    }

    /**
     * Handle Yearly Carry Forward
     * Runs at the end of the year
     */
    async carryForwardBalance(employeeId, leaveType, fromYear, toYear, policy) {
        const { LeaveBalance } = this.Models;

        const oldBalance = await LeaveBalance.findOne({
            employee: employeeId,
            leaveType: leaveType,
            year: fromYear
        });

        if (!oldBalance) return;

        const carryLimit = policy.resetRules?.carryForwardLimit || 0;
        const amountToCarry = Math.min(oldBalance.available, carryLimit);

        // Create new year balance
        const newTotal = policy.entitlement.daysPerYear + amountToCarry;

        const newBalance = await LeaveBalance.findOneAndUpdate(
            { employee: employeeId, leaveType: leaveType, year: toYear },
            { 
                total: newTotal,
                used: 0,
                pending: 0,
                tenant: oldBalance.tenant,
                policy: oldBalance.policy
            },
            { upsert: true, new: true }
        );

        return {
            carried: amountToCarry,
            newTotal: newBalance.total
        };
    }
}

module.exports = LeaveCalculatorService;
