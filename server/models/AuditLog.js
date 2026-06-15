const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    entity: { type: String, required: true }, // e.g., 'Attendance', 'LeaveBalance'
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, required: true }, // 'REGULARIZATION_UPDATE'
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin User ID
    changes: {
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed }
    },
    meta: { type: mongoose.Schema.Types.Mixed } // e.g., { regularizationId: ... }
}, { timestamps: true });

AuditLogSchema.index({ tenant: 1, entity: 1, entityId: 1 });

module.exports = AuditLogSchema;
