const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverRole: {
        type: String,
        enum: ['employee', 'manager', 'hr', 'psa', 'candidate'],
        required: true
    },

    entityType: { type: String, required: true }, // e.g., 'Leave', 'Attendance', 'Payroll', 'Announcement'
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },

    title: { type: String, required: true },
    message: { type: String, required: true },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date }
}, { timestamps: true });

// Compound index for role‑based isolation and fast retrieval
NotificationSchema.index({ receiverId: 1, receiverRole: 1, isRead: 1 });
NotificationSchema.index({ tenant: 1, createdAt: -1 });

module.exports = NotificationSchema;

