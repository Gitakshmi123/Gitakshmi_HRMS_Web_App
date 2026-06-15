const mongoose = require('mongoose');

/**
 * LeaveApprovalEngine
 * Manages complex multi-level approval workflows for leave requests.
 */
class LeaveApprovalEngine {
    constructor(tenantDB) {
        this.tenantDB = tenantDB;
        this.Models = {
            LeaveRequest: tenantDB.model('LeaveRequest'),
            Workflow: tenantDB.model('LeaveApprovalWorkflow'),
            Employee: tenantDB.model('Employee'),
            LeavePolicy: tenantDB.model('ZohoLeavePolicy')
        };
    }

    /**
     * Entry point when a leave is applied.
     * Evaluates auto-approval and finds the first human approver.
     */
    async initiateWorkflow(leaveRequest) {
        const { Workflow, LeaveRequest } = this.Models;

        // 1. Find applicable workflow
        // Logic: specific to policy, or generic active one
        const workflow = await Workflow.findOne({ 
            tenant: leaveRequest.tenant, 
            $or: [
                { policy: leaveRequest.meta?.policyId },
                { isActive: true }
            ]
        }).sort({ policy: -1 });

        if (!workflow) {
            // Fallback to direct manager if no workflow defined
            return this._assignToManager(leaveRequest);
        }

        // 2. Check Auto-Approval Rules
        const autoApproved = this._checkAutoApproval(leaveRequest, workflow);
        if (autoApproved) {
            leaveRequest.status = 'Approved';
            leaveRequest.approvedAt = new Date();
            await leaveRequest.save();
            return { status: 'AUTO_APPROVED' };
        }

        // 3. Start Level 1
        return this.advanceToLevel(leaveRequest, workflow, 1);
    }

    /**
     * Advance the request to a specific workflow level
     */
    async advanceToLevel(leaveRequest, workflow, levelIndex) {
        const levelConfig = workflow.levels.find(l => l.level === levelIndex);
        
        if (!levelConfig) {
            // No more levels -> Final Approval
            leaveRequest.status = 'Approved';
            leaveRequest.approvedAt = new Date();
            await leaveRequest.save();
            return { status: 'FINAL_APPROVED' };
        }

        // Resolve Approver
        const approverId = await this._resolveApprover(leaveRequest, levelConfig);
        
        leaveRequest.approver = approverId;
        leaveRequest.meta = { 
            ...leaveRequest.meta, 
            currentLevel: levelIndex, 
            workflowId: workflow._id 
        };
        
        await leaveRequest.save();
        return { status: 'PENDING_APPROVAL', level: levelIndex, approverId };
    }

    /**
     * Logic to resolve who the human approver is based on type
     */
    async _resolveApprover(leaveRequest, config) {
        const { Employee } = this.Models;
        const employee = await Employee.findById(leaveRequest.employee);

        switch (config.approverType) {
            case 'MANAGER':
                return employee.manager;
            case 'SPECIFIC_USER':
                return config.approverValue;
            case 'GRADE_HEAD':
                // Logic to find head of a specific grade
                const head = await Employee.findOne({ 
                    tenant: leaveRequest.tenant, 
                    gradeId: config.approverValue,
                    role: 'HR_ADMIN' // Or specific head role
                });
                return head?._id || employee.manager;
            default:
                return employee.manager;
        }
    }

    /**
     * Check if request meets auto-approval criteria
     */
    _checkAutoApproval(leaveRequest, workflow) {
        for (const rule of workflow.autoApprovalRules) {
            if (rule.criteria === 'DAYS_LESS_THAN' && leaveRequest.daysCount < rule.value) {
                return true;
            }
            if (rule.criteria === 'LEAVE_TYPE_MATCH' && leaveRequest.leaveType === rule.value) {
                return true;
            }
        }
        return false;
    }

    async _assignToManager(leaveRequest) {
        const employee = await this.Models.Employee.findById(leaveRequest.employee);
        leaveRequest.approver = employee.manager;
        await leaveRequest.save();
        return { status: 'ASSIGNED_TO_MANAGER' };
    }
}

module.exports = LeaveApprovalEngine;
