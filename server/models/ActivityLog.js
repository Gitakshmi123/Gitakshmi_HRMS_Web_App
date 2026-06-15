const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    actionType: { type: String, required: true },
    message: { type: String, required: true },
    tenantId: { type: String },
    companyName: { type: String },
    performedBy: { type: String },
    metadata: { type: Object },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
