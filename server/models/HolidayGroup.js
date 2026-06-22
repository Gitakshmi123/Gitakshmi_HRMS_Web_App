const mongoose = require('mongoose');

const HolidayGroupSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    year: { type: Number, required: true },
    status: { type: String, enum: ['Active', 'Draft', 'Archived'], default: 'Active' },
    description: { type: String },
    applicability: {
        type: { type: String, enum: ['All Employees', 'Department', 'Branch', 'Location', 'Policy Based', 'Custom Selection'], default: 'All Employees' },
        branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
        departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
        designations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Designation' }],
        leavePolicies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LeavePolicy' }],
        employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }]
    },
    holidays: [{
        name: { type: String, required: true },
        date: { type: Date, required: true },
        type: { type: String, enum: ['National Holiday', 'Festival Holiday', 'Regional Holiday', 'Company Holiday', 'Optional Holiday', 'Restricted Holiday'], default: 'National Holiday' },
        leaveImpact: { type: String, enum: ['Paid Holiday', 'Unpaid Holiday', 'Half Day Paid', 'Half Day Unpaid'], default: 'Paid Holiday' },
        category: { type: String, enum: ['Mandatory', 'Optional', 'Floating Holiday'], default: 'Mandatory' },
        halfDayConfig: { type: String, enum: ['First Half', 'Second Half', 'None'], default: 'None' },
        recurring: { type: Boolean, default: true },
        allowLeaveApplication: { type: Boolean, default: false },
        excludeFromLeaveCalc: { type: Boolean, default: true },
        countAsPayable: { type: Boolean, default: true },
        showInCalendar: { type: Boolean, default: true },
        showInDashboard: { type: Boolean, default: true },
        remarks: { type: String },
        createdOn: { type: Date, default: Date.now }
    }],
    auditLogs: [{
        performedBy: { type: String },
        action: { type: String },
        oldValue: { type: String },
        newValue: { type: String },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Ensure unique combination of name and year per tenant
HolidayGroupSchema.index({ tenant: 1, name: 1, year: 1 }, { unique: true });

module.exports = HolidayGroupSchema;
