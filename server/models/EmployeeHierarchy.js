const mongoose = require('mongoose');

const EmployeeHierarchyNodeSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    relationKey: { type: String, required: true, trim: true, uppercase: true, index: true },
    relationLabel: { type: String, trim: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    role: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    source: {
      type: String,
      enum: ['employee_field', 'manager_chain', 'department_head', 'division_head', 'branch_head', 'role_lookup'],
      default: 'role_lookup',
    },
    scope: {
      subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null },
      branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
      divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null },
      departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
      designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    },
  },
  { _id: false }
);

const EmployeeHierarchySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    subjectEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    subjectUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    subjectEmail: { type: String, trim: true, lowercase: true, index: true },
    subjectName: { type: String, trim: true, default: '' },
    subjectRole: { type: String, trim: true, default: '' },
    subjectScope: {
      subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null },
      branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
      divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null },
      departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
      designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    },
    chain: { type: [EmployeeHierarchyNodeSchema], default: [] },
    sourceSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    generatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

EmployeeHierarchySchema.index({ tenantId: 1, subjectEmployeeId: 1, isActive: 1 });
EmployeeHierarchySchema.index({ tenantId: 1, subjectUserId: 1, isActive: 1 });
EmployeeHierarchySchema.index({ tenantId: 1, 'chain.employeeId': 1, isActive: 1 });
EmployeeHierarchySchema.index({ tenantId: 1, 'chain.relationKey': 1, isActive: 1 });

module.exports = EmployeeHierarchySchema;
