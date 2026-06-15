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
    // String is used so it can store both ObjectId-like IDs and non-ObjectId auth IDs.
    createdBy: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

CompanySchema.index({ groupId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Company', CompanySchema);
