const mongoose = require('mongoose');

const rosterAuditLogSchema = new mongoose.Schema({
    tenant: { type: String, required: true, index: true },
    rosterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roster', required: true },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = rosterAuditLogSchema;
