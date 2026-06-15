const mongoose = require('mongoose');

const SidebarPageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'SidebarModule' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SidebarPage', default: null }, // for subpages
  route: { type: String },
  permissionKey: { type: String }, // e.g., 'people.employees'
  icon: { type: String },
  isExternal: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = SidebarPageSchema;
