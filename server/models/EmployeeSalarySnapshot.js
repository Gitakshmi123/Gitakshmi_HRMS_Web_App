/**
 * EmployeeSalarySnapshot Schema (v6.1 Fix)
 * 
 * DESIGN DECISIONS:
 * 1. Keep 'reason' at root to satisfy legacy logic and existing data.
 * 2. Keep 'breakdown' as numeric totals.
 * 3. Add explicit type safety for all monetary fields.
 */
const mongoose = require('mongoose');

const EmployeeSalarySnapshotSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', index: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  ctc: { type: Number, required: true },
  monthlyCTC: { type: Number, required: true },

  earnings: [{
    code: String,
    name: { type: String, required: true },
    calculationType: { type: String, default: 'FLAT' },
    value: { type: Number, default: 0 },
    formula: { type: String, trim: true },
    formulaFrequency: { type: String, enum: ['MONTHLY', 'ANNUAL'], default: 'MONTHLY' },
    isManual: { type: Boolean, default: false },
    isSystemGenerated: { type: Boolean, default: false },
    basedOn: { type: String, enum: ['BASIC', 'GROSS', 'CTC', 'NA', 'MW_OR_50PCT'], default: 'NA' },
    monthlyAmount: { type: Number, required: true, default: 0 },
    yearlyAmount: { type: Number, required: true, default: 0 }
  }],

  employeeDeductions: [{
    code: String,
    name: { type: String, required: true },
    calculationType: { type: String, default: 'FLAT' },
    value: { type: Number, default: 0 },
    formula: { type: String, trim: true },
    formulaFrequency: { type: String, enum: ['MONTHLY', 'ANNUAL'], default: 'MONTHLY' },
    isManual: { type: Boolean, default: false },
    isSystemGenerated: { type: Boolean, default: false },
    basedOn: { type: String, enum: ['BASIC', 'GROSS', 'CTC', 'NA', 'MW_OR_50PCT'], default: 'NA' },
    monthlyAmount: { type: Number, required: true, default: 0 },
    yearlyAmount: { type: Number, required: true, default: 0 }
  }],

  benefits: [{
    code: String,
    name: String,
    calculationType: { type: String, default: 'FLAT' },
    value: { type: Number, default: 0 },
    formula: { type: String, trim: true },
    formulaFrequency: { type: String, enum: ['MONTHLY', 'ANNUAL'], default: 'MONTHLY' },
    isManual: { type: Boolean, default: false },
    isSystemGenerated: { type: Boolean, default: false },
    basedOn: { type: String, enum: ['BASIC', 'GROSS', 'CTC', 'NA', 'MW_OR_50PCT'], default: 'NA' },
    monthlyAmount: { type: Number, required: true, default: 0 },
    yearlyAmount: { type: Number, required: true, default: 0 }
  }],

  payrollContext: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Aggregated Totals
  breakdown: {
    totalEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalBenefits: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 }
  },

  summary: {
    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalBenefits: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 }
  },

  // Reason for this snapshot
  reason: {
    type: String,
    enum: ['ASSIGNMENT', 'JOINING', 'INCREMENT', 'REVISION', 'PROMOTION', 'MANUAL', 'CORRECTION'],
    default: 'ASSIGNMENT',
    required: true
  },

  effectiveFrom: { type: Date, required: true, index: true, default: Date.now },
  locked: { type: Boolean, default: false, index: true },
  lockedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, {
  versionKey: false,
  timestamps: false,
  // Ensure that if the model name is reused, we can still identify it
  collection: 'employeesalarysnapshots'
});

// Middleware to prevent modification of locked snapshots
EmployeeSalarySnapshotSchema.pre('save', function (next) {
  // If it's a new document, allow everything
  if (this.isNew) return next();

  // If the snapshot was ALREADY locked in the database (tracked via _originalLockedStatus)
  if (this._originalLockedStatus === true) {
    const modifiedPaths = this.modifiedPaths();

    // Define fields that are strictly immutable once locked
    const monetaryFields = ['ctc', 'monthlyCTC', 'earnings', 'employeeDeductions', 'benefits', 'breakdown', 'summary', 'tenant', 'employee', 'applicant'];

    // Check if any protected fields are being modified
    const isTouchingProtected = modifiedPaths.some(path =>
      monetaryFields.some(f => path === f || path.startsWith(f + '.'))
    );

    if (isTouchingProtected) {
      return next(new Error('Cannot modify a locked salary snapshot. Please unlock it first to make changes.'));
    }
  }
  next();
});

// Helper to track original status
EmployeeSalarySnapshotSchema.post('init', function () {
  this._originalLockedStatus = this.locked;
});

module.exports = EmployeeSalarySnapshotSchema;
