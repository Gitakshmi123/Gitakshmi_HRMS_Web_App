const mongoose = require('mongoose');

const JoiningSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },

    joiningDate: { type: Date, required: true },

    status: { type: String, enum: ['PENDING', 'CONFIRMED'], default: 'PENDING', index: true },

    issuedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

JoiningSchema.index({ tenant: 1, applicationId: 1 }, { unique: true });
JoiningSchema.index({ tenant: 1, candidateId: 1, createdAt: -1 });

module.exports = JoiningSchema;

