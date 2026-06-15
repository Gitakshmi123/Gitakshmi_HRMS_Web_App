const mongoose = require('mongoose');
const { normalizeHierarchyRole, getMainCompanyId } = require('../middleware/hierarchy.middleware');
const {
  buildEmployeeHierarchy,
  getEmployeeHierarchy,
} = require('../services/employeeHierarchy.service');

const ROLE_ORDER = {
  SUPER_ADMIN: 7,
  MAIN_COMPANY_ADMIN: 6,
  SUB_COMPANY_ADMIN: 5,
  BRANCH_HEAD: 4,
  DIVISION_HEAD: 3,
  DEPARTMENT_HEAD: 2,
  EMPLOYEE: 1
};

function ok(res, data, message = 'Success') {
  return res.json({ success: true, data, message });
}

function fail(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, message, statusCode });
}

function model(req, name) {
  return req.tenantDB?.model(name) || mongoose.model(name);
}

function cleanObjectId(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

function abbr(value, len = 3) {
  const words = String(value || '')
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  const letters = words.length > 1
    ? words.map((w) => w[0]).join('')
    : String(words[0] || 'GT').slice(0, len);
  return (letters || 'GT').toUpperCase().slice(0, len);
}

async function nextCode(req, key, prefix, width = 3) {
  const Counter = model(req, 'Counter');
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 }, $setOnInsert: { key } },
    { new: true, upsert: true }
  ).lean();
  return `${prefix}-${String(counter.seq).padStart(width, '0')}`;
}

async function tenantCode(mainCompanyId) {
  if (!cleanObjectId(mainCompanyId)) return 'GT';
  const tenant = await mongoose.model('Tenant').findById(mainCompanyId).select('code tenantCode companyName name').lean();
  return abbr(tenant?.code || tenant?.tenantCode || tenant?.companyName || tenant?.name || 'GT', 3);
}

