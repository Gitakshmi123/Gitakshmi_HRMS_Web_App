const mongoose = require('mongoose');

const rosterSchema = new mongoose.Schema({
    tenant: { type: String, required: true, index: true },
    rosterName: { type: String, required: true },
    month: { type: Number, required: true }, // Derived for filtering
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    weeklyOffDays: [{ 
        type: Number, 
        min: 0,
        max: 6
    }],
    halfDayOfWeek: [{ 
        type: Number, 
        min: 0,
        max: 6
    }],
    weekendDates: [{ type: Date }],
    rosterType: { 
        type: String, 
        enum: ['Manual', 'Fixed Shift', 'Weekly Rotation', 'Team Rotation', 'Fair Rotation'],
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
