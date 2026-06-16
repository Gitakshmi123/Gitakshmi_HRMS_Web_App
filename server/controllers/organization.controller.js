const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function getModel(req, name) {
  return req.tenantDB?.model(name) || mongoose.model(name);
}

function roleOf(req) {
  return String(req.user?.role || '').trim().toUpperCase();
}

function mainCompanyIdOf(req) {
  return req.user?.mainCompanyId || req.user?.tenantId || req.user?.companyId || req.tenantId;
}

function id(value) {
  return value && mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message, statusCode: status });
}

function ok(res, data, message = 'Success') {
  return res.json({ success: true, data, message });
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roleVariants(role) {
  const raw = String(role || '').trim();
  const lower = raw.toLowerCase();
  return [...new Set([raw, raw.toUpperCase(), lower])].filter(Boolean);
}

function formatEmployeeName(employee) {
  if (!employee) return '';
  return employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || '';
}

async function findUserAcrossStores(req, query, select = 'name email role') {
  const candidates = [];
  try {
    const TenantUser = getModel(req, 'User');
    candidates.push(TenantUser);
  } catch (_) {
    // ignore
  }
  try {
    candidates.push(mongoose.model('User'));
  } catch (_) {
    try {
      candidates.push(mongoose.model('User', require('../models/User')));
    } catch (_err) {
      // ignore
    }
  }

  const seen = new Set();
  for (const UserModel of candidates) {
    if (!UserModel?.modelName) continue;
    const key = `${UserModel.db?.name || 'default'}:${UserModel.modelName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const user = await UserModel.findOne(query).select(select).lean();
    if (user) return user;
  }
  return null;
}

async function resolveHierarchyHead(req, options) {
  const {
    role,
    scopeField,
    scopeId,
    headId,
    fallbackEmail,
  } = options;

  const Employee = getModel(req, 'Employee');
  const roles = roleVariants(role);
  const mainCompanyId = mainCompanyIdOf(req);

  if (headId) {
    const [employee, user] = await Promise.all([
      Employee.findById(headId).select('firstName lastName name email role').lean().catch(() => null),
      findUserAcrossStores(req, { _id: headId }, 'name email role').catch(() => null),
    ]);
    if (employee) return { name: formatEmployeeName(employee), email: employee.email };
    if (user) return { name: user.name || user.email, email: user.email };
  }

  if (scopeField && scopeId) {
    const query = {
      [scopeField]: scopeId,
      role: { $in: roles },
      isActive: { $ne: false },
    };
    const user = await findUserAcrossStores(req, query, 'name email role').catch(() => null);
    if (user) return { name: user.name || user.email, email: user.email };

    const employee = await Employee.findOne(query).select('firstName lastName name email role').lean().catch(() => null);
    if (employee) return { name: formatEmployeeName(employee), email: employee.email };
  }

  if (fallbackEmail) {
    const emailRx = new RegExp(`^${escapeRegex(fallbackEmail)}$`, 'i');
    const emailQuery = {
      email: { $regex: emailRx },
      isActive: { $ne: false },
      $or: [
        { mainCompanyId },
        { tenantId: mainCompanyId },
        { companyId: mainCompanyId },
        { mainCompanyId: { $exists: false } },
      ],
    };
    const user = await findUserAcrossStores(req, emailQuery, 'name email role').catch(() => null);
    if (user) return { name: user.name || user.email, email: user.email };

    const employee = await Employee.findOne(emailQuery).select('firstName lastName name email role').lean().catch(() => null);
    if (employee) return { name: formatEmployeeName(employee), email: employee.email };
  }

  return null;
}

function abbrev(value, size = 3) {
  if (!value) return 'ORG';
  const words = String(value)
    .trim()
    .replace(/[^a-z0-9\s-]/gi, '')
    .split(/[\s-]+/)
    .filter(Boolean);
  
  if (words.length >= 2) {
    // Take first letter of each word
    return words.map(w => w[0]).join('').toUpperCase().slice(0, size);
  }
  
  // Take first 3 letters of the single word
  return words[0].slice(0, size).toUpperCase();
}

function getBasePrefix(code) {
  if (!code) return '';
  // Remove trailing numeric suffix like -001 or 001
  return String(code).replace(/-\d+$/, '').replace(/\d+$/, '');
}

exports.previewCode = async (req, res) => {
  try {
    let { type, name, parentId } = req.query;
    if (parentId === 'undefined' || parentId === 'null') parentId = null;
    if (!type || !name) return fail(res, 400, 'Type and name are required');

    let parentCode = '';
    const mainId = mainCompanyIdOf(req);

    if (parentId && parentId !== 'root') {
      const models = {
        subcompany: 'SubCompany',
        branch: 'Branch',
        division: 'Division',
        department: 'Department',
        designation: 'Designation'
      };
      
      const parentModelName = Object.entries(models).find(([t, m]) => {
        const hierarchy = ['main', 'subcompany', 'branch', 'division', 'department', 'designation'];
        return hierarchy[hierarchy.indexOf(type) - 1] === t;
      })?.[1];

      if (parentModelName) {
        const ParentModel = getModel(req, parentModelName);
        const parent = await ParentModel.findById(parentId).lean();
        if (parent) {
          parentCode = getBasePrefix(parent.entityCode || parent.subCompanyCode || parent.branchCode || parent.divisionCode || parent.departmentCode || parent.code);
        }
      }
    } else if (type === 'subcompany') {
      // For subcompany, we might want to prefix with main company initials
      const Tenant = mongoose.model('Tenant');
      const main = await Tenant.findById(mainId).lean();
      if (main) parentCode = getBasePrefix(main.code || abbrev(main.companyName, 3));
    }

    const selfAbbr = abbrev(name, 3);
    const prefix = parentCode ? `${parentCode}-${selfAbbr}` : selfAbbr;
    
    // We don't actually increment the counter for preview, just show what it would be
    // but to be safe we check the current sequence
    const Counter = getModel(req, 'Counter');
    const key = `org:${type}:${mainId}:${prefix}`;
    const counter = await Counter.findOne({ key }).lean();
    const seq = (counter?.seq || 0) + 1;
    const code = `${prefix}-${String(seq).padStart(3, '0')}`;

    return ok(res, { code, prefix, sequence: seq });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

async function nextCode(req, key, prefix, width = 3, checkModel = null, checkField = 'subCompanyCode') {
  const Counter = getModel(req, 'Counter');
  let code = '';
  let exists = true;

  while (exists) {
    const counter = await Counter.findOneAndUpdate(
      { key },
      { 
        $inc: { seq: 1 }, 
        $setOnInsert: { 
          key,
          entity: key, // Use key as entity to keep the {entity, year} index unique per key
          year: new Date().getFullYear() 
        } 
      },
      { new: true, upsert: true }
    ).lean();
    code = `${prefix}-${String(counter.seq).padStart(width, '0')}`;

    if (checkModel) {
      const found = await checkModel.findOne({ [checkField]: code }).lean();
      if (!found) exists = false;
    } else {
      exists = false;
    }
  }

  return code;
}

function baseScope(req) {
  const filter = { mainCompanyId: mainCompanyIdOf(req), isDeleted: { $ne: true } };
  const role = roleOf(req);
  if (req.user?.subCompanyId) filter.subCompanyId = req.user.subCompanyId;
  if (['BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(role) && req.user?.branchId) filter.branchId = req.user.branchId;
  if (['DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(role) && req.user?.divisionId) filter.divisionId = req.user.divisionId;
  if (role === 'DEPARTMENT_HEAD' && req.user?.departmentId) filter.departmentId = req.user.departmentId;
  return filter;
}

function scopedSubCompanyFilter(req, subCompanyId = null) {
  const filter = { mainCompanyId: mainCompanyIdOf(req), isDeleted: { $ne: true } };
  if (subCompanyId) filter._id = subCompanyId;
  if (req.user?.subCompanyId) filter._id = req.user.subCompanyId;
  return filter;
}

async function validateSubCompany(req, subCompanyId) {
  const SubCompany = getModel(req, 'SubCompany');
  if (!id(subCompanyId)) return null;
  return SubCompany.findOne(scopedSubCompanyFilter(req, subCompanyId)).lean();
}

async function validateBranch(req, branchId) {
  const Branch = getModel(req, 'Branch');
  if (!id(branchId)) return null;
  return Branch.findOne({ ...baseScope(req), _id: branchId }).lean();
}

async function validateDivision(req, divisionId) {
  const Division = getModel(req, 'Division');
  if (!id(divisionId)) return null;
  return Division.findOne({ ...baseScope(req), _id: divisionId }).lean();
}

async function validateDepartment(req, departmentId) {
  const Department = getModel(req, 'Department');
  if (!id(departmentId)) return null;
  return Department.findOne({ ...baseScope(req), _id: departmentId }).lean();
}

async function validateDesignation(req, designationId) {
  const Designation = getModel(req, 'Designation');
  if (!id(designationId)) return null;
  return Designation.findOne({ ...baseScope(req), _id: designationId }).lean();
}

exports.getSubCompanies = async (req, res) => {
  try {
    const SubCompany = getModel(req, 'SubCompany');
    const Branch = getModel(req, 'Branch');
    
    const items = await SubCompany.find(scopedSubCompanyFilter(req))
      .select('companyName name subCompanyCode entityCode email adminEmail isActive createdAt adminEmployeeId subCompanyAdminId mainCompanyId')
      .lean();
      
    const data = await Promise.all(items.map(async (item) => {
      const head = await resolveHierarchyHead(req, {
        role: 'SUB_COMPANY_ADMIN',
        scopeField: 'subCompanyId',
        scopeId: item._id,
        headId: item.adminEmployeeId || item.subCompanyAdminId,
        fallbackEmail: item.adminEmail || item.email,
      });

      return {
        ...item,
        name: item.name || item.companyName,
        code: item.subCompanyCode || item.entityCode,
        adminEmail: item.adminEmail || item.email,
        headName: head?.name || 'Not Assigned',
        headEmail: head?.email,
        branchCount: await Branch.countDocuments({ mainCompanyId: item.mainCompanyId || mainCompanyIdOf(req), subCompanyId: item._id, isDeleted: { $ne: true } })
      };
    }));
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.getBranches = async (req, res) => {
  try {
    let subCompanyId = req.query.subCompanyId || req.user?.subCompanyId;
    if (subCompanyId === 'undefined' || subCompanyId === 'null') subCompanyId = null;
    const sub = await validateSubCompany(req, subCompanyId);
    if (!sub) return fail(res, 403, 'Invalid sub company scope');
    const Branch = getModel(req, 'Branch');
    const Division = getModel(req, 'Division');
    
    const filter = { mainCompanyId: mainCompanyIdOf(req), subCompanyId: sub._id, isDeleted: { $ne: true } };
    if (['BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(roleOf(req)) && req.user?.branchId) filter._id = req.user.branchId;
    
    const branches = await Branch.find(filter).lean();
    const data = await Promise.all(branches.map(async (branch) => {
      const head = await resolveHierarchyHead(req, {
        role: 'BRANCH_HEAD',
        scopeField: 'branchId',
        scopeId: branch._id,
        headId: branch.branchHeadId || branch.headEmployeeId,
        fallbackEmail: branch.contactEmail || branch.email,
      });

      return {
        ...branch,
        code: branch.branchCode || branch.entityCode,
        headName: head?.name || 'Not Assigned',
        headEmail: head?.email || branch.contactEmail,
        divisionCount: await Division.countDocuments({ mainCompanyId: mainCompanyIdOf(req), subCompanyId: sub._id, branchId: branch._id, isDeleted: { $ne: true } })
      };
    }));
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.getDivisions = async (req, res) => {
  try {
    let branchId = req.query.branchId || req.user?.branchId;
    if (branchId === 'undefined' || branchId === 'null') branchId = null;
    const branch = await validateBranch(req, branchId);
    if (!branch) return fail(res, 403, 'Invalid branch scope');
    const Division = getModel(req, 'Division');
    const Department = getModel(req, 'Department');
    
    const filter = { mainCompanyId: mainCompanyIdOf(req), branchId: branch._id, isDeleted: { $ne: true } };
    if (['DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(roleOf(req)) && req.user?.divisionId) filter._id = req.user.divisionId;
    
    const divisions = await Division.find(filter).lean();
    const data = await Promise.all(divisions.map(async (division) => {
      const head = await resolveHierarchyHead(req, {
        role: 'DIVISION_HEAD',
        scopeField: 'divisionId',
        scopeId: division._id,
        headId: division.divisionHeadId || division.headEmployeeId,
        fallbackEmail: division.contactEmail || division.email,
      });

      return {
        ...division,
        code: division.divisionCode || division.code || division.entityCode,
        headName: head?.name || 'Not Assigned',
        headEmail: head?.email,
        departmentCount: await Department.countDocuments({ mainCompanyId: mainCompanyIdOf(req), divisionId: division._id, isDeleted: { $ne: true } })
      };
    }));
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.getDepartments = async (req, res) => {
  try {
    let divisionId = req.query.divisionId || req.user?.divisionId;
    if (divisionId === 'undefined' || divisionId === 'null') divisionId = null;
    let division = null;
    if (divisionId) {
      division = await validateDivision(req, divisionId);
      if (!division) return fail(res, 403, 'Invalid division scope');
    }
    const Department = getModel(req, 'Department');
    const Designation = getModel(req, 'Designation');
    const Employee = getModel(req, 'Employee');
    
    const filter = { mainCompanyId: mainCompanyIdOf(req), isDeleted: { $ne: true } };
    if (division) filter.divisionId = division._id;
    if (roleOf(req) === 'DEPARTMENT_HEAD' && req.user?.departmentId) filter._id = req.user.departmentId;
    
    const departments = await Department.find(filter).lean();
    const data = await Promise.all(departments.map(async (department) => {
      const head = await resolveHierarchyHead(req, {
        role: 'DEPARTMENT_HEAD',
        scopeField: 'departmentId',
        scopeId: department._id,
        headId: department.departmentHeadId || department.headEmployeeId,
        fallbackEmail: department.contactEmail || department.email,
      });

      return {
        ...department,
        code: department.departmentCode || department.code || department.entityCode,
        headName: head?.name || 'Not Assigned',
        headEmail: head?.email,
        designationCount: await Designation.countDocuments({ mainCompanyId: mainCompanyIdOf(req), departmentId: department._id, isDeleted: { $ne: true } }),
        employeeCount: await Employee.countDocuments({ mainCompanyId: mainCompanyIdOf(req), departmentId: department._id, isActive: { $ne: false }, isDeleted: { $ne: true } })
      };
    }));
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.getDesignations = async (req, res) => {
  try {
    let departmentId = req.query.departmentId || req.user?.departmentId;
    if (departmentId === 'undefined' || departmentId === 'null') departmentId = null;
    const department = await validateDepartment(req, departmentId);
    if (!department) return fail(res, 403, 'Invalid department scope');
    const Designation = getModel(req, 'Designation');
    const Employee = getModel(req, 'Employee');
    
    // Fetch all database designations
    const dbDesignations = await Designation.find({ mainCompanyId: mainCompanyIdOf(req), departmentId: department._id, isDeleted: { $ne: true } }).lean();
    
    // Fetch all active employees under this department
    const employees = await Employee.find({ mainCompanyId: mainCompanyIdOf(req), departmentId: department._id, isActive: { $ne: false }, isDeleted: { $ne: true } }).lean();
    
    // Group employees by designation strings for which there is no real designationId in the DB
    const dbDesignationIds = new Set(dbDesignations.map(d => String(d._id)));
    const virtualDesignationNames = new Set();
    employees.forEach(emp => {
      if (emp.designation && (!emp.designationId || !dbDesignationIds.has(String(emp.designationId)))) {
        virtualDesignationNames.add(emp.designation.trim());
      }
    });

    const virtualDesignations = Array.from(virtualDesignationNames).map(name => ({
      _id: `virtual_designation_${encodeURIComponent(name)}`,
      name: name,
      title: name,
      isVirtual: true,
      code: 'VIRTUAL',
      departmentId: department._id,
      employeeCount: employees.filter(emp => emp.designation && emp.designation.trim() === name).length
    }));

    const data = [
      ...dbDesignations.map(designation => ({
        ...designation,
        title: designation.title || designation.name,
        code: designation.designationCode || designation.code || designation.entityCode,
        employeeCount: employees.filter(emp => String(emp.designationId) === String(designation._id)).length
      })),
      ...virtualDesignations
    ];
    
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.getEmployees = async (req, res) => {
  try {
    let designationId = req.query.designationId;
    if (designationId === 'undefined' || designationId === 'null') designationId = null;
    
    const Employee = getModel(req, 'Employee');
    const filter = { mainCompanyId: mainCompanyIdOf(req), isActive: { $ne: false }, isDeleted: { $ne: true } };

    if (designationId) {
      if (String(designationId).startsWith('virtual_designation_')) {
        const designationName = decodeURIComponent(String(designationId).replace('virtual_designation_', ''));
        filter.designation = designationName;
        // Also apply departmentId filter if passed
        let departmentId = req.query.departmentId || req.user?.departmentId;
        if (departmentId === 'undefined' || departmentId === 'null') departmentId = null;
        if (departmentId) {
          filter.departmentId = departmentId;
        }
      } else {
        filter.designationId = designationId;
      }
    } else {
      let departmentId = req.query.departmentId || req.user?.departmentId;
      if (departmentId === 'undefined' || departmentId === 'null') departmentId = null;
      const department = await validateDepartment(req, departmentId);
      if (!department) return fail(res, 403, 'Invalid department scope');
      filter.departmentId = department._id;
    }

    const Designation = getModel(req, 'Designation');
    const employees = await Employee.find(filter).select('-password').lean();
    const designationIds = [...new Set(employees.map((emp) => String(emp.designationId || '')))].filter(Boolean);
    const designations = await Designation.find({ _id: { $in: designationIds } }).select('title name').lean();
    const titleById = new Map(designations.map((designation) => [String(designation._id), designation.title || designation.name]));
    
    const formatted = employees.map((emp) => ({
      ...emp,
      name: formatEmployeeName(emp),
      designationTitle: titleById.get(String(emp.designationId || '')) || emp.designation || ''
    }));
    return ok(res, formatted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.listPotentialHeads = async (req, res) => {
  try {
    const Employee = getModel(req, 'Employee');
    const User = mongoose.model('User');
    const mainId = mainCompanyIdOf(req);
    const filter = {
      $or: [
        { mainCompanyId: mainId },
        { tenantId: mainId },
        { companyId: mainId },
        { mainGroupId: mainId }
      ],
      isDeleted: { $ne: true }
    };

    // Fetch from both collections for maximum coverage
    const [employees, users] = await Promise.all([
      Employee.find(filter).select('firstName lastName name email role employeeCode status').lean(),
      User.find(filter).select('name email role employeeCode isActive').lean()
    ]);

    // Merge by email
    const headMap = new Map();

    employees.forEach(e => {
      const email = String(e.email || '').toLowerCase().trim();
      if (!email) return;
      headMap.set(email, {
        _id: e._id,
        name: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
        email: e.email,
        role: e.role,
        employeeCode: e.employeeCode
      });
    });

    users.forEach(u => {
      const email = String(u.email || '').toLowerCase().trim();
      if (!email || headMap.has(email)) return;
      headMap.set(email, {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        employeeCode: u.employeeCode
      });
    });

    return ok(res, Array.from(headMap.values()));
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

async function handleHeadAssignment(req, payload, entityIds, role) {
  const User = mongoose.model('User');
  let headId = null;

  if (payload.adminAssignmentType === 'existing') {
    if (!payload.headEmployeeId) throw new Error('Head employee is required');
    const user = await User.findOne({ _id: payload.headEmployeeId, mainCompanyId: mainCompanyIdOf(req) });
    if (!user) throw new Error('Employee not found');

    // Update user role and hierarchy IDs
    user.role = role;
    Object.assign(user, entityIds);
    await user.save();
    headId = user._id;
  } else if (payload.adminAssignmentType === 'new') {
    if (!payload.adminEmail || !payload.adminPassword || !payload.adminName) {
      throw new Error('Admin name, email and password are required');
    }

    const exists = await User.findOne({ email: payload.adminEmail.toLowerCase() });
    if (exists) {
      const sameCompany =
        !exists.mainCompanyId ||
        String(exists.mainCompanyId) === String(mainCompanyIdOf(req)) ||
        String(exists.companyId || '') === String(mainCompanyIdOf(req));
      if (!sameCompany) throw new Error('Email already registered');

      exists.name = payload.adminName || exists.name;
      exists.role = role;
      exists.mainCompanyId = exists.mainCompanyId || mainCompanyIdOf(req);
      Object.assign(exists, entityIds);
      if (payload.adminPassword) exists.password = payload.adminPassword;
      exists.isActive = true;
      await exists.save();
      return exists._id;
    }

    // Password will be hashed by User model pre-save hook
    const count = await User.countDocuments({ mainCompanyId: mainCompanyIdOf(req) });
    const employeeCode = `ADM-${String(count + 1).padStart(4, '0')}`;

    const user = await User.create({
      name: payload.adminName,
      email: payload.adminEmail.toLowerCase(),
      password: payload.adminPassword,
      role: role,
      employeeCode,
      ...entityIds,
      mainCompanyId: mainCompanyIdOf(req),
      companyId: mainCompanyIdOf(req),
      isActive: true,
      createdBy: req.user?._id || req.user?.id
    });
    headId = user._id;
  }
  return headId;
}

exports.createSubCompany = async (req, res) => {
  try {
    const SubCompany = getModel(req, 'SubCompany');
    const companyName = String(req.body.companyName || req.body.name || '').trim();
    if (!companyName) return fail(res, 400, 'Company name is required');

    // Subcompany prefix inherits from Main Company
    const Tenant = mongoose.model('Tenant');
    const mainId = mainCompanyIdOf(req);
    const main = await Tenant.findById(mainId).lean();
    const parentPrefix = getBasePrefix(main?.code || abbrev(main?.companyName, 3));
    
    const selfAbbr = abbrev(companyName, 3);
    const prefix = parentPrefix ? `${parentPrefix}-${selfAbbr}` : selfAbbr;
    const subCompanyCode = await nextCode(req, `org:subcompany:${mainId}:${prefix}`, prefix, 3, SubCompany, 'subCompanyCode');

    const subCompany = await SubCompany.create({
      companyName,
      name: companyName,
      subCompanyCode,
      entityCode: subCompanyCode,
      email: req.body.adminEmail || req.body.email,
      adminEmail: req.body.adminEmail || req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      mainCompanyId: mainId
    });

    const adminId = await handleHeadAssignment(req, req.body, { subCompanyId: subCompany._id }, 'SUB_COMPANY_ADMIN');
    subCompany.subCompanyAdminId = adminId;
    await subCompany.save();
    const head = await resolveHierarchyHead(req, {
      role: 'SUB_COMPANY_ADMIN',
      scopeField: 'subCompanyId',
      scopeId: subCompany._id,
      headId: adminId,
      fallbackEmail: subCompany.adminEmail || subCompany.email,
    });

    return ok(res.status(201), { ...subCompany.toObject(), name: companyName, code: subCompanyCode, headName: head?.name, headEmail: head?.email, branchCount: 0 }, 'Sub company created successfully');
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { name, city, address, phone, subCompanyId } = req.body
    if (!name || !city)
      return res.status(400).json({ success: false, message: 'Name and city are required' })

    const SubCompany = getModel(req, 'SubCompany');
    const Branch = getModel(req, 'Branch');

    const sub = await SubCompany.findOne({
      _id: subCompanyId || req.user.subCompanyId,
      mainCompanyId: mainCompanyIdOf(req)
    })
    if (!sub)
      return res.status(403).json({ success: false, message: 'Access denied' })

    const cityAbbr = abbrev(city, 3);
    const parentCode = getBasePrefix(sub.entityCode || sub.subCompanyCode);
    const prefix = parentCode ? `${parentCode}-${cityAbbr}` : cityAbbr;
    const branchCode = await nextCode(req, `org:branch:${mainCompanyIdOf(req)}:${prefix}`, prefix, 3, Branch, 'branchCode');

    const branch = await Branch.create({
      name, city, address, phone,
      branchCode,
      entityCode: branchCode,
      subCompanyId: sub._id,
      mainCompanyId: mainCompanyIdOf(req),
      isActive: true,
      createdBy: req.user?._id || req.user?.id
    })

    const headId = await handleHeadAssignment(req, req.body, { subCompanyId: sub._id, branchId: branch._id }, 'BRANCH_HEAD');
    branch.branchHeadId = headId;
    await branch.save();
    const head = await resolveHierarchyHead(req, {
      role: 'BRANCH_HEAD',
      scopeField: 'branchId',
      scopeId: branch._id,
      headId,
      fallbackEmail: branch.contactEmail || branch.email,
    });

    res.status(201).json({ success: true, data: { ...branch.toObject(), headName: head?.name, headEmail: head?.email }, message: 'Branch created' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.createDivision = async (req, res) => {
  try {
    const { name, description, branchId } = req.body
    if (!name || !branchId)
      return res.status(400).json({ success: false, message: 'Name and branchId required' })

    const Branch = getModel(req, 'Branch');
    const Division = getModel(req, 'Division');

    const branch = await Branch.findOne({
      _id: branchId,
      mainCompanyId: mainCompanyIdOf(req)
    })
    if (!branch)
      return res.status(403).json({ success: false, message: 'Access denied' })

    const divAbbr = abbrev(name, 3);
    const parentCode = getBasePrefix(branch.entityCode || branch.branchCode);
    const prefix = parentCode ? `${parentCode}-${divAbbr}` : divAbbr;
    const divisionCode = await nextCode(req, `org:division:${mainCompanyIdOf(req)}:${prefix}`, prefix, 3, Division, 'divisionCode');

    const division = await Division.create({
      name, description, divisionCode,
      code: divisionCode,
      entityCode: divisionCode,
      branchId: branch._id,
      subCompanyId: branch.subCompanyId,
      mainCompanyId: mainCompanyIdOf(req),
      isActive: true,
      createdBy: req.user?._id || req.user?.id
    })

    const headId = await handleHeadAssignment(req, req.body, {
      subCompanyId: branch.subCompanyId,
      branchId: branch._id,
      divisionId: division._id
    }, 'DIVISION_HEAD');
    division.divisionHeadId = headId;
    await division.save();
    const head = await resolveHierarchyHead(req, {
      role: 'DIVISION_HEAD',
      scopeField: 'divisionId',
      scopeId: division._id,
      headId,
      fallbackEmail: division.contactEmail || division.email,
    });

    res.status(201).json({ success: true, data: { ...division.toObject(), headName: head?.name, headEmail: head?.email }, message: 'Division created' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.createDepartment = async (req, res) => {
  try {
    const { name, description, divisionId } = req.body
    if (!name || !divisionId)
      return res.status(400).json({ success: false, message: 'Name and divisionId required' })

    const Division = getModel(req, 'Division');
    const Department = getModel(req, 'Department');

    const division = await Division.findOne({
      _id: divisionId,
      mainCompanyId: mainCompanyIdOf(req)
    })
    if (!division)
      return res.status(403).json({ success: false, message: 'Access denied' })

    const deptAbbr = abbrev(name, 3);
    const parentCode = getBasePrefix(division.entityCode || division.divisionCode);
    const prefix = parentCode ? `${parentCode}-${deptAbbr}` : deptAbbr;
    const departmentCode = await nextCode(req, `org:department:${mainCompanyIdOf(req)}:${prefix}`, prefix, 3, Department, 'departmentCode');

    const department = await Department.create({
      name, description, departmentCode,
      code: departmentCode,
      entityCode: departmentCode,
      divisionId: division._id,
      branchId: division.branchId,
      subCompanyId: division.subCompanyId,
      mainCompanyId: mainCompanyIdOf(req),
      isActive: true,
      createdBy: req.user?._id || req.user?.id
    })

    const headId = await handleHeadAssignment(req, req.body, {
      subCompanyId: division.subCompanyId,
      branchId: division.branchId,
      divisionId: division._id,
      departmentId: department._id
    }, 'DEPARTMENT_HEAD');
    department.departmentHeadId = headId;
    await department.save();
    const head = await resolveHierarchyHead(req, {
      role: 'DEPARTMENT_HEAD',
      scopeField: 'departmentId',
      scopeId: department._id,
      headId,
      fallbackEmail: department.contactEmail || department.email,
    });

    res.status(201).json({ success: true, data: { ...department.toObject(), headName: head?.name, headEmail: head?.email }, message: 'Department created' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.createDesignation = async (req, res) => {
  try {
    const { title, grade, departmentId } = req.body
    if (!title || !departmentId)
      return res.status(400).json({ success: false, message: 'Title and departmentId required' })

    const Department = getModel(req, 'Department');
    const Designation = getModel(req, 'Designation');

    const dept = await Department.findOne({
      _id: departmentId,
      mainCompanyId: mainCompanyIdOf(req)
    })
    if (!dept)
      return res.status(403).json({ success: false, message: 'Access denied' })

    const desAbbr = abbrev(title, 3);
    const parentCode = getBasePrefix(dept.entityCode || dept.departmentCode);
    const prefix = parentCode ? `${parentCode}-${desAbbr}` : desAbbr;
    const designationCode = await nextCode(req, `org:designation:${mainCompanyIdOf(req)}:${prefix}`, prefix, 3, Designation, 'designationCode');

    const designation = await Designation.create({
      title,
      name: title,
      grade,
      designationCode,
      code: designationCode,
      entityCode: designationCode,
      departmentId: dept._id,
      divisionId: dept.divisionId,
      branchId: dept.branchId,
      subCompanyId: dept.subCompanyId,
      mainCompanyId: mainCompanyIdOf(req),
      isActive: true,
      createdBy: req.user?._id || req.user?.id
    })
    res.status(201).json({ success: true, data: designation, message: 'Designation created' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.createEmployee = async (req, res) => {
  try {
    const { name, email, password, phone, designationId, departmentId } = req.body
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required' })
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password min 8 characters' })

    const User = getModel(req, 'User');
    const Department = getModel(req, 'Department');

    // Check email uniqueness
    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists)
      return res.status(400).json({ success: false, message: 'Email already registered' })

    const dept = await Department.findOne({
      _id: departmentId,
      mainCompanyId: mainCompanyIdOf(req)
    })
    if (!dept)
      return res.status(403).json({ success: false, message: 'Access denied' })

    const hashedPassword = await bcrypt.hash(password, 12)
    const count = await User.countDocuments({ mainCompanyId: mainCompanyIdOf(req) })
    const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`

    const employee = await User.create({
      name, email: email.toLowerCase(), phone,
      password: hashedPassword,
      employeeCode,
      role: 'EMPLOYEE',
      designationId,
      departmentId: dept._id,
      divisionId: dept.divisionId,
      branchId: dept.branchId,
      subCompanyId: dept.subCompanyId,
      mainCompanyId: mainCompanyIdOf(req),
      isActive: true,
      createdBy: req.user?._id || req.user?.id
    })

    const clean = employee.toObject()
    delete clean.password;
    res.status(201).json({ success: true, data: clean, message: 'Employee created' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.listAssignableEmployees = async (req, res) => {
  try {
    const Employee = getModel(req, 'Employee');
    const employees = await Employee.find({ tenant: req.tenantId, isActive: true })
      .select('firstName lastName employeeCode email departmentId designationId role')
      .lean();
    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignEmployeeToDesignation = async (req, res) => {
  try {
    const { designationId } = req.params;
    const { employeeId } = req.body;
    const Employee = getModel(req, 'Employee');
    
    const employee = await Employee.findOneAndUpdate(
      { _id: employeeId, tenant: req.tenantId }, 
      { designationId }, 
      { new: true }
    );
    
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: employee, message: 'Assigned successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
