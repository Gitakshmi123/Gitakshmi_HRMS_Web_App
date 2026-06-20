const mongoose = require('mongoose');

const rosterRotationSchema = new mongoose.Schema({
    tenant: { type: String, required: true, index: true },
    patternName: { type: String, required: true },
    description: { type: String },
    rotationType: { type: String, enum: ['Weekly', 'Team'], default: 'Weekly' },
    sequence: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ShiftMaster' }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = rosterRotationSchema;
