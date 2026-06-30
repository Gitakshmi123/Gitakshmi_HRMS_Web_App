const mongoose = require('mongoose');

const LeaveLedgerSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    leaveType: { type: String, required: true, trim: true },
    year: { type: Number, required: true },

    actionType: { 
        type: String, 
        enum: ['Opening', 'Accrual', 'Applied', 'Cancelled', 'Rejected', 'Adjustment', 'Override', 'Encashment'], 
        required: true 
    },
    
    // Days changed: e.g. +10, +1.75, -2
    days: { type: Number, required: true },

    previousBalance: { type: Number, default: 0 },
    newBalance: { type: Number, default: 0 },

    eligibleDays: { type: Number, default: null },
    formulaApplied: { type: String, default: '' },

    remarks: { type: String, trim: true },
    
    // The exact date/time this ledger entry occurred
    date: { type: Date, default: Date.now, index: true },

    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    referenceModel: { type: String, default: null },
    
    createdBy: { type: String, default: 'System' }
}, { timestamps: true });

LeaveLedgerSchema.index({ tenant: 1, employee: 1, leaveType: 1 });
LeaveLedgerSchema.index({ tenant: 1, employee: 1, year: 1 });

module.exports = LeaveLedgerSchema;
