const mongoose = require('mongoose');
const { resolveAuthenticatedEmployee } = require('../utils/employeeAuthResolver');
const {
  normalizeRelationKey,
  resolveApproversFromHierarchy,
} = require('./employeeHierarchy.service');

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function uniqueObjectIds(values = []) {
  const seen = new Set();
  return values
    .filter(Boolean)
    .map((value) => String(value))
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .map((value) => new mongoose.Types.ObjectId(value));
}

async function resolveEmployeeForUser(req, tenantDB) {
  if (!req?.user || !tenantDB) return null;

  try {
    const employee = await resolveAuthenticatedEmployee(req, {
      select: '_id email role manager departmentId branchId divisionId designationId mainCompanyId tenant',
    });
    if (employee?._id) return employee;
  } catch (_) {
    // Fallback below handles older tokens where employee resolver cannot map IDs.
  }

  const Employee = tenantDB.model('Employee');
  const userId = req.user.id || req.user._id || req.user.userId;
  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    const byId = await Employee.findById(userId)
      .select('_id email role manager departmentId branchId divisionId designationId mainCompanyId tenant')
      .lean();
    if (byId) return byId;
  }

  const email = String(req.user.email || '').trim();
  if (email) {
    const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    return Employee.findOne({ email: emailRegex })
      .select('_id email role manager departmentId branchId divisionId designationId mainCompanyId tenant')
      .lean();
  }

  return null;
}

function tenantScope(tenantId) {
  if (!tenantId) return {};
  return {
    $or: [
      { mainCompanyId: tenantId },
      { tenant: tenantId },
      { tenantId },
      { companyId: tenantId },
    ],
  };
}

const ROLE_APPROVER_ALIASES = {
  ceo: ['ceo', 'chief_executive_officer', 'director', 'company_admin', 'company_super_admin', 'main_company_admin', 'MAIN_COMPANY_ADMIN', 'sub_company_admin', 'SUB_COMPANY_ADMIN', 'super_admin', 'SUPER_ADMIN'],
  hr: ['hr', 'HR', 'human_resource', 'hr_executive'],
  hr_head: ['hr_head', 'HR_HEAD', 'hr manager', 'hr_manager', 'human_resource_head'],
  finance: ['finance', 'FINANCE', 'finance_executive'],
  finance_head: ['finance_head', 'FINANCE_HEAD', 'finance manager', 'finance_manager'],
  admin: ['admin', 'Admin', 'company_admin', 'company_super_admin', 'main_company_admin', 'MAIN_COMPANY_ADMIN', 'sub_company_admin', 'SUB_COMPANY_ADMIN', 'super_admin', 'SUPER_ADMIN'],
};

function roleAliasesFor(role) {
  const normalizedRole = normalizeRole(role);
  const aliases = ROLE_APPROVER_ALIASES[normalizedRole] || [normalizedRole];
  return [...new Set([
    ...aliases,
    ...aliases.map((alias) => String(alias).toUpperCase()),
    ...aliases.map((alias) => String(alias).replace(/_/g, ' ')),
  ].filter(Boolean))];
}

function splitName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Approver',
    lastName: parts.slice(1).join(' '),
  };
}

