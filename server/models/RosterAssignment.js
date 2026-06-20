const mongoose = require('mongoose');

const rosterAssignmentSchema = new mongoose.Schema({
    tenant: { type: String, required: true, index: true },
    rosterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roster', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftMaster', required: true },
    weekNo: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' }
}, { timestamps: true });

rosterAssignmentSchema.index({ tenant: 1, employeeId: 1, startDate: 1, endDate: 1 });

module.exports = rosterAssignmentSchema;
