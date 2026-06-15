const mongoose = require('mongoose');

const LeaveApprovalWorkflowSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    
    // Linked to a specific policy or used as a fallback
    policy: { type: mongoose.Schema.Types.ObjectId, ref: 'ZohoLeavePolicy', index: true },

    // The sequence of approval levels
    levels: [{
        level: { type: Number, required: true }, // 1, 2, 3...
        approverType: { 
            type: String, 
            enum: ['MANAGER', 'SPECIFIC_USER', 'ROLE', 'GRADE_HEAD'],
            required: true 
        },
        approverValue: { type: mongoose.Schema.Types.Mixed }, // ID or Role name
        mandatory: { type: Boolean, default: true }
    }],

    // Auto-approval logic
    autoApprovalRules: [{
        criteria: { type: String, enum: ['DAYS_LESS_THAN', 'LEAVE_TYPE_MATCH'] },
        value: { type: mongoose.Schema.Types.Mixed },
        action: { type: String, enum: ['AUTO_APPROVE', 'SKIP_TO_HR'], default: 'AUTO_APPROVE' }
    }],

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = LeaveApprovalWorkflowSchema;
