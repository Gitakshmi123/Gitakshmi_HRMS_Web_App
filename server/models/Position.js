const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PositionSchema = new Schema({
    tenant: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    positionId: {
        type: String,
        unique: true,
        index: true
    },
    jobTitle: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        required: true,
        trim: true
    },
    departmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Department'
    },
    reportingTo: {
        type: Schema.Types.ObjectId,
        ref: 'Employee'
    },
    baseSalaryRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
    },
    budgetedCount: {
        type: Number,
        default: 1,
        min: 0
    },
    currentCount: {
        type: Number,
        default: 0,
        min: 0
    },
    level: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Filled', 'Vacant', 'Cancelled'],
        default: 'Vacant'
    },
    hiringStatus: {
        type: String,
        enum: ['Open', 'Closed', 'Paused'],
        default: 'Closed'
    },
    isReplacement: {
        type: Boolean,
        default: false
    },
    replacedEmployee: {
        type: Schema.Types.ObjectId,
        ref: 'Employee'
    },
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true,
    collection: 'positions'
});

module.exports = PositionSchema;
