const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  permissions: [
    {
      module: { type: String, required: true },
      section: { type: String, default: 'General' },
      actions: {
        type: Map,
        of: Boolean,
        default: { view: false }
      }
    }
  ],
  tenant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    index: true 
  },
  isDefault: { 
    type: Boolean, 
    default: false 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Ensure unique role name per tenant (except for global defaults)
RoleSchema.index({ name: 1, tenant: 1 }, { unique: true });

module.exports = RoleSchema;
