const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null }, // for subpages
  route: { type: String },
  permissionKey: { type: String }, // e.g., 'people.employees'
  icon: { type: String },
  isExternal: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Export schema
module.exports = PageSchema;
