const mongoose = require('mongoose');

/**
 * LeavePolicyEngine
 * Architected to resolve complex leave policy assignments in a multi-tenant SaaS environment.
 * Inspired by Zoho People's policy resolution logic.
 */
class LeavePolicyEngine {
    constructor(tenantDB) {
        this.tenantDB = tenantDB;
        this.Models = {
            LeavePolicy: tenantDB.model('ZohoLeavePolicy'),
            Grade: tenantDB.model('Grade'),
            Department: tenantDB.model('Department'),
            Employee: tenantDB.model('Employee'),
            LeaveBalance: tenantDB.model('LeaveBalance')
        };
        
        // Higher values = Higher priority
        this.PRIORITY_MAP = {
            'SPECIFIC': 1000,
            'DESIGNATION': 800,
            'GRADE': 600,
            'DEPARTMENT': 400,
            'ALL': 100
        };
    }

    /**
     * Resolves the effective leave policy for a given employee.
     * @param {Object} employee - The employee document (populated with IDs)
     * @returns {Promise<Object>} The winning policy and its resolved rules.
     */
    async getEffectivePolicy(employee) {
        if (!employee) throw new Error("Employee context is required for policy resolution.");

        const tenantId = employee.tenant;

        /**
         * OPTIMIZED QUERY LOGIC:
         * Fetches all potential policy matches in a single database round-trip.
         * Uses the applicability targets defined in the ZohoLeavePolicy schema.
         */
        const potentialPolicies = await this.Models.LeavePolicy.find({
            tenant: tenantId,
            status: 'ACTIVE',
            $or: [
                { 'applicability.targetType': 'ALL' },
                { 
                    'applicability.targetType': 'GRADE', 
                    'applicability.targetValues': employee.gradeId 
                },
                { 
                    'applicability.targetType': 'DEPARTMENT', 
                    'applicability.targetValues': employee.departmentId 
                },
                { 
                    'applicability.targetType': 'DESIGNATION', 
                    'applicability.targetValues': employee.designationId 
                },
                { 
                    'applicability.targetType': 'SPECIFIC', 
                    'applicability.targetValues': employee._id 
                }
            ]
        }).lean();

        if (potentialPolicies.length === 0) {
            return null;
        }

        // 1. RESOLVE CONFLICTS & PRIORITIZE
        const sortedPolicies = potentialPolicies.sort((a, b) => {
            const priorityA = this.PRIORITY_MAP[a.applicability.targetType] || 0;
            const priorityB = this.PRIORITY_MAP[b.applicability.targetType] || 0;
            
            if (priorityB !== priorityA) {
                return priorityB - priorityA; // Higher priority first
            }
            
            // If same priority level, use the most recently updated policy
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        const effectivePolicy = sortedPolicies[0];

        // 2. APPLY GRADE-BASED OVERRIDES
        // If the winning policy has grade-specific entitlements, resolve them now.
        const resolvedEntitlement = this._resolveEntitlement(effectivePolicy, employee);

        return {
            policyId: effectivePolicy._id,
            name: effectivePolicy.name,
            leaveType: effectivePolicy.leaveType,
            entitlement: resolvedEntitlement,
            restrictions: effectivePolicy.restrictions,
            resetRules: effectivePolicy.resetRules,
            advanced: effectivePolicy.advanced,
            applicabilityType: effectivePolicy.applicability.targetType
        };
    }

    /**
     * Internal helper to resolve grade-based overrides within a policy
     */
    _resolveEntitlement(policy, employee) {
        const { daysPerYear, gradeEntitlements, accrualType } = policy.entitlement;
        
        let effectiveDays = daysPerYear;

        if (employee.gradeId && Array.isArray(gradeEntitlements)) {
            const override = gradeEntitlements.find(
                ge => ge.grade.toString() === employee.gradeId.toString()
            );
            if (override) {
                effectiveDays = override.days;
            }
        }

        return {
            days: effectiveDays,
            accrualType: accrualType
        };
    }

    /**
     * Audit: List all applicable policies for an employee for transparency.
     */
    async auditEmployeePolicies(employee) {
        // ... (existing audit logic)
    }

    /**
     * SYNC ON PROMOTION
     * Re-evaluates and updates leave balances when an employee is promoted (grade change).
     */
    async syncOnPromotion(employeeId, newGradeId) {
        const { Employee, LeaveBalance } = this.Models;

        // 1. Fetch updated employee
        const employee = await Employee.findById(employeeId);
        if (!employee) throw new Error("Employee not found");

        // Update context if not already updated in DB
        employee.gradeId = newGradeId;

        // 2. Resolve new effective policy and entitlement
        const effectivePolicy = await this.getEffectivePolicy(employee);
        if (!effectivePolicy) return null;

        // 3. Update Leave Balance
        // For SaaS consistency, we update the allocation (total) for the current year.
        const currentYear = new Date().getFullYear();
        
        const balance = await LeaveBalance.findOneAndUpdate(
            { 
                employee: employeeId, 
                leaveType: effectivePolicy.leaveType, 
                year: currentYear 
            },
            { 
                total: effectivePolicy.entitlement.days,
                policy: effectivePolicy.policyId
            },
            { upsert: true, new: true }
        );

        return {
            policyName: effectivePolicy.name,
            newEntitlement: effectivePolicy.entitlement.days,
            updatedBalance: balance
        };
    }
}

module.exports = LeavePolicyEngine;
