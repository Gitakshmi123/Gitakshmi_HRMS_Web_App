const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parentCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true
    },
    modules: {
      type: [String],
      default: []
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true
    },
    // DMS Integration: maps this HRMS company to the corresponding DMS company.
    // Set this to the _id of the DMS company. When syncing documents/hiring data to DMS,
    // this ID will be used instead of the global DMS_DEFAULT_COMPANY_ID env var.
    // This enables multi-company support: each HRMS company's data goes to its own DMS company.
    dmsCompanyId: { type: String, default: null, trim: true },

    // String is used so it can store both ObjectId-like IDs and non-ObjectId auth IDs.
    createdBy: { type: String, required: true, trim: true }
  },
  { timestamps: true, collection: 'psa_companies' }
);

CompanySchema.index({ groupId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Company', CompanySchema);
