const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyLimit: { type: Number, required: true, min: 1 },
    // String is used so it can store both ObjectId-like IDs and PSA IDs like "psa_admin".
    createdBy: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

GroupSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Group', GroupSchema);
