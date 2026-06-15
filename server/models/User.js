const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: [
      'SUPER_ADMIN',
      'MAIN_COMPANY_ADMIN',
      'SUB_COMPANY_ADMIN',
      'BRANCH_HEAD',
      'DIVISION_HEAD',
      'DEPARTMENT_HEAD',
      'EMPLOYEE',
      'main_company_admin',
      'sub_company_admin',
      'branch_head',
      'division_head',
      'department_head',
      'psa',
      'hr',
      'HR',
      'admin',
      'Admin',
      'company_admin',
      'company_super_admin',
      'human_resource',
      'employee',
      'manager'
    ],
    default: 'EMPLOYEE'
  },
  permissions: [
    {
      module: { type: String, required: true },
      section: { type: String, default: 'General' },
      actions: {
        view: { type: Boolean, default: false },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      }
    }
  ],
  // Permission versioning — incremented on every permission update.
  // Frontend compares this to detect stale cache and auto-refetch.
  permVersion: { type: Number, default: 0 },
  permUpdatedAt: { type: Date },

  mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
  subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null, index: true },
  employeeCode: { type: String, trim: true, index: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  createdAt: { type: Date, default: Date.now }
});

// --- SECURITY: Hash password before saving ---
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  // Skip when password is already a bcrypt hash (prevents double-hashing in bulk imports).
  if (typeof this.password === 'string' && this.password.startsWith('$2')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Fast lookup: email per main company (unique ensures data integrity)
UserSchema.index({ mainCompanyId: 1, email: 1 }, { unique: true });
// Fast lookup: permissions query for RBAC middleware
UserSchema.index({ mainCompanyId: 1, subCompanyId: 1, role: 1 });

// Multi-tenant fix: Export ONLY Schema
module.exports = UserSchema;
