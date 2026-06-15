const mongoose = require('mongoose');

const OfferLetterSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },

    position: { type: String, trim: true, default: '' },
    gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null, index: true },
    gradeSnapshot: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
      name: { type: String, trim: true, default: '' },
      code: { type: String, trim: true, default: '' },
      level: { type: Number, default: null }
    },
    salary: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'SIGNED'],
      default: 'PENDING',
      index: true,
    },

    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issuedAt: { type: Date, default: Date.now, index: true },

    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    signedAt: { type: Date, default: null },

    documentUrl: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

OfferLetterSchema.index({ tenant: 1, applicationId: 1 }, { unique: true });
OfferLetterSchema.index({ tenant: 1, candidateId: 1, createdAt: -1 });

module.exports = OfferLetterSchema;

