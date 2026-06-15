const mongoose = require('mongoose');

const ModuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String }, // lucide-react name
  order: { type: Number, default: 0 },
  moduleKey: { type: String }, // e.g., 'hr', 'payroll'
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Multi-tenant fix (following project pattern)
module.exports = ModuleSchema;
