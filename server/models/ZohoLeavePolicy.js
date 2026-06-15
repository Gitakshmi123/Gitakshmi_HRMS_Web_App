const mongoose = require('mongoose');

const ZohoLeavePolicySchema = new mongoose.Schema({
    tenant: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tenant', 
        required: true, 
        index: true 
    },
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    leaveType: { 
        type: String, 
        enum: ['PAID', 'SICK', 'CASUAL', 'UNPAID', 'MATERNITY', 'PATERNITY'], 
        required: true 
    },
    description: { 
        type: String, 
        trim: true 
    },

    // 2. Entitlement
    entitlement: {
        daysPerYear: { type: Number, required: true, min: 0 },
        accrualType: { 
            type: String, 
            enum: ['MONTHLY', 'YEARLY', 'QUARTERLY'], 
            default: 'YEARLY' 
        },
        // Grade specific entitlement overrides
        gradeEntitlements: [{
            grade: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade' },
            days: { type: Number, required: true }
        }]
    },

    // 3. Applicability
    applicability: {
        targetType: { 
            type: String, 
            enum: ['ALL', 'GRADE', 'DEPARTMENT', 'DESIGNATION', 'SPECIFIC'], 
            default: 'ALL' 
        },
        // Array of ObjectIds corresponding to targetType
        targetValues: [{ type: mongoose.Schema.Types.ObjectId }]
    },

    // 4. Restrictions
    restrictions: {
        maxPerMonth: { type: Number, default: 0 }, // 0 = no limit
        minGapBetweenLeaves: { type: Number, default: 0 }, // In days
        requireApproval: { type: Boolean, default: true },
        allowDuringProbation: { type: Boolean, default: false },
        noticePeriodDays: { type: Number, default: 0 }
    },

    // 5. Reset Rules
    resetRules: {
        resetCycle: { 
            type: String, 
            enum: ['MONTHLY', 'YEARLY'], 
            default: 'YEARLY' 
        },
        carryForwardLimit: { type: Number, default: 0 }, // Max days to carry forward
        encashmentLimit: { type: Number, default: 0 }
    },

    // 6. Advanced
    advanced: {
        allowHalfDay: { type: Boolean, default: true },
        allowNegativeBalance: { type: Boolean, default: false },
        maxNegativeBalance: { type: Number, default: 0 },
        sandwichRule: { type: Boolean, default: false }, // If true, weekends between leaves are counted
        color: { type: String, default: '#4F46E5' }
    },

    status: { 
        type: String, 
        enum: ['ACTIVE', 'INACTIVE'], 
        default: 'ACTIVE' 
    }
}, { 
    timestamps: true 
});

// Index for performance
ZohoLeavePolicySchema.index({ tenant: 1, name: 1 });
ZohoLeavePolicySchema.index({ tenant: 1, leaveType: 1 });

// Export Schema for Multi-Tenant instantiation
module.exports = ZohoLeavePolicySchema;
