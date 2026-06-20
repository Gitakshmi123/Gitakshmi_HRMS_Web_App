const mongoose = require('mongoose');

const shiftSwapRequestSchema = new mongoose.Schema(
    {
        tenant: {
            type: String,
            required: true,
            index: true
        },
        requesterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        targetEmployeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        originalRosterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EmployeeRoster',
            required: true
        },
        targetRosterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EmployeeRoster',
            required: true
        },
        dateOfSwap: {
            type: Date,
            required: true
        },
        reason: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        comments: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
);

shiftSwapRequestSchema.index({ tenant: 1, status: 1 });

module.exports = shiftSwapRequestSchema;
