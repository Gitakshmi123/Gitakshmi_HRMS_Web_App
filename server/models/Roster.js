const mongoose = require('mongoose');

const rosterSchema = new mongoose.Schema({
    tenant: { type: String, required: true, index: true },
    rosterName: { type: String, required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    rosterType: { 
        type: String, 
        enum: ['Manual', 'Weekly Rotation', 'Team Rotation', 'Fair Rotation'],
        default: 'Manual'
    },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    
    status: { type: String, enum: ['Draft', 'Pending Manager', 'Pending HR', 'Published'], default: 'Draft' },
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    published: { type: Boolean, default: false },
}, { timestamps: true });

rosterSchema.index({ tenant: 1, month: 1, year: 1 });

module.exports = rosterSchema;
