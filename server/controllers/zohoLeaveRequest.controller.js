const mongoose = require('mongoose');
const LeavePolicyEngine = require('../services/policyEngine');
const LeaveCalculatorService = require('../services/leaveCalculator.service');

/**
 * ZohoLeaveRequestController
 * Handles advanced leave applications with strict policy compliance.
 */
class ZohoLeaveRequestController {
    
    /**
     * Submit a new leave request
     */
    async applyLeave(req, res) {
        try {
            const { 
                leaveType, startDate, endDate, 
                reason, isHalfDay, halfDaySession 
            } = req.body;
            
            const employeeId = req.user.id;
            const tenantId = req.user.tenantId;
            const tenantDB = req.tenantDB;

            // 1. Context Initialization
            const engine = new LeavePolicyEngine(tenantDB);
            const calculator = new LeaveCalculatorService(tenantDB);
            
            const Employee = tenantDB.model('Employee');
            const LeaveRequest = tenantDB.model('LeaveRequest');
            const employee = await Employee.findById(employeeId);

            if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

            // 2. Resolve Effective Policy
            const effectivePolicy = await engine.getEffectivePolicy(employee);
            if (!effectivePolicy) {
                return res.status(400).json({ success: false, message: "No leave policy assigned to you." });
            }

            // 3. Calculate Leave Duration
            const start = new Date(startDate);
            const end = new Date(endDate);
            const today = new Date();
            
            if (start > end) return res.status(400).json({ success: false, message: "Start date cannot be after end date." });

            let daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            if (isHalfDay) daysCount = 0.5;

            // 4. APPLY RESTRICTIONS
            const restrictions = effectivePolicy.restrictions || {};
            const advanced = effectivePolicy.advanced || {};

            // A. Notice Period Check
            if (restrictions.noticePeriodDays > 0) {
                const diffTime = Math.abs(start - today);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < restrictions.noticePeriodDays) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Minimum ${restrictions.noticePeriodDays} days notice is required for this leave type.` 
                    });
                }
            }

            // B. Max Per Month Check
            if (restrictions.maxPerMonth > 0) {
                const currentMonth = start.getMonth();
                const currentYear = start.getFullYear();
                
                const monthStart = new Date(currentYear, currentMonth, 1);
                const monthEnd = new Date(currentYear, currentMonth + 1, 0);

                const existingCount = await LeaveRequest.countDocuments({
                    employee: employeeId,
                    status: { $in: ['Pending', 'Approved'] },
                    startDate: { $gte: monthStart, $lte: monthEnd }
                });

                if (existingCount >= restrictions.maxPerMonth) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Monthly limit reached. Maximum ${restrictions.maxPerMonth} leaves allowed per month.` 
                    });
                }
            }

            // C. Half-Day Check
            if (isHalfDay && !advanced.allowHalfDay) {
                return res.status(400).json({ success: false, message: "Half-day leaves are not allowed under this policy." });
            }

            // 5. CHECK BALANCE & DEDUCT (PENDING)
            // This method throws an error if balance is insufficient or negative rules are violated.
            try {
                await calculator.deductLeave(
                    employeeId, 
                    leaveType, 
                    daysCount, 
                    isHalfDay, 
                    start.getFullYear()
                );
            } catch (balanceError) {
                return res.status(400).json({ success: false, message: balanceError.message });
            }

            // 6. CREATE REQUEST
            const leaveRequest = new LeaveRequest({
                tenant: tenantId,
                employee: employeeId,
                leaveType,
                startDate: start,
                endDate: end,
                reason,
                daysCount,
                isHalfDay,
                halfDaySession,
                status: 'Pending',
                appliedBy: 'Employee',
                approver: employee.manager // Auto-route to manager
            });

            await leaveRequest.save();

            res.status(201).json({
                success: true,
                message: "Leave request submitted successfully and sent for approval.",
                data: leaveRequest
            });

        } catch (error) {
            console.error('Leave Application Error:', error);
            res.status(500).json({ success: false, message: "Internal server error during leave processing." });
        }
    }

    /**
     * Get Leave Eligibility & Status (Pre-Check API)
     */
    async getEligibilityCheck(req, res) {
        try {
            const employeeId = req.user.id;
            const tenantDB = req.tenantDB;

            const Employee = tenantDB.model('Employee');
            const employee = await Employee.findById(employeeId);
            const engine = new LeavePolicyEngine(tenantDB);

            const policy = await engine.getEffectivePolicy(employee);

            res.json({
                success: true,
                policyName: policy?.name,
                entitlement: policy?.entitlement,
                restrictions: policy?.restrictions,
                advanced: policy?.advanced
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ZohoLeaveRequestController();
