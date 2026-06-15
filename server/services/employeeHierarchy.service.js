const mongoose = require('mongoose');

const RELATION_ALIASES = {
  TL: 'TEAM_LEAD',
  TEAMLEAD: 'TEAM_LEAD',
  TEAM_LEAD: 'TEAM_LEAD',
  REPORTING_TEAM_LEAD: 'TEAM_LEAD',
  REPORTING_MANAGER: 'REPORTING_MANAGER',
  MANAGER: 'REPORTING_MANAGER',
  LINE_MANAGER: 'REPORTING_MANAGER',
  MANAGER_MANAGER: 'MANAGER_MANAGER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  HOD: 'DEPARTMENT_HEAD',
  DIVISION_HEAD: 'DIVISION_HEAD',
  BRANCH_HEAD: 'BRANCH_HEAD',
  HR: 'HR',
  REPORTING_HR: 'HR',
  HR_HEAD: 'HR_HEAD',
  REPORTING_HR_HEAD: 'HR_HEAD',
  FINANCE: 'FINANCE',
  FINANCE_HEAD: 'FINANCE_HEAD',
  CEO: 'CEO',
  DIRECTOR: 'CEO',
};

const ROLE_ALIASES = {
  HR: ['hr', 'human_resource', 'hr_executive'],
  HR_HEAD: ['hr_head', 'hr manager', 'hr_manager', 'human_resource_head'],
  FINANCE: ['finance', 'finance_executive'],
  FINANCE_HEAD: ['finance_head', 'finance manager', 'finance_manager'],
  CEO: ['ceo', 'chief_executive_officer', 'director', 'company_admin', 'company_super_admin', 'sub_company_admin', 'SUB_COMPANY_ADMIN', 'super_admin', 'SUPER_ADMIN'],
  TEAM_LEAD: ['team_lead', 'team lead', 'tl', 'lead'],
};

function asObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function normalizeRelationKey(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return RELATION_ALIASES[normalized] || normalized;
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tenantFilter(tenantId) {
  const id = asObjectId(tenantId) || tenantId;
  return {
    $or: [
      { mainCompanyId: id },
      { tenant: id },
      { tenantId: id },
      { companyId: id },
    ],
  };
}

function fullName(person) {
  if (!person) return '';
  return person.name || `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || '';
}

function subjectScope(person = {}) {
  return {
    subCompanyId: person.subCompanyId || null,
    branchId: person.branchId || null,
    divisionId: person.divisionId || null,
    departmentId: person.departmentId || null,
    designationId: person.designationId || null,
  };
}

function roleVariants(role) {
  return [...new Set(
    [role, String(role || '').toUpperCase(), String(role || '').toLowerCase(), String(role || '').replace(/_/g, ' ')]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )];
}

function idFrom(value) {
  return asObjectId(value?._id || value);
}

async function findByIdSafe(Model, id, select = '') {
  const objectId = asObjectId(id);
  if (!objectId || !Model) return null;
  const query = Model.findById(objectId);
  if (select) query.select(select);
  return query.lean();
}

async function findUserForEmployee(tenantDB, tenantId, employee) {
  if (!employee?.email) return null;
  try {
    const User = mongoose.models.User || mongoose.model('User');
    return User.findOne({
      ...tenantFilter(tenantId),
      email: { $regex: new RegExp(`^${escapeRegex(employee.email)}$`, 'i') },
      isActive: { $ne: false },
    }).select('_id name email role subCompanyId branchId divisionId departmentId designationId').lean();
  } catch (_) {
    return null;
  }
}

async function findEmployeeForUser(tenantDB, tenantId, user) {
  try {
    const Employee = tenantDB.model('Employee');
    if (user?._id) {
      const byId = await Employee.findOne({ ...tenantFilter(tenantId), _id: user._id, isDeleted: { $ne: true } })
        .select('_id firstName lastName email role manager reportingManagerId reportingTeamLead reportingHR reportingHRHead reportingFinanceHead reportingCEO subCompanyId branchId divisionId departmentId designationId')
        .lean();
      if (byId) return byId;
    }
    if (user?.email) {
      return Employee.findOne({
        ...tenantFilter(tenantId),
        email: { $regex: new RegExp(`^${escapeRegex(user.email)}$`, 'i') },
        isDeleted: { $ne: true },
      }).select('_id firstName lastName email role manager reportingManagerId reportingTeamLead reportingHR reportingHRHead reportingFinanceHead reportingCEO subCompanyId branchId divisionId departmentId designationId').lean();
    }
  } catch (_) {
    return null;
  }
  return null;
}

async function resolveSubject({ tenantDB, tenantId, employeeId, userId, email }) {
  const Employee = tenantDB.model('Employee');
  const User = mongoose.models.User || mongoose.model('User');
  let employee = await findByIdSafe(
    Employee,
    employeeId,
    '_id firstName lastName email role manager reportingManagerId reportingTeamLead reportingHR reportingHRHead reportingFinanceHead reportingCEO subCompanyId branchId divisionId departmentId designationId'
  );
  let user = await findByIdSafe(
    User,
    userId,
    '_id name email role subCompanyId branchId divisionId departmentId designationId'
  );

  if (!employee && !user && email) {
    const emailQuery = { email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } };
    employee = await Employee.findOne({ ...tenantFilter(tenantId), ...emailQuery, isDeleted: { $ne: true } })
      .select('_id firstName lastName email role manager reportingManagerId reportingTeamLead reportingHR reportingHRHead reportingFinanceHead reportingCEO subCompanyId branchId divisionId departmentId designationId')
      .lean();
    user = await User.findOne({ ...tenantFilter(tenantId), ...emailQuery, isActive: { $ne: false } })
      .select('_id name email role subCompanyId branchId divisionId departmentId designationId')
      .lean();
  }

  if (!employee && user) employee = await findEmployeeForUser(tenantDB, tenantId, user);
  if (!user && employee) user = await findUserForEmployee(tenantDB, tenantId, employee);

  return { employee, user };
}

async function personFromEmployeeId(tenantDB, tenantId, employeeId) {
  const Employee = tenantDB.model('Employee');
  const employee = await Employee.findOne({
    ...tenantFilter(tenantId),
    _id: employeeId,
    isDeleted: { $ne: true },
  }).select('_id firstName lastName email role manager reportingManagerId reportingTeamLead reportingHR reportingHRHead reportingFinanceHead reportingCEO subCompanyId branchId divisionId departmentId designationId').lean();
  if (!employee) return null;
  return { employee, user: await findUserForEmployee(tenantDB, tenantId, employee) };
}

async function firstEmployeeByRoles(tenantDB, tenantId, roles, scope = {}) {
  const Employee = tenantDB.model('Employee');
  const aliases = roles.flatMap(roleVariants);
  const scoped = Object.fromEntries(
    Object.entries(scope || {}).filter(([, value]) => Boolean(value))
  );
  return Employee.findOne({
    ...tenantFilter(tenantId),
    ...scoped,
    isDeleted: { $ne: true },
    status: { $nin: ['INACTIVE', 'Inactive', 'inactive'] },
    $or: aliases.map((alias) => ({
      role: { $regex: new RegExp(`^${escapeRegex(alias)}$`, 'i') },
    })),
  }).select('_id firstName lastName email role subCompanyId branchId divisionId departmentId designationId').lean();
}

async function firstUserByRoles(tenantDB, tenantId, roles, scope = {}) {
  const User = mongoose.models.User || mongoose.model('User');
  const aliases = roles.flatMap(roleVariants);
  const scoped = Object.fromEntries(
    Object.entries(scope || {}).filter(([, value]) => Boolean(value))
  );
  return User.findOne({
    ...tenantFilter(tenantId),
    ...scoped,
    isActive: { $ne: false },
    $or: aliases.map((alias) => ({
      role: { $regex: new RegExp(`^${escapeRegex(alias)}$`, 'i') },
    })),
  }).select('_id name email role subCompanyId branchId divisionId departmentId designationId').lean();
}

async function resolveRolePerson(tenantDB, tenantId, relationKey, scope = {}) {
  const aliases = ROLE_ALIASES[relationKey] || [relationKey.toLowerCase()];
  const employee = await firstEmployeeByRoles(tenantDB, tenantId, aliases, scope);
  if (employee) return { employee, user: await findUserForEmployee(tenantDB, tenantId, employee) };
  const user = await firstUserByRoles(tenantDB, tenantId, aliases, scope);
  if (user) return { employee: await findEmployeeForUser(tenantDB, tenantId, user), user };
  return { employee: null, user: null };
}

function makeNode({ relationKey, relationLabel, source, employee, user, scope, level }) {
  const person = employee || user;
  return {
    level,
    relationKey: normalizeRelationKey(relationKey),
    relationLabel: relationLabel || normalizeRelationKey(relationKey).replace(/_/g, ' '),
    employeeId: employee?._id || null,
    userId: user?._id || null,
    role: person?.role || '',
    name: fullName(person),
    email: String(person?.email || '').toLowerCase(),
    source,
    scope: subjectScope({ ...(scope || {}), ...(person || {}) }),
  };
}

function pushUnique(nodes, node, subjectEmployeeId, subjectUserId) {
  if (!node || (!node.employeeId && !node.userId && !node.email)) return;
  if (subjectEmployeeId && node.employeeId && String(node.employeeId) === String(subjectEmployeeId)) return;
  if (subjectUserId && node.userId && String(node.userId) === String(subjectUserId)) return;
  const relationKey = normalizeRelationKey(node.relationKey);
  const personKey = node.employeeId ? `e:${node.employeeId}` : (node.userId ? `u:${node.userId}` : `m:${node.email}`);
  const exists = nodes.some((item) =>
    normalizeRelationKey(item.relationKey) === relationKey &&
    (String(item.employeeId || '') === String(node.employeeId || '') ||
      String(item.userId || '') === String(node.userId || '') ||
      (item.email && item.email === node.email))
  );
  if (exists) return;
  if (nodes.some((item) => `${item.employeeId ? `e:${item.employeeId}` : (item.userId ? `u:${item.userId}` : `m:${item.email}`)}` === personKey && relationKey.startsWith('UPLINE_'))) return;
  nodes.push({ ...node, level: nodes.length + 1 });
}

async function buildEmployeeHierarchy({ tenantDB, tenantId, employeeId, userId, email, actorUserId = null }) {
  const { employee, user } = await resolveSubject({ tenantDB, tenantId, employeeId, userId, email });
  const subject = employee || user;
  if (!subject) {
    const error = new Error('Employee or user not found for hierarchy generation.');
    error.statusCode = 404;
    throw error;
  }

  const EmployeeHierarchy = tenantDB.model('EmployeeHierarchy');
  const Employee = tenantDB.model('Employee');
  const Department = tenantDB.model('Department');
  const Division = tenantDB.model('Division');
  const Branch = tenantDB.model('Branch');
  const subjectTenantId = subject.mainCompanyId || subject.tenant || tenantId;
  const chain = [];

  const directTeamLead = employee?.reportingTeamLead;
  if (directTeamLead) {
    const lead = await personFromEmployeeId(tenantDB, subjectTenantId, directTeamLead);
    if (lead?.employee || lead?.user) {
      pushUnique(chain, makeNode({
        relationKey: 'TEAM_LEAD',
        relationLabel: 'Team Lead',
        source: 'employee_field',
        employee: lead.employee,
        user: lead.user,
      }), employee?._id, user?._id);
    }
  }

  let managerId = employee?.reportingManagerId || employee?.manager || null;
  const visitedManagers = new Set();
  let uplineLevel = 1;
  while (managerId && mongoose.Types.ObjectId.isValid(String(managerId)) && !visitedManagers.has(String(managerId)) && uplineLevel <= 20) {
    visitedManagers.add(String(managerId));
    const manager = await Employee.findOne({
      ...tenantFilter(subjectTenantId),
      _id: managerId,
      isDeleted: { $ne: true },
    }).select('_id firstName lastName email role manager reportingManagerId subCompanyId branchId divisionId departmentId designationId').lean();
    if (!manager) break;

    pushUnique(chain, makeNode({
      relationKey: uplineLevel === 1 ? 'REPORTING_MANAGER' : `UPLINE_${uplineLevel}`,
      relationLabel: uplineLevel === 1 ? 'Reporting Manager' : `Upline Level ${uplineLevel}`,
      source: 'manager_chain',
      employee: manager,
      user: await findUserForEmployee(tenantDB, subjectTenantId, manager),
    }), employee?._id, user?._id);
    managerId = manager.reportingManagerId || manager.manager;
    uplineLevel += 1;
  }

  if (employee?.reportingHR) {
    const hr = await personFromEmployeeId(tenantDB, subjectTenantId, employee.reportingHR);
    pushUnique(chain, makeNode({ relationKey: 'HR', relationLabel: 'Reporting HR', source: 'employee_field', employee: hr?.employee, user: hr?.user }), employee?._id, user?._id);
  }

  if (employee?.reportingHRHead) {
    const hrHead = await personFromEmployeeId(tenantDB, subjectTenantId, employee.reportingHRHead);
    pushUnique(chain, makeNode({ relationKey: 'HR_HEAD', relationLabel: 'HR Head', source: 'employee_field', employee: hrHead?.employee, user: hrHead?.user }), employee?._id, user?._id);
  }

  if (employee?.reportingFinanceHead) {
    const financeHead = await personFromEmployeeId(tenantDB, subjectTenantId, employee.reportingFinanceHead);
    pushUnique(chain, makeNode({ relationKey: 'FINANCE_HEAD', relationLabel: 'Finance Head', source: 'employee_field', employee: financeHead?.employee, user: financeHead?.user }), employee?._id, user?._id);
  }

  if (employee?.reportingCEO) {
    const ceo = await personFromEmployeeId(tenantDB, subjectTenantId, employee.reportingCEO);
    pushUnique(chain, makeNode({ relationKey: 'CEO', relationLabel: 'CEO', source: 'employee_field', employee: ceo?.employee, user: ceo?.user }), employee?._id, user?._id);
  }

  if (subject.departmentId) {
    const department = await Department.findById(subject.departmentId).select('departmentHeadId headEmployeeId').lean();
    const headId = department?.departmentHeadId || department?.headEmployeeId;
    if (headId) {
      const head = await personFromEmployeeId(tenantDB, subjectTenantId, headId);
      pushUnique(chain, makeNode({ relationKey: 'DEPARTMENT_HEAD', relationLabel: 'Department Head', source: 'department_head', employee: head?.employee, user: head?.user }), employee?._id, user?._id);
    }
  }

  if (subject.divisionId) {
    const division = await Division.findById(subject.divisionId).select('divisionHeadId headEmployeeId').lean();
    const headId = division?.divisionHeadId || division?.headEmployeeId;
    if (headId) {
      const head = await personFromEmployeeId(tenantDB, subjectTenantId, headId);
      pushUnique(chain, makeNode({ relationKey: 'DIVISION_HEAD', relationLabel: 'Division Head', source: 'division_head', employee: head?.employee, user: head?.user }), employee?._id, user?._id);
    }
  }

  if (subject.branchId) {
    const branch = await Branch.findById(subject.branchId).select('branchHeadId headEmployeeId').lean();
    const headId = branch?.branchHeadId || branch?.headEmployeeId;
    if (headId) {
      const head = await personFromEmployeeId(tenantDB, subjectTenantId, headId);
      pushUnique(chain, makeNode({ relationKey: 'BRANCH_HEAD', relationLabel: 'Branch Head', source: 'branch_head', employee: head?.employee, user: head?.user }), employee?._id, user?._id);
    }
  }

  for (const relationKey of ['HR', 'HR_HEAD', 'FINANCE', 'FINANCE_HEAD', 'CEO']) {
    const scopedForRole = ['HR', 'HR_HEAD', 'CEO'].includes(relationKey)
      ? { subCompanyId: subject.subCompanyId || null }
      : { subCompanyId: subject.subCompanyId || null, branchId: subject.branchId || null };
    const rolePerson = await resolveRolePerson(tenantDB, subjectTenantId, relationKey, scopedForRole);
    pushUnique(chain, makeNode({
      relationKey,
      relationLabel: relationKey.replace(/_/g, ' '),
      source: 'role_lookup',
      employee: rolePerson.employee,
      user: rolePerson.user,
      scope: scopedForRole,
    }), employee?._id, user?._id);
  }

  const payload = {
    tenantId: subjectTenantId,
    subjectEmployeeId: employee?._id || null,
    subjectUserId: user?._id || null,
    subjectEmail: String(subject.email || '').toLowerCase(),
    subjectName: fullName(subject),
    subjectRole: subject.role || '',
    subjectScope: subjectScope(subject),
    chain,
    sourceSnapshot: {
      manager: employee?.manager || null,
      reportingManagerId: employee?.reportingManagerId || null,
      reportingTeamLead: employee?.reportingTeamLead || null,
      reportingHR: employee?.reportingHR || null,
      reportingHRHead: employee?.reportingHRHead || null,
      reportingFinanceHead: employee?.reportingFinanceHead || null,
      reportingCEO: employee?.reportingCEO || null,
    },
    generatedAt: new Date(),
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    updatedBy: actorUserId,
  };

  const selector = {
    tenantId: subjectTenantId,
    isActive: true,
    isDeleted: { $ne: true },
    ...(employee?._id ? { subjectEmployeeId: employee._id } : { subjectUserId: user._id }),
  };

  const hierarchy = await EmployeeHierarchy.findOneAndUpdate(
    selector,
    { $set: payload, $setOnInsert: { createdBy: actorUserId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return hierarchy;
}

async function getEmployeeHierarchy({ tenantDB, tenantId, employeeId, userId, email, rebuild = false, actorUserId = null }) {
  const EmployeeHierarchy = tenantDB.model('EmployeeHierarchy');
  const query = {
    tenantId,
    isActive: true,
    isDeleted: { $ne: true },
  };
  if (employeeId) query.subjectEmployeeId = employeeId;
  else if (userId) query.subjectUserId = userId;
  else if (email) query.subjectEmail = String(email).toLowerCase();

  let hierarchy = !rebuild ? await EmployeeHierarchy.findOne(query).lean() : null;
  if (!hierarchy) {
    hierarchy = await buildEmployeeHierarchy({ tenantDB, tenantId, employeeId, userId, email, actorUserId });
  }
  return hierarchy;
}

async function resolveApproversFromHierarchy({ tenantDB, tenantId, employeeId, relationKey }) {
  const normalizedRelation = normalizeRelationKey(relationKey);
  if (!employeeId || !normalizedRelation) return [];
  const hierarchy = await getEmployeeHierarchy({
    tenantDB,
    tenantId,
    employeeId,
    rebuild: false,
  }).catch(() => null);
  if (!hierarchy?.chain?.length) return [];

  const effectiveRelation = normalizedRelation === 'MANAGER' ? 'REPORTING_MANAGER' : normalizedRelation;
  const matches = hierarchy.chain.filter((node) => normalizeRelationKey(node.relationKey) === effectiveRelation);
  return matches
    .map((node) => node.employeeId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
}

module.exports = {
  buildEmployeeHierarchy,
  getEmployeeHierarchy,
  normalizeRelationKey,
  resolveApproversFromHierarchy,
};
