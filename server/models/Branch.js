const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    branchCode: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true 
    },
    entityCode: { type: String, trim: true, index: true },

    mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null, index: true },

    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    
    branchType: {
      type: String,
      enum: ['Head Office', 'Branch', 'Warehouse'],
      default: 'Branch'
    },
    // Contact Info
    contactPerson: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    
    // Operational Info
    workingHours: {
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' }
    },
    timezone: { type: String, default: 'UTC+5:30' },

    headEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      index: true
    },
    branchHeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      index: true
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Composite index for name per sub-company
BranchSchema.index({ mainCompanyId: 1, subCompanyId: 1, name: 1 }, { unique: true });

// Drop legacy index if it exists
BranchSchema.on('index', function(err) {
  try {
    this.model('Branch').collection.dropIndex('companyId_1_name_1').catch(() => {});
  } catch (e) {}
});

module.exports = BranchSchema;