async function getTenantForScope(req) {
  const mainCompanyId = getMainCompanyId(req);
  const Tenant = mongoose.model('Tenant');
  if (cleanObjectId(mainCompanyId)) {
    const tenant = await Tenant.findById(mainCompanyId).select('_id companyName name code subCompanyLimit').lean();
    if (tenant) return tenant;
  }
  const companyCode = req.user?.companyCode || req.headers?.['x-company-code'];
  if (companyCode) {
    return Tenant.findOne({
      $or: [
        { code: { $regex: new RegExp(`^${String(companyCode).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { tenantId: companyCode }
      ]
    }).select('_id companyName name code subCompanyLimit').lean();
  }
  return null;
}

function userScope(req) {
  const role = normalizeHierarchyRole(req.user?.role);
  return {
    role,
    mainCompanyId: getMainCompanyId(req),
    subCompanyId: req.user?.subCompanyId || null,
    branchId: req.user?.branchId || null,
    divisionId: req.user?.divisionId || null,
    departmentId: req.user?.departmentId || null,
    userId: req.user?.userId || req.user?.id || req.user?._id || null
  };
}

function scopedFilterForModel(req, modelName, extra = {}) {
  const scope = userScope(req);
  if (scope.role === 'SUPER_ADMIN') return { isDeleted: { $ne: true }, ...extra };
  
  const tenantId = scope.mainCompanyId;
  const base = { 
    isDeleted: { $ne: true }, 
    $or: [
      { mainCompanyId: tenantId },
      { tenant: tenantId }
    ],
    ...extra 
  };
  const applyRestrictedId = (restrictedId) => {
    if (!restrictedId) return;
    if (extra._id && String(extra._id) !== String(restrictedId)) {
      base._id = new mongoose.Types.ObjectId('000000000000000000000000');
      return;
    }
    base._id = restrictedId;
  };

  if (modelName === 'SubCompany' && scope.subCompanyId) applyRestrictedId(scope.subCompanyId);
  if (modelName === 'Branch' && scope.branchId) applyRestrictedId(scope.branchId);
  if (modelName === 'Division' && scope.divisionId) applyRestrictedId(scope.divisionId);
  if (modelName === 'Department' && scope.departmentId) applyRestrictedId(scope.departmentId);
  if (modelName === 'Employee' && scope.role === 'EMPLOYEE') applyRestrictedId(scope.userId);

  if (modelName !== 'SubCompany' && scope.subCompanyId) base.subCompanyId = scope.subCompanyId;
  if (!['SubCompany', 'Branch'].includes(modelName) && scope.branchId) base.branchId = scope.branchId;
  if (!['SubCompany', 'Branch', 'Division'].includes(modelName) && scope.divisionId) base.divisionId = scope.divisionId;
  if (['Designation', 'Employee'].includes(modelName) && scope.departmentId) base.departmentId = scope.departmentId;
  return base;
}

async function findScoped(req, modelName, id, extra = {}) {
  const Model = model(req, modelName);
  if (!cleanObjectId(id)) return null;
  return Model.findOne(scopedFilterForModel(req, modelName, { _id: id, ...extra }));
}

function requireRoleLevel(req, minimumRole) {
  const current = normalizeHierarchyRole(req.user?.role);
  return (ROLE_ORDER[current] || 0) >= (ROLE_ORDER[minimumRole] || 0);
}

async function assignHeadIfRequested(req, entity, entityType, body) {
  const type = body.headType || body.adminType || body.adminAssignmentType;
  const employeeId = body.employeeId || body.headEmployeeId;
  const name = body.headName || body.adminName || body.name;
  const email = body.headEmail || body.adminEmail;
  if (!type && !employeeId && !email) return null;

  const roleByEntity = {
    subCompany: 'SUB_COMPANY_ADMIN',
    branch: 'BRANCH_HEAD',
    division: 'DIVISION_HEAD',
    department: 'DEPARTMENT_HEAD'
  };
  const Employee = model(req, 'Employee');
  let employee = null;

  if (type === 'existing' || employeeId) {
    employee = await Employee.findOne(scopedFilterForModel(req, 'Employee', { _id: employeeId }));
    if (!employee) {
      const err = new Error('Employee not found');
      err.status = 404;
      throw err;
    }
  } else if (email) {
    const employeeCode = await nextCode(req, `employee:${entity.mainCompanyId}:${entity.branchId || 'main'}`, `${abbr(body.city || entity.name || 'GT', 3)}-EMP`, 4);
    employee = await Employee.create({
      firstName: name || email.split('@')[0],
      email,
      password: body.password || body.adminPassword || 'Welcome@123',
      employeeId: employeeCode,
      employeeCode,
      role: roleByEntity[entityType],
      mainCompanyId: entity.mainCompanyId,
      subCompanyId: entity.subCompanyId || null,
      branchId: entity.branchId || (entityType === 'branch' ? entity._id : null),
      divisionId: entity.divisionId || (entityType === 'division' ? entity._id : null),
      departmentId: entity.departmentId || (entityType === 'department' ? entity._id : null),
      createdBy: req.user?.id || null
    });
  }

  if (!employee) return null;
  employee.role = roleByEntity[entityType];
  employee.mainCompanyId = entity.mainCompanyId;
  if (entity.subCompanyId || entityType === 'subCompany') employee.subCompanyId = entityType === 'subCompany' ? entity._id : entity.subCompanyId;
  if (entity.branchId || entityType === 'branch') employee.branchId = entityType === 'branch' ? entity._id : entity.branchId;
  if (entity.divisionId || entityType === 'division') employee.divisionId = entityType === 'division' ? entity._id : entity.divisionId;
  if (entity.departmentId || entityType === 'department') employee.departmentId = entityType === 'department' ? entity._id : entity.departmentId;
  await employee.save();

  if (employee.email) {
    try {
      const User = mongoose.model('User');
      await User.findOneAndUpdate(
        {
          mainCompanyId: entity.mainCompanyId,
          email: { $regex: new RegExp(`^${String(employee.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        },
        {
          $set: {
            name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email,
            role: roleByEntity[entityType],
            mainCompanyId: entity.mainCompanyId,
            subCompanyId: employee.subCompanyId || null,
            branchId: employee.branchId || null,
            divisionId: employee.divisionId || null,
            departmentId: employee.departmentId || null,
            designationId: employee.designationId || null,
            employeeCode: employee.employeeCode || employee.employeeId || null,
            isActive: employee.isActive !== false
          },
          $setOnInsert: {
            email: employee.email,
            password: body.password || body.adminPassword || employee.password || 'Welcome@123',
            createdBy: req.user?.id || null
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (_) {
      // Employee auth remains valid even if the optional central User mirror already conflicts.
    }
  }
  return employee._id;
}

exports.createSubCompany = async (req, res) => {
  try {
    const mainCompanyId = getMainCompanyId(req);
    const SubCompany = model(req, 'SubCompany');
    const name = req.body.name || req.body.companyName;
    const tenant = await getTenantForScope(req);
    const limit = Number(tenant?.subCompanyLimit || 0);
    const mainCode = await tenantCode(mainCompanyId);
    const subCompanyCode = req.body.subCompanyCode || await nextCode(req, `subCompany:${mainCompanyId}:${abbr(name, 4)}`, `${mainCode}-${abbr(name, 4)}`);
    const subCompany = await SubCompany.create({
      companyName: name,
      name,
      subCompanyCode,
      entityCode: subCompanyCode,
      email: req.body.email || req.body.adminEmail || `${subCompanyCode.toLowerCase()}@example.com`,
      phone: req.body.phone,
      gstNumber: req.body.gstNumber,
      address: req.body.address,
      logo: req.body.logo,
      mainCompanyId
    });
    const adminId = await assignHeadIfRequested(req, subCompany, 'subCompany', req.body);
    if (adminId) {
      subCompany.adminEmployeeId = adminId;
      subCompany.subCompanyAdminId = adminId;
      await subCompany.save();
    }
    return ok(res.status(201), subCompany, 'Sub company created');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

exports.createBranch = async (req, res) => {
  try {
    const Branch = model(req, 'Branch');
    const mainCompanyId = getMainCompanyId(req);
    const mainCode = await tenantCode(mainCompanyId);
    const city = req.body.city || req.body.name;
    const branchCode = req.body.branchCode || req.body.code || await nextCode(req, `branch:${mainCompanyId}:${req.body.subCompanyId || 'main'}:${abbr(city)}`, `${abbr(mainCode, 2)}-${abbr(city)}-BR`);
    const branch = await Branch.create({
      ...req.body,
      branchCode,
      entityCode: branchCode,
      mainCompanyId
    });
    const headId = await assignHeadIfRequested(req, branch, 'branch', req.body);
    if (headId) {
      branch.headEmployeeId = headId;
      branch.branchHeadId = headId;
      await branch.save();
    }
    return ok(res.status(201), branch, 'Branch created');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

exports.createDivision = async (req, res) => {
  try {
    const Division = model(req, 'Division');
    const branch = await findScoped(req, 'Branch', req.body.branchId);
    if (!branch) return fail(res, 404, 'Branch not found');
    const code = req.body.divisionCode || req.body.code || await nextCode(req, `division:${branch._id}:${abbr(req.body.name)}`, `${branch.branchCode || 'GT-BR'}-DIV-${abbr(req.body.name)}`);
    const division = await Division.create({
      ...req.body,
      code,
      divisionCode: code,
      entityCode: code,
      mainCompanyId: branch.mainCompanyId,
      subCompanyId: branch.subCompanyId,
      branchId: branch._id
    });
    const headId = await assignHeadIfRequested(req, division, 'division', req.body);
    if (headId) {
      division.headEmployeeId = headId;
      division.divisionHeadId = headId;
      await division.save();
    }
    return ok(res.status(201), division, 'Division created');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const Department = model(req, 'Department');
    const division = await findScoped(req, 'Division', req.body.divisionId);
    if (!division) return fail(res, 404, 'Division not found');
    const code = req.body.departmentCode || req.body.code || await nextCode(req, `department:${division._id}:${abbr(req.body.name)}`, `${division.divisionCode || division.code || 'GT-DIV'}-DEP-${abbr(req.body.name)}`);
    const department = await Department.create({
      ...req.body,
      code,
      departmentCode: code,
      entityCode: code,
      mainCompanyId: division.mainCompanyId,
      subCompanyId: division.subCompanyId,
      branchId: division.branchId,
      divisionId: division._id
    });
    const headId = await assignHeadIfRequested(req, department, 'department', req.body);
    if (headId) {
      department.headEmployeeId = headId;
      department.departmentHeadId = headId;
      await department.save();
    }
    return ok(res.status(201), department, 'Department created');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

exports.createDesignation = async (req, res) => {
  try {
    const Designation = model(req, 'Designation');
    const department = await findScoped(req, 'Department', req.body.departmentId);
    if (!department) return fail(res, 404, 'Department not found');
    const title = req.body.title || req.body.name;
    const code = req.body.designationCode || req.body.code || await nextCode(req, `designation:${department._id}:${abbr(title)}`, `${department.departmentCode || department.code || 'GT-DEP'}-DES-${abbr(title)}`);
    const designation = await Designation.create({
      ...req.body,
      name: req.body.name || title,
      title,
      code,
      designationCode: code,
      entityCode: code,
      mainCompanyId: department.mainCompanyId,
      subCompanyId: department.subCompanyId,
      branchId: department.branchId,
      divisionId: department.divisionId,
      departmentId: department._id
    });
    return ok(res.status(201), designation, 'Designation created');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

const listHierarchy = (modelName) => async (req, res) => {
  try {
    const data = await model(req, modelName).find(scopedFilterForModel(req, modelName)).select('-password').lean();
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

const getHierarchy = (modelName) => async (req, res) => {
  try {
    const item = await findScoped(req, modelName, req.params.id);
    if (!item) return fail(res, 404, `${modelName} not found`);
    return ok(res, item);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

const updateHierarchy = (modelName, entityType, allowedFields) => async (req, res) => {
  try {
    const item = await findScoped(req, modelName, req.params.id);
    if (!item) return fail(res, 404, `${modelName} not found`);
    
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) item[field] = req.body[field];
    });

    // Handle Head Assignment on Update
    const headId = await assignHeadIfRequested(req, item, entityType, req.body);
    if (headId) {
      const headField = entityType === 'subCompany' ? 'adminEmployeeId' : (entityType + 'HeadId');
      const legacyHeadField = entityType === 'subCompany' ? 'subCompanyAdminId' : 'headEmployeeId';
      item[headField] = headId;
      item[legacyHeadField] = headId;
    }

    await item.save();

    // Cache Invalidation and User Collection Sync (for Employee updates)
    if (modelName === 'Employee' && item.email) {
      try {
        const cache = require('../utils/permissionCache');
        const User = mongoose.model('User');
        const tenantId = item.mainCompanyId || req.tenantId;

        // 1. Invalidate cache
        cache.invalidate(tenantId, String(item._id));
        cache.invalidate(tenantId, item.email);

        // 2. Sync with User collection
        await User.findOneAndUpdate(
          {
            mainCompanyId: tenantId,
            email: { $regex: new RegExp(`^${String(item.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          },
          {
            $set: {
              role: item.role,
              isActive: item.status === 'ACTIVE' || item.status === 'Active' || item.status === 'active' || item.isActive !== false,
              name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email,
              subCompanyId: item.subCompanyId || null,
              branchId: item.branchId || null,
              divisionId: item.divisionId || null,
              departmentId: item.departmentId || null,
              designationId: item.designationId || null,
            }
          }
        );
      } catch (syncErr) {
        console.error("[updateHierarchy] Sync/Cache Invalidation Failed:", syncErr.message);
      }
    }

    // Re-fetch or normalize to include head details for the frontend
    const updated = await model(req, modelName).findById(item._id).lean();
    const Employee = model(req, 'Employee');
    const User = mongoose.model('User');

    let head = null;
    const finalHeadId = updated.adminEmployeeId || updated.headEmployeeId || updated.branchHeadId || updated.divisionHeadId || updated.departmentHeadId;
    
    if (finalHeadId) {
      const emp = await Employee.findById(finalHeadId).select('firstName lastName email').lean();
      if (emp) head = { name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email, email: emp.email };
      if (!head) {
        const user = await User.findById(finalHeadId).select('name email').lean();
        if (user) head = { name: user.name || user.email, email: user.email };
      }
    }

    if (!head) {
      const roleByEntity = {
        subCompany: ['SUB_COMPANY_ADMIN', 'sub_company_admin'],
        branch: ['BRANCH_HEAD', 'branch_head'],
        division: ['DIVISION_HEAD', 'division_head'],
        department: ['DEPARTMENT_HEAD', 'department_head']
      };
      const scopeFieldByEntity = {
        subCompany: 'subCompanyId',
        branch: 'branchId',
        division: 'divisionId',
        department: 'departmentId'
      };
      const roles = roleByEntity[entityType] || [];
      const scopeField = scopeFieldByEntity[entityType];
      if (scopeField && roles.length) {
        const user = await User.findOne({
          [scopeField]: updated._id,
          role: { $in: roles },
          isActive: { $ne: false }
        }).select('name email').lean();
        if (user) head = { name: user.name || user.email, email: user.email };
      }
    }

    const data = {
      ...updated,
      headName: head?.name || 'Not Assigned',
      headEmail: head?.email
    };

    return ok(res, data, `${modelName} updated`);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.listSubCompanies = listHierarchy('SubCompany');
exports.listBranches = listHierarchy('Branch');
exports.listDivisions = listHierarchy('Division');
exports.listDepartments = listHierarchy('Department');
exports.listDesignations = listHierarchy('Designation');
exports.listEmployees = listHierarchy('Employee');

exports.getSubCompany = getHierarchy('SubCompany');
exports.getBranch = getHierarchy('Branch');
exports.getDivision = getHierarchy('Division');
exports.getDepartment = getHierarchy('Department');
exports.getDesignation = getHierarchy('Designation');
exports.getEmployee = getHierarchy('Employee');

const deleteHierarchy = (modelName) => async (req, res) => {
  try {
    const item = await findScoped(req, modelName, req.params.id);
    if (!item) return fail(res, 404, `${modelName} not found`);
    
    // Soft delete
    item.isDeleted = true;
    item.deletedAt = new Date();
    await item.save();
    
    return ok(res, null, `${modelName} deleted successfully`);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.deleteSubCompany = deleteHierarchy('SubCompany');
exports.deleteBranch = deleteHierarchy('Branch');
exports.deleteDivision = deleteHierarchy('Division');
exports.deleteDepartment = deleteHierarchy('Department');
exports.deleteDesignation = deleteHierarchy('Designation');
exports.deleteEmployee = deleteHierarchy('Employee');

exports.updateSubCompany = updateHierarchy('SubCompany', 'subCompany', ['companyName', 'name', 'email', 'phone', 'gstNumber', 'address', 'logo', 'isActive', 'subCompanyAdminId']);
exports.updateBranch = updateHierarchy('Branch', 'branch', ['name', 'address', 'city', 'state', 'country', 'contactPerson', 'contactPhone', 'contactEmail', 'isActive', 'branchHeadId']);
exports.updateDivision = updateHierarchy('Division', 'division', ['name', 'isActive', 'divisionHeadId']);
exports.updateDepartment = updateHierarchy('Department', 'department', ['name', 'description', 'budgetedHeadcount', 'isActive', 'departmentHeadId']);
exports.updateDesignation = updateHierarchy('Designation', 'designation', ['name', 'title', 'isActive']);
exports.updateEmployee = updateHierarchy('Employee', 'employee', [
  'firstName', 'middleName', 'lastName', 'email', 'contactNo', 
  'designationId', 'isActive', 'status', 'profilePic', 'gender', 
  'dob', 'maritalStatus', 'bloodGroup', 'nationality', 'joiningDate', 
  'employeeId', 'reportingManagerId', 'manager', 'departmentId', 'shiftId', 'leavePolicy',
  'reportingTeamLead', 'reportingHR', 'reportingHRHead', 'reportingFinanceHead', 'reportingCEO'
]);

exports.createEmployee = async (req, res) => {
  try {
    if (!requireRoleLevel(req, 'DEPARTMENT_HEAD')) return fail(res, 403, 'Forbidden');
    const Employee = model(req, 'Employee');
    const designation = await findScoped(req, 'Designation', req.body.designationId);
    if (!designation) return fail(res, 404, 'Designation not found');
    const employeeCode = req.body.employeeCode || req.body.employeeId || await nextCode(req, `employee:${designation.mainCompanyId}:${designation.branchId}`, `${abbr(designation.entityCode || designation.designationCode || 'GT', 6)}-EMP`, 4);
    const fullName = String(req.body.fullName || req.body.name || '').trim();
    const [firstName, ...lastParts] = fullName.split(/\s+/).filter(Boolean);
    const employee = await Employee.create({
      ...req.body,
      firstName: req.body.firstName || firstName || req.body.email,
      lastName: req.body.lastName || lastParts.join(' '),
      contactNo: req.body.contactNo || req.body.phone,
      employeeId: employeeCode,
      employeeCode,
      role: req.body.role || 'EMPLOYEE',
      mainCompanyId: designation.mainCompanyId,
      subCompanyId: designation.subCompanyId,
      branchId: designation.branchId,
      divisionId: designation.divisionId,
      departmentId: designation.departmentId,
      designationId: designation._id,
      createdBy: req.user?.id || null
    });
    return ok(res.status(201), employee, 'Employee created');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

exports.assignRole = async (req, res) => {
  try {
    const actorRole = normalizeHierarchyRole(req.user?.role);
    const { newRole, entityId } = req.body;
    const targetRole = normalizeHierarchyRole(newRole);
    const allowed = {
      MAIN_COMPANY_ADMIN: ['SUB_COMPANY_ADMIN'],
      SUB_COMPANY_ADMIN: ['BRANCH_HEAD'],
      BRANCH_HEAD: ['DIVISION_HEAD'],
      DIVISION_HEAD: ['DEPARTMENT_HEAD']
    };
    if (!(allowed[actorRole] || []).includes(targetRole)) return fail(res, 403, 'Forbidden');

    const entityByRole = {
      SUB_COMPANY_ADMIN: ['SubCompany', 'subCompanyId', 'subCompanyAdminId'],
      BRANCH_HEAD: ['Branch', 'branchId', 'branchHeadId'],
      DIVISION_HEAD: ['Division', 'divisionId', 'divisionHeadId'],
      DEPARTMENT_HEAD: ['Department', 'departmentId', 'departmentHeadId']
    };
    const [entityModel, employeeField, headField] = entityByRole[targetRole];
    const entity = await findScoped(req, entityModel, entityId);
    if (!entity) return fail(res, 404, 'Target entity not found');

    const Employee = model(req, 'Employee');
    const employee = await Employee.findOne(scopedFilterForModel(req, 'Employee', { _id: req.params.employeeId || req.params.id }));
    if (!employee) return fail(res, 404, 'Employee not found');

    employee.role = targetRole;
    employee.mainCompanyId = entity.mainCompanyId;
    employee.subCompanyId = entityModel === 'SubCompany' ? entity._id : entity.subCompanyId;
    employee.branchId = entityModel === 'Branch' ? entity._id : entity.branchId;
    employee.divisionId = entityModel === 'Division' ? entity._id : entity.divisionId;
    employee.departmentId = entityModel === 'Department' ? entity._id : entity.departmentId;
    employee[employeeField] = entity._id;
    await employee.save();

    entity[headField] = employee._id;
    if (entity.headEmployeeId !== undefined) entity.headEmployeeId = employee._id;
    if (entity.adminEmployeeId !== undefined) entity.adminEmployeeId = employee._id;
    await entity.save();
    if (employee.email) {
      try {
        await mongoose.model('User').findOneAndUpdate(
          {
            mainCompanyId: entity.mainCompanyId,
            email: { $regex: new RegExp(`^${String(employee.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          },
          {
            $set: {
              role: targetRole,
              mainCompanyId: entity.mainCompanyId,
              subCompanyId: employee.subCompanyId || null,
              branchId: employee.branchId || null,
              divisionId: employee.divisionId || null,
              departmentId: employee.departmentId || null,
              designationId: employee.designationId || null,
              employeeCode: employee.employeeCode || employee.employeeId || null,
              isActive: employee.isActive !== false
            }
          }
        );
      } catch (_) {}
    }
    return ok(res, employee, 'Role assigned');
  } catch (err) {
    return fail(res, err.status || 500, err.message);
  }
};

exports.getHierarchyTree = async (req, res) => {
  try {
    const [subCompanies, branches, divisions, departments, designations, employees] = await Promise.all([
      model(req, 'SubCompany').find(scopedFilterForModel(req, 'SubCompany')).populate('adminEmployeeId').lean(),
      model(req, 'Branch').find(scopedFilterForModel(req, 'Branch')).populate('headEmployeeId').lean(),
      model(req, 'Division').find(scopedFilterForModel(req, 'Division')).populate('headEmployeeId').lean(),
      model(req, 'Department').find(scopedFilterForModel(req, 'Department')).populate('headEmployeeId').lean(),
      model(req, 'Designation').find(scopedFilterForModel(req, 'Designation')).lean(),
      model(req, 'Employee').find(scopedFilterForModel(req, 'Employee')).lean()
    ]);

    const normalizeHead = (item) => {
      const head = item.adminEmployeeId || item.headEmployeeId || item.branchHeadId || item.divisionHeadId || item.departmentHeadId;
      if (head && typeof head === 'object') {
        item.headName = `${head.firstName || ''} ${head.lastName || ''}`.trim() || head.email;
        item.headEmail = head.email;
        item.headEmployeeId = head._id;
      }
      return item;
    };

    const tree = subCompanies.map((sub) => ({
      ...normalizeHead(sub),
      type: 'subcompany',
      children: branches
        .filter((branch) => String(branch.subCompanyId || '') === String(sub._id || ''))
        .map((branch) => ({
          ...normalizeHead(branch),
          type: 'branch',
          children: divisions
            .filter((division) => String(division.branchId || '') === String(branch._id || ''))
            .map((division) => ({
              ...normalizeHead(division),
              type: 'division',
              children: departments
                .filter((department) => String(department.divisionId || '') === String(division._id || ''))
                .map((department) => ({
                  ...normalizeHead(department),
                  type: 'department',
                  children: designations
                    .filter((designation) => String(designation.departmentId || '') === String(department._id || ''))
                    .map((designation) => ({
                      ...designation,
                      type: 'designation',
                      children: employees
                        .filter((employee) => String(employee.designationId || '') === String(designation._id || ''))
                        .map((employee) => ({ ...employee, type: 'employee', children: [] }))
                    }))
                }))
            }))
        }))
    }));
    return ok(res, tree);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const role = normalizeHierarchyRole(req.user?.role);
    const tenant = await getTenantForScope(req);
    const [subCompanies, branches, divisions, departments, designations, employees] = await Promise.all([
      model(req, 'SubCompany').countDocuments(scopedFilterForModel(req, 'SubCompany')),
      model(req, 'Branch').countDocuments(scopedFilterForModel(req, 'Branch')),
      model(req, 'Division').countDocuments(scopedFilterForModel(req, 'Division')),
      model(req, 'Department').countDocuments(scopedFilterForModel(req, 'Department')),
      model(req, 'Designation').countDocuments(scopedFilterForModel(req, 'Designation')),
      model(req, 'Employee').countDocuments(scopedFilterForModel(req, 'Employee'))
    ]);
    const stats = { role, subCompanies, branches, divisions, departments, designations, employees };
    return res.json({
      success: true,
      stats: { created: subCompanies, totalBranches: branches, totalEmployees: employees, ...stats },
      data: stats,
      message: 'Success'
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

function actorUserId(req) {
  const value = req.user?.id || req.user?._id || req.user?.userId;
  return value && mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

exports.getEmployeeReportingChain = async (req, res) => {
  try {
    const tenantId = getMainCompanyId(req);
    const id = cleanObjectId(req.params.employeeId || req.params.id);
    if (!id) return fail(res, 400, 'Valid employee id is required');

    const data = await getEmployeeHierarchy({
      tenantDB: req.tenantDB,
      tenantId,
      employeeId: req.query.type === 'user' ? null : id,
      userId: req.query.type === 'user' ? id : null,
      rebuild: String(req.query.rebuild || '').toLowerCase() === 'true',
      actorUserId: actorUserId(req),
    });
    return ok(res, data, 'Employee reporting chain resolved');
  } catch (err) {
    return fail(res, err.statusCode || err.status || 500, err.message);
  }
};

exports.rebuildEmployeeReportingChain = async (req, res) => {
  try {
    const tenantId = getMainCompanyId(req);
    const id = cleanObjectId(req.params.employeeId || req.params.id);
    if (!id) return fail(res, 400, 'Valid employee id is required');

    const data = await buildEmployeeHierarchy({
      tenantDB: req.tenantDB,
      tenantId,
      employeeId: req.body.type === 'user' ? null : id,
      userId: req.body.type === 'user' ? id : null,
      actorUserId: actorUserId(req),
    });
    return ok(res, data, 'Employee reporting chain rebuilt');
  } catch (err) {
    return fail(res, err.statusCode || err.status || 500, err.message);
  }
};

exports.rebuildAllEmployeeReportingChains = async (req, res) => {
  try {
    const tenantId = getMainCompanyId(req);
    const Employee = model(req, 'Employee');
    const employees = await Employee.find({
      $or: [{ mainCompanyId: tenantId }, { tenant: tenantId }],
      isDeleted: { $ne: true },
    }).select('_id').lean();

    const results = [];
    for (const employee of employees) {
      try {
        const hierarchy = await buildEmployeeHierarchy({
          tenantDB: req.tenantDB,
          tenantId,
          employeeId: employee._id,
          actorUserId: actorUserId(req),
        });
        results.push({ employeeId: employee._id, ok: true, chainLength: hierarchy.chain?.length || 0 });
      } catch (error) {
        results.push({ employeeId: employee._id, ok: false, error: error.message });
      }
    }

    return ok(res, {
      total: results.length,
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    }, 'Employee reporting chains rebuilt');
  } catch (err) {
    return fail(res, err.statusCode || err.status || 500, err.message);
  }
};