async function ensureEmployeeForUser({ tenantDB, tenantId, user }) {
  if (!user?.email) return null;
  const Employee = tenantDB.model('Employee');
  const emailRegex = new RegExp(`^${String(user.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  let employee = await Employee.findOne({
    ...tenantScope(tenantId),
    email: { $regex: emailRegex },
    isDeleted: { $ne: true },
  }).select('_id').lean();
  if (employee?._id) return employee._id;

  const { firstName, lastName } = splitName(user.name || user.email);
  const codeSeed = String(user.employeeCode || user._id || Date.now()).slice(-8).toUpperCase();
  employee = await Employee.create({
    tenant: tenantId,
    mainCompanyId: tenantId,
    subCompanyId: user.subCompanyId || null,
    branchId: user.branchId || null,
    divisionId: user.divisionId || null,
    departmentId: user.departmentId || null,
    designationId: user.designationId || null,
    firstName,
    lastName,
    email: String(user.email).toLowerCase(),
    role: user.role,
    employeeId: user.employeeCode || `APP-${codeSeed}`,
    employeeCode: user.employeeCode || `APP-${codeSeed}`,
    status: 'ACTIVE',
  });
  return employee._id;
}

async function resolveEmployeeIdsFromMixedIds({ tenantDB, tenantId, values = [] }) {
  const Employee = tenantDB.model('Employee');
  const User = mongoose.models.User || mongoose.model('User');
  const resolved = [];

  for (const rawValue of values) {
    const objectId = rawValue && mongoose.Types.ObjectId.isValid(String(rawValue))
      ? new mongoose.Types.ObjectId(String(rawValue))
      : null;
    if (!objectId) continue;

    const employee = await Employee.findOne({
      ...tenantScope(tenantId),
      _id: objectId,
      isDeleted: { $ne: true },
    }).select('_id').lean();
    if (employee?._id) {
      resolved.push(employee._id);
      continue;
    }

    const user = await User.findOne({
      ...tenantScope(tenantId),
      _id: objectId,
      isActive: { $ne: false },
    }).select('_id name email role employeeCode subCompanyId branchId divisionId departmentId designationId').lean();
    if (user?._id) {
      const employeeId = await ensureEmployeeForUser({ tenantDB, tenantId, user });
      if (employeeId) resolved.push(employeeId);
    }
  }

  return uniqueObjectIds(resolved);
}

async function resolveRoleApprovers({ tenantDB, role, tenantId = null }) {
  const Employee = tenantDB.model('Employee');
  const User = mongoose.models.User || mongoose.model('User');
  const roleAliases = roleAliasesFor(role);
  if (!roleAliases.length) return [];

  const employees = await Employee.find({
    ...tenantScope(tenantId),
    isDeleted: { $ne: true },
    status: { $nin: ['INACTIVE', 'Inactive', 'inactive'] },
    $or: roleAliases.map((alias) => ({ role: new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })),
  }).select('_id').lean();

  const resolvedIds = employees.map((employee) => employee._id);
  const users = await User.find({
    ...tenantScope(tenantId),
    isActive: { $ne: false },
    $or: roleAliases.map((alias) => ({ role: new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })),
  }).select('_id name email role employeeCode subCompanyId branchId divisionId departmentId designationId').lean();

  for (const user of users) {
    const employeeId = await ensureEmployeeForUser({ tenantDB, tenantId, user });
    if (employeeId) resolvedIds.push(employeeId);
  }

  return uniqueObjectIds(resolvedIds);
}

async function resolveSpecificApprover({ value }) {
  const values = Array.isArray(value) ? value : [value];
  return uniqueObjectIds(values);
}

async function resolveRelationshipApprover({ tenantDB, requesterEmployee, type, contextSnapshot = {} }) {
  if (contextSnapshot?.applicantId) {
    try {
      const Applicant = tenantDB.model('Applicant');
      const applicant = await Applicant.findById(contextSnapshot.applicantId).populate('requirementId');
      if (applicant && applicant.requirementId) {
        if (type === 'DEPARTMENT_HEAD') {
          const deptName = applicant.requirementId.department;
          const Department = tenantDB.model('Department');
          let department = null;
          if (deptName) {
            department = await Department.findOne({
              $or: [
                { name: deptName },
                { name: new RegExp('^' + deptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
              ]
            }).lean();
          }
          
          if (department) {
            const ids = await resolveEmployeeIdsFromMixedIds({
              tenantDB,
              tenantId: contextSnapshot?.tenantId,
              values: [department.departmentHeadId, department.headEmployeeId],
            });
            if (ids.length) return ids;
          }

          // Fallback to any department head configured in the organization
          const fallbackDept = await Department.findOne({
            $or: [
              { departmentHeadId: { $ne: null } },
              { headEmployeeId: { $ne: null } }
            ]
          }).lean();
          if (fallbackDept) {
            const ids = await resolveEmployeeIdsFromMixedIds({
              tenantDB,
              tenantId: contextSnapshot?.tenantId,
              values: [fallbackDept.departmentHeadId, fallbackDept.headEmployeeId],
            });
            if (ids.length) return ids;
          }
        }
        if (type === 'REPORTING_MANAGER') {
          const hiringManager = applicant.requirementId.jobDetails?.hiringManager;
          if (hiringManager) {
            const ids = await resolveEmployeeIdsFromMixedIds({
              tenantDB,
              tenantId: contextSnapshot?.tenantId,
              values: [hiringManager],
            });
            if (ids.length) return ids;
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to resolve relationship approver for applicant:', err);
    }
  }

  if (!requesterEmployee?._id) return [];

  if (type === 'REPORTING_MANAGER') {
    return uniqueObjectIds([requesterEmployee.manager]);
  }

  if (type === 'MANAGER_MANAGER') {
    if (!requesterEmployee.manager) return [];
    const Employee = tenantDB.model('Employee');
    const manager = await Employee.findById(requesterEmployee.manager).select('manager').lean();
    return uniqueObjectIds([manager?.manager]);
  }

  if (type === 'DEPARTMENT_HEAD') {
    if (!requesterEmployee.departmentId) return [];
    const Department = tenantDB.model('Department');
    const department = await Department.findById(requesterEmployee.departmentId)
      .select('departmentHeadId headEmployeeId')
      .lean();
    return resolveEmployeeIdsFromMixedIds({
      tenantDB,
      tenantId: requesterEmployee?.mainCompanyId || requesterEmployee?.tenant || contextSnapshot?.tenantId,
      values: [department?.departmentHeadId, department?.headEmployeeId],
    });
  }

  if (type === 'BRANCH_HEAD') {
    if (!requesterEmployee.branchId) return [];
    const Branch = tenantDB.model('Branch');
    const branch = await Branch.findById(requesterEmployee.branchId)
      .select('branchHeadId headEmployeeId')
      .lean();
    return resolveEmployeeIdsFromMixedIds({
      tenantDB,
      tenantId: requesterEmployee?.mainCompanyId || requesterEmployee?.tenant || contextSnapshot?.tenantId,
      values: [branch?.branchHeadId, branch?.headEmployeeId],
    });
  }

  if (type === 'DIVISION_HEAD') {
    if (!requesterEmployee.divisionId) return [];
    const Division = tenantDB.model('Division');
    const division = await Division.findById(requesterEmployee.divisionId)
      .select('divisionHeadId headEmployeeId')
      .lean();
    return resolveEmployeeIdsFromMixedIds({
      tenantDB,
      tenantId: requesterEmployee?.mainCompanyId || requesterEmployee?.tenant || contextSnapshot?.tenantId,
      values: [division?.divisionHeadId, division?.headEmployeeId],
    });
  }

  return [];
}

async function resolveApproverConfig({ tenantDB, requesterEmployee, approver, contextSnapshot = {} }) {
  const type = String(approver?.type || '').trim().toUpperCase();
  const value = approver?.value;
  const tenantId = requesterEmployee?.mainCompanyId || requesterEmployee?.tenant || contextSnapshot?.tenantId;
  if (contextSnapshot?.applicantId && ['DEPARTMENT_HEAD', 'REPORTING_MANAGER'].includes(type)) {
    const applicantRelationApprovers = await resolveRelationshipApprover({
      tenantDB,
      requesterEmployee,
      type,
      contextSnapshot
    });
    if (applicantRelationApprovers.length) {
      return applicantRelationApprovers;
    }
  }

  if (requesterEmployee?._id && tenantId) {
    const hierarchyRelation = normalizeRelationKey(value || type);
    if ([
      'TEAM_LEAD',
      'REPORTING_MANAGER',
      'MANAGER',
      'MANAGER_MANAGER',
      'DEPARTMENT_HEAD',
      'DIVISION_HEAD',
      'BRANCH_HEAD',
      'HR',
      'HR_HEAD',
      'FINANCE',
      'FINANCE_HEAD',
      'CEO',
    ].includes(hierarchyRelation)) {
      const hierarchyApprovers = await resolveApproversFromHierarchy({
        tenantDB,
        tenantId,
        employeeId: requesterEmployee._id,
        relationKey: hierarchyRelation,
      });
      if (hierarchyApprovers.length) return hierarchyApprovers;
    }
  }

  if (['SPECIFIC_EMPLOYEE', 'SPECIFIC_USER'].includes(type)) {
    return resolveSpecificApprover({ value });
  }

  if (type === 'ROLE') {
    return resolveRoleApprovers({ tenantDB, role: value, tenantId });
  }

  if (['HR', 'HR_ROLE'].includes(type)) {
    return resolveRoleApprovers({ tenantDB, role: value || 'hr', tenantId });
  }

  if (['HR_HEAD', 'HR_HEAD_ROLE'].includes(type)) {
    return resolveRoleApprovers({ tenantDB, role: value || 'hr_head', tenantId });
  }

  if (['FINANCE', 'FINANCE_ROLE'].includes(type)) {
    return resolveRoleApprovers({ tenantDB, role: value || 'finance', tenantId });
  }

  if (['FINANCE_HEAD', 'FINANCE_HEAD_ROLE'].includes(type)) {
    return resolveRoleApprovers({ tenantDB, role: value || 'finance_head', tenantId });
  }

  if (['DIRECTOR', 'DIRECTOR_ROLE'].includes(type)) {
    return resolveRoleApprovers({ tenantDB, role: value || 'director', tenantId });
  }

  if (['CEO', 'CEO_ROLE'].includes(type)) {
    return resolveRoleApprovers({ tenantDB, role: value || 'ceo', tenantId });
  }

  return resolveRelationshipApprover({ tenantDB, requesterEmployee, type, contextSnapshot });
}

async function resolveApprovers({ tenantDB, requesterEmployeeId, step, contextSnapshot = {} }) {
  const Employee = tenantDB.model('Employee');
  const requesterEmployee = requesterEmployeeId
    ? await Employee.findById(requesterEmployeeId)
      .select('_id email role manager departmentId branchId divisionId designationId mainCompanyId tenant')
      .lean()
    : null;

  let approvers = await resolveApproverConfig({
    tenantDB,
    requesterEmployee,
    approver: step.approver,
    contextSnapshot,
  });

  if (!approvers.length && step.fallbackApprover?.type) {
    approvers = await resolveApproverConfig({
      tenantDB,
      requesterEmployee,
      approver: step.fallbackApprover,
      contextSnapshot,
    });
  }

  const allowRequesterApproval = contextSnapshot?.workflowSettings?.allowRequesterApproval === true;
  if (!allowRequesterApproval && requesterEmployee?._id) {
    approvers = approvers.filter((id) => String(id) !== String(requesterEmployee._id));
  }

  return approvers;
}

module.exports = {
  resolveApprovers,
  resolveEmployeeForUser,
};
