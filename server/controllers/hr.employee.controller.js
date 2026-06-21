const path = require("path");
const Tenant = require("../models/Tenant");
const CounterSchema = require("../models/Counter");
const mongoose = require("mongoose");
const CompanyIdConfig = require('../models/CompanyIdConfig');
const DocumentCounter = require('../models/DocumentCounter');
const idGenerator = require('../utils/idGenerator');
const leaveManagementService = require('../services/leaveManagement.service');
const gradeBandAssignmentService = require('../services/gradeBandAssignment.service');
const UserSchema = require('../models/User');
const { sanitizeEmployee } = require('../utils/apiSanitizer');
const { getDefaultPerms } = require('../utils/defaultRolePermissions');
const companyIdConfigController = require('./companyIdConfig.controller');
const salarySnapshotCanonicalSync = require('../services/salarySnapshotCanonicalSync.service');
const employeeHierarchyService = require('../services/employeeHierarchy.service');

// Global counter model (stored in main connection, not tenant databases)
let GlobalCounter;
function getGlobalCounter() {
  if (!GlobalCounter) {
    try {
      GlobalCounter = mongoose.model("GlobalCounter");
    } catch (e) {
      GlobalCounter = mongoose.model("GlobalCounter", CounterSchema);
    }
  }
  return GlobalCounter;
}

let GlobalUserModel;
function getGlobalUserModel() {
  if (!GlobalUserModel) {
    try {
      GlobalUserModel = mongoose.model('User');
    } catch (e) {
      GlobalUserModel = mongoose.model('User', UserSchema);
    }
  }
  return GlobalUserModel;
}

const HIRING_PERMISSION_KEYS = [
  'hiring.jobList',
  'hiring.createReq',
  'hiring.external',
  'hiring.internal',
  'hiring.tracker',
  'hiring.offerTemplates',
  'recruitment.tracker',
  '/hr/requirements',
  '/hr/create-requirement',
  '/hr/applicants',
  '/hr/internal-applicants',
  '/hr/candidate-status',
];

function hasHiringAccess(permissions = [], role = '') {
  const adminRoles = ['psa', 'super_admin', 'company_admin', 'company_super_admin', 'admin', 'hr', 'hr_admin'];
  if (role && adminRoles.includes(String(role).toLowerCase())) return true;
  
  if (!Array.isArray(permissions) || permissions.length === 0) return false;
  return permissions.some((perm) => {
    const moduleKey = String(perm?.module || '').trim();
    if (!moduleKey) return false;
    const byPrefix = moduleKey.toLowerCase().startsWith('hiring.') || moduleKey.toLowerCase().startsWith('recruitment.');
    const byExact = HIRING_PERMISSION_KEYS.includes(moduleKey);
    if (!byPrefix && !byExact) return false;

    const actions = perm?.actions || perm;
    if (!actions || typeof actions !== 'object') return false;
    return ['view', 'create', 'edit', 'delete'].some((key) => actions[key] === true);
  });
}

/* ---------------------------------------------
   HELPER → Get models from tenantDB
   Models are already registered by dbManager, just retrieve them
--------------------------------------------- */
function getModels(req) {
  if (!req.tenantDB) {
    throw new Error("Tenant database connection not available");
  }
  const db = req.tenantDB;
  try {
    // Models are already registered by dbManager, just retrieve them
    if (!db.models.BGVCase) {
      try { db.model('BGVCase', require('../models/BGVCase')); } catch (e) { }
    }
    if (!db.models.Grade) {
      try { db.model('Grade', require('../models/Grade')); } catch (e) { }
    }

    return {
      Employee: db.model("Employee"),
      LeavePolicy: db.model("LeavePolicy"),
      LeaveBalance: db.model("LeaveBalance"),
      Band: db.model("Band"),
      DesignationGradeMap: db.model("DesignationGradeMap"),
      PromotionHistory: db.model("PromotionHistory"),
      AuditLog: db.model("AuditLog"),
      Department: db.model("Department"),
      Grade: db.model("Grade"),
      BGVCase: db.model("BGVCase"),
      Applicant: db.model("Applicant"),
      Shift: db.model("Shift"),
      EmployeeSalarySnapshot: db.model("EmployeeSalarySnapshot")
    };
  } catch (err) {
    console.error("[getModels] Error retrieving models:", err.message);
    console.error("[getModels] Error stack:", err.stack);
    throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
  }
}

function hasTenantValue(value) {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
}

function isMongoCollectionLimitError(err) {
  return (
    err?.code === 8000 &&
    /already using .* collections/i.test(String(err.message || err.errmsg || ''))
  );
}

function canOverrideGradeBand(req) {
  const role = String(req.user?.role || '').toLowerCase();
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  if (['psa', 'super_admin', 'company_admin', 'company_super_admin', 'admin'].includes(role)) return true;
  return permissions.some((perm) => {
    const moduleKey = String(perm?.module || '').toLowerCase();
    const actions = perm?.actions || perm;
    return ['gradeband.override', 'people.gradeband'].includes(moduleKey) && actions?.edit === true;
  });
}

const GRADE_PUBLIC_SELECT = 'name code level benefits attendanceRules leaveRules isActive effectiveFrom effectiveTo';

async function resolveEmployeeGrade({ Grade, tenantId, gradeId, grade }) {
  const explicitGradeId = gradeId !== undefined ? gradeId : undefined;
  const legacyGradeAsId = explicitGradeId === undefined && mongoose.Types.ObjectId.isValid(String(grade || ''))
    ? grade
    : undefined;
  const candidate = explicitGradeId !== undefined ? explicitGradeId : legacyGradeAsId;

  if (candidate === undefined) {
    return { hasGradeId: false };
  }

  if (candidate === null || candidate === '') {
    return { hasGradeId: true, gradeId: null, legacyGradeName: undefined };
  }

  if (!mongoose.Types.ObjectId.isValid(String(candidate))) {
    const err = new Error('gradeId must be a valid Grade ObjectId');
    err.statusCode = 400;
    err.code = 'invalid_grade';
    throw err;
  }

  const gradeDoc = await Grade.findOne({
    _id: candidate,
    tenant: tenantId,
    isDeleted: false,
    isActive: true,
  }).select('name').lean();

  if (!gradeDoc) {
    const err = new Error('Grade not found for this company');
    err.statusCode = 400;
    err.code = 'grade_not_found';
    throw err;
  }

  return {
    hasGradeId: true,
    gradeId: gradeDoc._id,
    legacyGradeName: gradeDoc.name,
  };
}

const EMPLOYEE_LIMIT_ACTIVE_FILTER = {
  status: { $nin: ['deleted', 'Deleted', 'DELETED'] }
};

async function resolveTenantForUserLimit(tenantId) {
  if (!hasTenantValue(tenantId)) return null;
  const normalizedTenantId = String(tenantId).trim();
  if (mongoose.Types.ObjectId.isValid(normalizedTenantId)) {
    const byId = await Tenant.findById(normalizedTenantId).select('companyName userLimit').lean();
    if (byId) return byId;
  }
  return Tenant.findOne({ code: normalizedTenantId }).select('companyName userLimit').lean();
}

async function getTenantUserLimitContext(Employee, tenantId) {
  const tenant = await resolveTenantForUserLimit(tenantId);
  const limit = Number(tenant?.userLimit || 0);
  if (!Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  const currentCount = await Employee.countDocuments(EMPLOYEE_LIMIT_ACTIVE_FILTER);
  return {
    limit,
    currentCount,
    companyName: tenant?.companyName || 'this company'
  };
}

function assertTenantUserLimit(limitContext, requestedCount = 1, pendingCreatedCount = 0) {
  if (!limitContext) return;

  const currentWithPending = Number(limitContext.currentCount || 0) + Number(pendingCreatedCount || 0);
  const requested = Math.max(1, Number(requestedCount || 1));
  if (currentWithPending + requested <= limitContext.limit) return;

  const remaining = Math.max(0, limitContext.limit - currentWithPending);
  const err = new Error(
    remaining > 0
      ? `User limit reached. This company has ${remaining} employee slot(s) remaining, but ${requested} new employee record(s) were requested. Please increase the user limit before adding more employees.`
      : `User limit reached. This company is limited to ${limitContext.limit} employee(s). Please increase the user limit before adding more employees.`
  );
  err.statusCode = 403;
  err.code = 'USER_LIMIT_REACHED';
  err.details = {
    limit: limitContext.limit,
    currentCount: currentWithPending,
    remaining,
    companyName: limitContext.companyName
  };
  throw err;
}

function buildEmployeeScopeFilter(employeeId, tenantId) {
  const filter = { _id: employeeId };
  // Since we are already using a tenant-specific DB connection (req.tenantDB), 
  // the 'tenant' field filter is secondary. We allow documents with any tenant ID 
  // as long as they exist in this tenant's collection, but we will heal them later.
  return filter;
}

async function backfillEmployeeTenant(Employee, employeeDoc, tenantId) {
  if (!employeeDoc?._id || !hasTenantValue(tenantId)) {
    return;
  }

  const currentTenant = String(employeeDoc.tenant || '').trim();
  const targetTenant = String(tenantId).trim();

  // If missing or mismatched, heal the record
  if (currentTenant !== targetTenant) {
    try {
      await Employee.updateOne(
        { _id: employeeDoc._id },
        { $set: { tenant: tenantId } }
      );
      employeeDoc.tenant = tenantId;
      // console.log(`[EMPLOYEE_TENANT_HEAL] Corrected tenant for ${employeeDoc._id}: ${currentTenant} -> ${targetTenant}`);
    } catch (err) {
      console.warn(`[EMPLOYEE_TENANT_HEAL] Failed for ${employeeDoc._id}: ${err.message}`);
    }
  }
}

/**
 * Check if employee has a salary structure (required for activation).
 * Returns true if any of: EmployeeCompensation (ACTIVE, totalCTC>0), SalaryStructure (ACTIVE), or salaryTemplateId + salary/snapshot.
 */
async function hasSalaryStructureForEmployee(tenantDB, tenantId, employeeId, employeeDoc) {
  if (!tenantDB || !employeeId) return false;
  try {
    // 1. EmployeeCompensation (tenant)
    if (tenantDB.models.EmployeeCompensation) {
      const comp = await tenantDB.model('EmployeeCompensation').findOne({
        companyId: tenantId,
        employeeId,
        status: 'ACTIVE',
        isActive: true,
        totalCTC: { $gt: 0 }
      }).lean();
      if (comp) return true;
    }
  } catch (e) { /* ignore */ }
  try {
    // 2. SalaryStructure (global model)
    const SalaryStructure = mongoose.model('SalaryStructure');
    const structure = await SalaryStructure.findOne({
      tenantId,
      status: 'ACTIVE',
      $and: [
        { $or: [{ employee: employeeId }, { candidateId: employeeId }] },
        { $or: [{ 'totals.annualCTC': { $gt: 0 } }, { 'totals.monthlyCTC': { $gt: 0 } }] }
      ]
    }).lean();
    if (structure) return true;
  } catch (e) { /* ignore */ }
  // 3. Legacy: salaryTemplateId with salary or snapshot
  if (employeeDoc && (employeeDoc.salaryTemplateId || employeeDoc.currentSnapshotId) && (Number(employeeDoc.salary) > 0 || employeeDoc.currentSnapshotId)) return true;
  if (employeeDoc && Number(employeeDoc.salary) > 0) return true;
  return false;
}

/* ---------------------------------------------
   HELPER: Get next sequence per-tenant (using global counter)
--------------------------------------------- */
async function getNextSeq(key) {
  const Counter = getGlobalCounter();
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

/* ---------------------------------------------
   EMPLOYEE ID FORMATTER (Using CompanyIdConfig)
--------------------------------------------- */
async function generateEmployeeId({ req, department, employeeType }) {
  try {
    const isIntern = employeeType && ['Intern', 'Internship'].includes(employeeType);
    const entityType = isIntern ? 'INTN' : 'EMP';

    const companyIdConfig = require('./companyIdConfig.controller');
    const result = await companyIdConfig.generateIdInternal({
      tenantId: req.tenantId,
      entityType: entityType,
      increment: true,
      extraReplacements: {
        '{{DEPT}}': (department || 'GEN').substring(0, 3).toUpperCase()
      }
    });
    return result;
  } catch (error) {
    console.error("Error generating employee ID via companyIdConfig:", error);
    return { id: `EMP-${Date.now()}`, generationMode: 'AUTO' };
  }
}

/**
 * Initialize Leave Balances with Pro-rata Logic
 */
async function initializeBalances(req, employeeId, policyId) {
  if (!policyId) return;
  const { LeavePolicy, LeaveBalance, Employee, Grade } = getModels(req);

  const employee = await Employee.findById(employeeId);
  const policy = await LeavePolicy.findOne({ _id: policyId, tenant: req.tenantId });

  if (!employee || !policy) return;

  const year = leaveManagementService.validateJoiningDate(employee.joiningDate).getFullYear();
  await leaveManagementService.assignPolicyToEmployee({
    employee,
    tenantId: req.tenantId,
    policy,
    year,
    prorate: true,
    models: { Employee, LeavePolicy, LeaveBalance, Grade }
  });
}

/* ---------------------------------------------
   PREVIEW ID (Does NOT increase counter)
--------------------------------------------- */
exports.preview = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { department, employeeType } = req.body;

    const isIntern = employeeType && ['Intern', 'Internship'].includes(employeeType);
    const entityType = isIntern ? 'INTN' : 'EMP';

    const companyIdConfig = require('./companyIdConfig.controller');

    // Using the Enterprise Engine for Preview
    const result = await companyIdConfig.generateIdInternal({
      tenantId: tenantId,
      entityType: entityType,
      increment: false,
      extraReplacements: {
        '{{DEPT}}': (department || 'GEN').substring(0, 3).toUpperCase()
      }
    });

    res.json({ preview: result.id });
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "preview_failed", message: err.message });
  }
};

/* ---------------------------------------------
   LIST EMPLOYEES (tenant-wise)
--------------------------------------------- */
exports.list = async (req, res) => {
  try {
    // Step 1: Validate user authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "unauthorized",
        message: "User authentication required"
      });
    }

    // Step 2: Validate tenant context
    // Prefer resolved tenant context from middleware/header over stale token payload.
    const tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: "tenant_missing",
        message: "Tenant ID is required. Please ensure user is associated with a tenant."
      });
    }

    // Step 3: Ensure tenantDB is available
    if (!req.tenantDB) {
      if (req.user && (req.user.tenantId || req.user.tenant)) {
        try {
          const tid = req.user.tenantId || req.user.tenant;
          const getTenantDB = require('../utils/tenantDB');
          req.tenantDB = await getTenantDB(tid);
          req.tenantId = tid; // Sync
        } catch (e) {
          return res.status(500).json({
            success: false,
            error: "lazy_load_failed",
            message: `Lazy load of tenant DB failed: ${e.message}`,
            stack: e.stack
          });
        }
      }

      if (!req.tenantDB) {
        return res.status(500).json({
          success: false,
          error: "tenant_db_unavailable",
          message: "Tenant database connection not available despite lazy load attempt.",
          details: {
            userTenant: req.user?.tenantId,
            reqTenant: req.tenantId
          }
        });
      }
    }

    // Step 4: Get models with error handling
    let Employee;
    try {
      const models = getModels(req);
      Employee = models.Employee;
      if (!Employee) {
        throw new Error("Employee model is not available");
      }
      
    } catch (modelError) {
      return res.status(500).json({
        success: false,
        error: "model_error",
        message: `Failed to load Employee model: ${modelError.message}`,
        stack: modelError.stack
      });
    }

    // Step 5: Build query filter.
    const { department, designation, type, workMode, search, status, gradeId } = req.query || {};
    const filter = { ...req.hierarchyFilter };

    // Search Support (Combines with filters)
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Department Filter (Dynamic)
    if (department && department !== 'All Departments') {
      // Check if it's an ObjectId or a string
      if (mongoose.Types.ObjectId.isValid(department)) {
        filter.departmentId = department;
      } else {
        filter.department = department;
      }
    }

    // Designation Filter (Multi-select)
    if (designation && designation !== 'All Roles') {
      const designations = Array.isArray(designation) ? designation : designation.split(',').filter(Boolean);
      if (designations.length > 0) {
        filter.designation = { $in: designations };
      }
    }

    // Employee Type Filter (Multi-select)
    if (type) {
      const types = Array.isArray(type) ? type : type.split(',').filter(Boolean);
      if (types.length > 0) {
        filter.employeeType = { $in: types };
      }
    }

    // Work Mode Filter (Multi-select)
    if (workMode) {
      const modes = Array.isArray(workMode) ? workMode : workMode.split(',').filter(Boolean);
      if (modes.length > 0) {
        filter.workMode = { $in: modes };
      }
    }

    if (gradeId && mongoose.Types.ObjectId.isValid(String(gradeId))) {
      filter.gradeId = gradeId;
    }

    // Default: show all employees (active + deactivated). Only exclude Draft. Deactivated nu state aavu j dikhe, remove nah thay.
    const activeStatuses = ['ACTIVE', 'Active', 'active'];
    const inactiveStatuses = ['INACTIVE', 'Inactive'];
    if (!status) {
      filter.status = { $ne: 'Draft' };
    } else if (status === 'All') {
      filter.status = { $ne: 'Draft' };
    } else if (status === 'ACTIVE' || status === 'Active') {
      filter.status = { $in: activeStatuses };
    } else if (status === 'INACTIVE' || status === 'Inactive' || status === 'Exited') {
      filter.status = { $in: inactiveStatuses };
    } else {
      filter.status = status;
    }

    // Step 5b: Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip = (page - 1) * limit;

    // Step 6: Execute query with safe populate
    try {
      const query = Employee
        .find(filter)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort({ updatedAt: -1 })
        .lean()
        // Security: passwords and sensitive fields excluded at DB level
        .select("_id firstName lastName middleName email department departmentId role manager employeeId contactNo joiningDate profilePic status lastStep gender dob maritalStatus bloodGroup nationality fatherName motherName emergencyContactName emergencyContactNumber tempAddress permAddress experience employeeType workMode designation grade gradeId band leavePolicy bankDetails education documents salaryAssigned salaryLocked currentSnapshotId shiftId");

      query.populate('departmentId', 'name');
      query.populate('manager', 'firstName lastName employeeId');
      query.populate('gradeId', GRADE_PUBLIC_SELECT);
      query.populate('leavePolicy', 'name applicableTo status isActive');

      try {
        query.populate('shiftId', 'name startTime endTime shiftCode shiftType isNightShift');
      } catch (err) { }

      let items = await query.exec();
      if (items.length === 0) {
        const relaxedFilter = { ...filter };
        delete relaxedFilter.$or;

        const fallbackQuery = Employee
          .find(relaxedFilter)
          .limit(parseInt(limit))
          .skip(parseInt(skip))
          .sort({ updatedAt: -1 })
          .lean()
          .select("_id firstName lastName middleName email department departmentId role manager employeeId contactNo joiningDate profilePic status lastStep gender dob maritalStatus bloodGroup nationality fatherName motherName emergencyContactName emergencyContactNumber tempAddress permAddress experience employeeType workMode designation grade gradeId band leavePolicy bankDetails education documents salaryAssigned salaryLocked currentSnapshotId shiftId");

        fallbackQuery.populate('departmentId', 'name');
        fallbackQuery.populate('manager', 'firstName lastName employeeId');
        fallbackQuery.populate('gradeId', GRADE_PUBLIC_SELECT);
        fallbackQuery.populate('leavePolicy', 'name applicableTo status isActive');

        try {
          fallbackQuery.populate('shiftId', 'name startTime endTime shiftCode shiftType isNightShift');
        } catch (err) { }

        items = await fallbackQuery.exec();
        if (items.length > 0) {
          console.warn(`[EMPLOYEE_LIST] Recovered ${items.length} employees using relaxed tenant filter for tenant ${tenantId}`);
        }
      }
      // Security: sanitize each employee before sending (strips remaining sensitive fields)
      // and ENSURE _id is stringified to avoid Buffer object leakage
      let safeItems = items.map((emp) => {
        const sanitized = sanitizeEmployee(emp);
        if (sanitized && sanitized._id) sanitized._id = String(sanitized._id);
        return sanitized;
      });

      const hiringAccessOnly = String(req.query?.hiringAccess || '').toLowerCase() === 'true';
      if (hiringAccessOnly) {
        const User = getGlobalUserModel();
        const users = await User.find({
          $or: [
            { tenant: tenantId },
            { companyId: tenantId },
            { tenantId: tenantId }
          ],
          email: { $exists: true, $ne: '' }
        }).select('email permissions role').lean();

        const allowedEmailSet = new Set(
          (users || [])
            .filter((u) => hasHiringAccess(u?.permissions || [], u?.role || ''))
            .map((u) => String(u.email || '').trim().toLowerCase())
            .filter(Boolean)
        );

        safeItems = safeItems.filter((emp) =>
          allowedEmailSet.has(String(emp?.email || '').trim().toLowerCase())
        );
      }
      return res.json({ success: true, data: safeItems });

    } catch (queryError) {
      return res.status(500).json({
        success: false,
        error: "query_failed",
        message: "Failed to fetch employees from database. Please check database connection and schema."
      });
    }

    // Step 7: Return success response
    return res.json({ success: true, data: items });

  } catch (err) {
    const fs = require('fs');
    const path = require('path');
    const errorLog = `[${new Date().toISOString()}] [EMPLOYEE_LIST] UNEXPECTED ERROR: ${err.message}\nStack: ${err.stack}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'debug.log'), errorLog);

    console.error("[EMPLOYEE_LIST] UNEXPECTED ERROR:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: "internal_server_error",
        message: err.message || "An unexpected error occurred while fetching employees",
        // Note: stack trace intentionally omitted from response
      });
    }
  }
};

/* ---------------------------------------------
   CREATE EMPLOYEE
--------------------------------------------- */
exports.create = async (req, res) => {
  try {
    // Robust tenant resolution:
    // - Some sessions provide tenantId (ObjectId)
    // - Some provide only companyCode
    // - Some may provide stale IDs; fallback to code resolution
    let tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId || req.user?.tenant || null;
    const tokenCompanyCode = req.user?.companyCode || req.headers['x-company-code'] || null;

    if (!tenantId && tokenCompanyCode) tenantId = tokenCompanyCode;

    // Resolve tenant by code if needed
    let tenant = null;
    if (tenantId && mongoose.Types.ObjectId.isValid(String(tenantId))) {
      tenant = await Tenant.findById(tenantId);
      // If stale, fallback to code lookup
      if (!tenant && tokenCompanyCode) {
        tenant = await Tenant.findOne({ code: String(tokenCompanyCode).trim() });
      }
    } else if (tenantId) {
      tenant = await Tenant.findOne({ code: String(tenantId).trim() });
    } else if (tokenCompanyCode) {
      tenant = await Tenant.findOne({ code: String(tokenCompanyCode).trim() });
    }

    if (!tenant) {
      // Dev-safety fallback:
      // If we have a valid ObjectId but the central Tenant document is missing,
      // continue using tenant-scoped DB anyway so HR operations don't hard-fail.
      // This avoids blocking employee creation in environments where the main Tenant collection
      // is out of sync with tenant databases.
      if (tenantId && mongoose.Types.ObjectId.isValid(String(tenantId))) {
        tenant = { _id: String(tenantId), meta: {} };
      } else {
        return res.status(400).json({
          success: false,
          error: 'tenant_not_found',
          message: 'Tenant not found',
          details: {
            reqTenantId: req.tenantId || null,
            userTenantId: req.user?.tenantId || req.user?.companyId || req.user?.tenant || null,
            companyCode: tokenCompanyCode || null
          }
        });
      }
    }

    // Ensure tenant context is normalized for downstream model access
    req.tenantId = String(tenant._id);
    if (!req.tenantDB) {
      try {
        const getTenantDB = require('../utils/tenantDB');
        req.tenantDB = await getTenantDB(req.tenantId);
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: 'tenant_db_unavailable',
          message: `Tenant database connection not available: ${e.message}`
        });
      }
    }

    const { Employee, Grade } = getModels(req);
    const { firstName, lastName, department, customEmployeeId, departmentId, joiningDate, status, lastStep, applicantId, ...restBody } = req.body;
    const resolvedGrade = await resolveEmployeeGrade({
      Grade,
      tenantId: req.tenantId,
      gradeId: restBody.gradeId,
      grade: restBody.grade,
    });
    delete restBody.gradeId;
    delete restBody.leavePolicy;

    const tenantUserLimit = await getTenantUserLimitContext(Employee, req.tenantId);
    try {
      assertTenantUserLimit(tenantUserLimit);
    } catch (limitErr) {
      return res.status(limitErr.statusCode || 403).json({
        success: false,
        error: limitErr.code || 'USER_LIMIT_REACHED',
        message: limitErr.message,
        details: limitErr.details || null
      });
    }

    // --- Product Employee Limit Check ---
    const productLimits = tenant.productEmployeeLimits || {};
    const hrmsLimit = parseInt(productLimits['HRMS'] || productLimits['hrms'] || 0);

    if (hrmsLimit > 0 && status !== 'Draft') {
      const activeCount = await Employee.countDocuments({
        tenant: req.tenantId,
        status: { $in: ['ACTIVE', 'Active', 'active'] }
      });
      if (activeCount >= hrmsLimit) {
        return res.status(403).json({
          success: false,
          error: "limit_reached",
          details: {
            limit: hrmsLimit,
            currentCount: activeCount,
            remaining: Math.max(0, hrmsLimit - activeCount)
          },
          message: `Employee limit reached. Maximum allowed: ${hrmsLimit} for HRMS. Please contact administrator.`
        });
      }
    }
    const { contactNo, emergencyContactNumber } = restBody;

    // Contact Number Cleaning & Validation (Flexible Indian Number)
    const cleanPhone = (num) => {
      if (!num) return num;
      // Remove all non-digits
      let digits = num.replace(/\D/g, '');
      // If starts with 91 and has 12 digits, strip 91
      if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      // If starts with 0 and has 11 digits, strip 0
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      return digits;
    };

    const finalContact = cleanPhone(contactNo);
    const finalEmergency = cleanPhone(emergencyContactNumber);

    const phoneRe = /^\d{8,15}$/;
    if (status !== 'Draft') {
      if (finalContact && !phoneRe.test(finalContact)) {
        console.warn("[EMPLOYEE_CREATE] Invalid contact number:", contactNo, "->", finalContact);
        return res.status(400).json({ success: false, error: "invalid_contact", message: "Contact number must be between 8 and 15 digits." });
      }
      if (finalEmergency && !phoneRe.test(finalEmergency)) {
        console.warn("[EMPLOYEE_CREATE] Invalid emergency contact:", emergencyContactNumber);
        return res.status(400).json({ success: false, error: "invalid_emergency_contact", message: "Emergency contact must be between 8 and 15 digits." });
      }
    }

    let finalEmployeeId;
    const manualEmployeeId = req.body.employeeId;

    // Fetch Enterprise Config for ID (Detect Intern vs Employee)
    const isInternOnboard = restBody.employeeType && ['Intern', 'Internship'].includes(restBody.employeeType);
    const onboardEntityType = isInternOnboard ? 'INTN' : 'EMP';

    const companyIdConfig = require('./companyIdConfig.controller');
    const previewResult = await companyIdConfig.generateIdInternal({
      tenantId: tenantId,
      entityType: onboardEntityType,
      increment: false
    });

    const generationMode = previewResult.generationMode || 'AUTO';

    if (generationMode === 'MANUAL') {
      if (!manualEmployeeId) {
        return res.status(400).json({
          success: false,
          error: "employeeId_required",
          message: "Employee ID is required when in MANUAL mode."
        });
      }
      // Check for duplicate (TENANT-SCOPED)
      const exists = await Employee.findOne({ employeeId: manualEmployeeId, tenant: req.tenantId });
      if (exists) {
        return res.status(400).json({
          success: false,
          error: "employeeId_exists",
          message: "Employee ID already in use. Please provide a unique ID."
        });
      }
      finalEmployeeId = manualEmployeeId;
    } else {
      // AUTO MODE
      const isIntern = restBody.employeeType && ['Intern', 'Internship'].includes(restBody.employeeType);
      const entityType = isIntern ? 'INTN' : 'EMP';

      // Generate and ensure uniqueness inside this tenant (retry a few times on collisions)
      let attempts = 0;
      while (attempts < 5) {
        const autoResult = await companyIdConfig.generateIdInternal({
          tenantId: req.tenantId,
          entityType: entityType,
          increment: true,
          extraReplacements: {
            '{{DEPT}}': (department || 'GEN').substring(0, 3).toUpperCase()
          }
        });
        const candidateId = autoResult.id;
        const collision = await Employee.findOne({ employeeId: candidateId, tenant: req.tenantId }).select('_id').lean();
        if (!collision) {
          finalEmployeeId = candidateId;
          break;
        }
        attempts += 1;
      }

      if (!finalEmployeeId) {
        return res.status(500).json({
          success: false,
          error: 'employee_id_generation_failed',
          message: 'Unable to generate a unique employee ID. Please try again.'
        });
      }
    }

    // Build create data with proper departmentId and joiningDate handling
    const createData = {
      ...restBody,
      firstName,
      lastName,
      contactNo: finalContact,
      emergencyContactNumber: finalEmergency,
      employeeId: finalEmployeeId,
      mainCompanyId: req.tenantId,
      subCompanyId: req.body.subCompanyId || req.user.subCompanyId || null,
      branchId: req.body.branchId || req.user.branchId || null,
      divisionId: req.body.divisionId || req.user.divisionId || null,
      designationId: req.body.designationId || req.user.designationId || null,
      status: status || 'Active',
      lastStep: lastStep || 6,
      shiftId: restBody.shiftId || null
    };

    if (resolvedGrade.hasGradeId) {
      createData.gradeId = resolvedGrade.gradeId;
      if (
        resolvedGrade.legacyGradeName &&
        (!createData.grade || mongoose.Types.ObjectId.isValid(String(createData.grade)))
      ) {
        createData.grade = resolvedGrade.legacyGradeName;
      }
    }

    if (departmentId) {
      createData.departmentId = departmentId;
    }
    if (department) {
      createData.department = department;
    }
    if (joiningDate) {
      createData.joiningDate = leaveManagementService.validateJoiningDate(joiningDate);
    } else {
      createData.joiningDate = new Date();
    }

    if (createData.designationId && createData.departmentId) {
      const assignment = await gradeBandAssignmentService.resolveAssignment({
        models: getModels(req),
        tenantId,
        departmentId: createData.departmentId,
        designationId: createData.designationId,
        salary: createData.salary,
      });
      gradeBandAssignmentService.applyAssignmentToPayload(createData, assignment, {
        allowGradeOverride: canOverrideGradeBand(req),
        allowBandOverride: canOverrideGradeBand(req),
      });
    }

    // --- NEW: Copy Salary & BGV Info from Applicant (Onboarding) ---
    let applicantSnapshotId = null;
    let bgvCaseId = null;
    if (applicantId) {
      try {
        const { BGVCase, Applicant } = getModels(req);
        const applicant = await Applicant.findById(applicantId);

        if (applicant) {
          // 0. BGV ENFORCEMENT (Relaxed at user's request: BGV is no longer mandatory for onboarding)
          const bgv = await BGVCase.findOne({ applicationId: applicant._id });
          if (bgv) {
            bgvCaseId = bgv._id;
            // console.log(`[ONBOARDING] BGV found with status ${bgv.overallStatus}, proceeding with link (non-blocking).`);
          }

          // 1. Copy Template ID
          if (applicant.salaryTemplateId) {
            createData.salaryTemplateId = applicant.salaryTemplateId;
          }
          // 2. Copy Snapshot Link (Corrected to use salarySnapshotId)
          if (applicant.salarySnapshotId) {
            applicantSnapshotId = applicant.salarySnapshotId;
            createData.currentSalarySnapshotId = applicantSnapshotId;
            createData.currentSnapshotId = applicantSnapshotId;
            createData.salarySnapshots = [applicantSnapshotId];
            createData.salaryAssigned = true;
            createData.salaryLocked = true;
          } else if (applicant.salarySnapshot && applicant.salarySnapshot._id) {
            // Fallback for legacy data
            applicantSnapshotId = applicant.salarySnapshot._id;
            createData.currentSalarySnapshotId = applicantSnapshotId;
            createData.currentSnapshotId = applicantSnapshotId;
            createData.salarySnapshots = [applicantSnapshotId];
            createData.salaryAssigned = true;
            createData.salaryLocked = true;
          }
        }
      } catch (appErr) {
        console.error("Error fetching applicant for onboarding:", appErr);
      }
    }

    // console.log("[EMPLOYEE_CREATE] Data:", JSON.stringify(createData, null, 2));
    let emp = await Employee.create(createData);

    await gradeBandAssignmentService.writeAudit({
      models: getModels(req),
      tenantId,
      entityId: emp._id,
      action: 'GRADE_BAND_ASSIGNED',
      before: null,
      after: {
        designationId: emp.designationId || null,
        gradeId: emp.gradeId || null,
        bandId: emp.bandId || null,
        band: emp.band || '',
        salary: emp.salary || 0,
        payrollTemplateId: emp.payrollTemplateId || emp.salaryTemplateId || null,
      },
      performedBy: req.user?._id || req.user?.id || null,
      meta: { source: 'employee_create' },
    });

    // --- NEW: Update Snapshot & BGV Ownership ---
    if (emp) {
      const db = req.tenantDB;

      // Update Salary Snapshot
      if (applicantSnapshotId) {
        try {
          const EmployeeSalarySnapshot = db.model('EmployeeSalarySnapshot');
          const linkedSnapshot = await EmployeeSalarySnapshot.findByIdAndUpdate(
            applicantSnapshotId,
            { employee: emp._id },
            { new: true }
          );
          if (linkedSnapshot) {
            await salarySnapshotCanonicalSync.syncCanonicalPayrollFromSnapshot(
              db,
              req.tenantId || req.user?.tenantId,
              emp._id,
              linkedSnapshot,
              req.user?._id || req.user?.id || null,
              {
                effectiveFrom: emp.joiningDate || linkedSnapshot.effectiveFrom,
                reason: 'Candidate salary snapshot converted to employee payroll'
              }
            );
          }
        } catch (snapErr) { console.error("Snapshot link fail:", snapErr); }
      }

      // Update BGV Case: Link Employee & Mark Immutable
      if (bgvCaseId) {
        try {
          const BGVCase = db.model('BGVCase');
          await BGVCase.findByIdAndUpdate(bgvCaseId, {
            employeeId: emp._id,
            isImmutable: true,
            $push: { logs: { action: 'LOCKED_ON_HIRE', performedBy: 'System', remarks: `BGV Locked upon employee creation (${emp.employeeId})` } }
          });
          // console.log(`[ONBOARDING] BGV Case ${bgvCaseId} linked to Employee ${emp._id} and LOCKED.`);
        } catch (bgvErr) { console.error("BGV link fail:", bgvErr); }
      }
    }

    // Strict company-policy assignment with first-year prorating
    try {
      const { Employee, LeavePolicy, LeaveBalance, Grade } = getModels(req);

      await leaveManagementService.assignPolicyToEmployee({
        employee: emp,
        tenantId,
        policy: null,
        year: createData.joiningDate.getFullYear(),
        prorate: true,
        models: { Employee, LeavePolicy, LeaveBalance, Grade }
      });
      // console.log(`[AUTO_POLICY_ASSIGN] Assigned leave policy for employee ${emp.employeeId}`);
    } catch (autoErr) {
      console.error('[AUTO_POLICY_ASSIGN] Error while auto-assigning policy:', autoErr);
      if (autoErr.statusCode || isMongoCollectionLimitError(autoErr)) {
        console.warn(`[AUTO_POLICY_ASSIGN] Continuing without leave policy for ${emp.employeeId}: ${autoErr.message}`);
      } else {
        throw autoErr;
      }
    }

    // --- NEW: Link Applicant if exists (Mark Onboarded) ---
    if (applicantId && emp) {
      try {
        const Applicant = req.tenantDB.model('Applicant');
        await Applicant.findByIdAndUpdate(applicantId, {
          isOnboarded: true,
          employeeId: emp._id
        });
        // console.log(`[ONBOARDING] Linked Applicant ${applicantId} to Employee ${emp._id} (Marked Onboarded)`);
      } catch (linkErr) {
        console.error("Failed to link applicant:", linkErr);
      }
    }

    // Keep GT ONE/global auth in sync for employee email/employeeId login (non-fatal on failure)
    try {
      const User = getGlobalUserModel();
      const normalizedEmail = String(emp?.email || '').toLowerCase().trim();
      const normalizedEmpId = String(emp?.employeeId || '').trim();

      const bcrypt = require('bcryptjs');
      let nextPasswordHash = null;
      if (typeof req.body?.password === 'string' && req.body.password.trim()) {
        const salt = await bcrypt.genSalt(10);
        nextPasswordHash = await bcrypt.hash(req.body.password.trim(), salt);
      }

      const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || normalizedEmpId || normalizedEmail;
      const lookupEmail = normalizedEmail || null;

      if (lookupEmail) {
        const existingUser = await User.findOne({ email: lookupEmail }).lean();
        if (!existingUser) {
          await User.create({
            name,
            email: lookupEmail,
            password: nextPasswordHash || emp.password,
            role: 'employee',
            mainCompanyId: tenantId,
            tenant: tenantId,
            companyId: tenantId,
            permissions: getDefaultPerms('employee'),
          });
        } else if (String(existingUser.role || '').toLowerCase() === 'employee') {
          await User.findByIdAndUpdate(existingUser._id, {
            $set: {
              name,
              mainCompanyId: tenantId,
              tenant: tenantId,
              companyId: tenantId,
              ...(nextPasswordHash ? { password: nextPasswordHash } : {}),
            }
          });
        }
      }
    } catch (syncErr) {
      console.warn('[EMPLOYEE_CREATE] Global login sync warning:', syncErr.message);
    }

    _invalidateOrgCache(tenantId);
    await emp.populate('gradeId', GRADE_PUBLIC_SELECT);
    res.json({ success: true, data: sanitizeEmployee(emp) });

  } catch (err) {
    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, '..', 'create_error.log'), `ERROR: ${err.message}\nSTACK: ${err.stack}\nNAME: ${err.name}`);
    console.error('Employee create error:', err);

    // Duplicate employeeId or other unique index issues
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        error: "employee_duplicate",
        message: `Employee with this ${field} already exists.`
      });
    }

    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.code || "validation_failed",
        message: err.message
      });
    }

    if (isMongoCollectionLimitError(err)) {
      return res.status(507).json({
        success: false,
        error: "database_collection_limit_reached",
        message: "Database collection limit reached. Please clean up unused company databases or upgrade the MongoDB cluster before creating new employee records."
      });
    }

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors || {}).map(e => e.message).join(', ');
      return res.status(400).json({
        success: false,
        error: "validation_failed",
        message: details || "Employee validation failed."
      });
    }

    res.status(500).json({
      success: false,
      error: "create_failed",
      message: err.message || "Failed to create employee",
      // Note: stack traces are never exposed in responses
    });
  }
};

/* ---------------------------------------------
   GET EMPLOYEE
--------------------------------------------- */
exports.get = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;

    const emp = await Employee.findOne(buildEmployeeScopeFilter(req.params.id, tenantId))
      .populate('departmentId', 'name')
      .populate('manager', 'firstName lastName employeeId')
      .populate('gradeId', GRADE_PUBLIC_SELECT)
      .populate('leavePolicy', 'name applicableTo applicableBands applicableJobTypes gradeIds gradeCodes status isActive rules')
      .populate('shiftId', 'name startTime endTime shiftCode shiftType isNightShift')
      .lean();
    if (!emp) return res.status(404).json({ success: false, error: "not_found" });
    await backfillEmployeeTenant(Employee, emp, tenantId);
    // Security: strip sensitive fields before responding
    res.json({ success: true, data: sanitizeEmployee(emp) });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "get_failed" });
  }
};

exports.getLeaveBalance = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;

    const employee = await Employee.findOne(buildEmployeeScopeFilter(req.params.id, tenantId))
      .select('employeeId firstName lastName leavePolicy leaveBalance leaveBalanceYear joiningDate');

    if (!employee) {
      return res.status(404).json({ success: false, error: "not_found", message: "Employee not found" });
    }

    await backfillEmployeeTenant(Employee, employee, tenantId);

    return res.json({
      success: true,
      data: {
        employeeId: employee._id,
        employeeCode: employee.employeeId,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        joiningDate: employee.joiningDate,
        leavePolicy: employee.leavePolicy,
        leaveBalanceYear: employee.leaveBalanceYear,
        leaveBalance: employee.leaveBalance || {}
      }
    });
  } catch (err) {
    console.error('Employee leave balance error:', err);
    return res.status(500).json({ success: false, error: "leave_balance_failed", message: err.message || "Failed to fetch leave balance" });
  }
};

/* ---------------------------------------------
   CURRENT LOGGED-IN EMPLOYEE
--------------------------------------------- */
exports.me = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user?.id;

    const emp = await Employee.findOne({ _id: userId, tenant: tenantId })
      .populate('gradeId', GRADE_PUBLIC_SELECT)
      .populate('shiftId', 'name startTime endTime shiftCode shiftType isNightShift')
      .lean();

    if (!emp) return res.status(404).json({ success: false, error: "not_found" });
    // Security: strip sensitive fields before responding
    res.json({ success: true, data: sanitizeEmployee(emp) });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "me_failed" });
  }
};

/* ---------------------------------------------
   UPDATE EMPLOYEE
--------------------------------------------- */
exports.update = async (req, res) => {
  try {
    const { Employee, Grade } = getModels(req);
    const tenantId = req.tenantId;

    const updatePayload = { ...req.body };
    const resolvedGrade = await resolveEmployeeGrade({
      Grade,
      tenantId,
      gradeId: updatePayload.gradeId,
      grade: updatePayload.grade,
    });
    delete updatePayload.gradeId;
    delete updatePayload.leavePolicy;

    if (resolvedGrade.hasGradeId) {
      updatePayload.gradeId = resolvedGrade.gradeId;
      if (
        resolvedGrade.legacyGradeName &&
        (!updatePayload.grade || mongoose.Types.ObjectId.isValid(String(updatePayload.grade)))
      ) {
        updatePayload.grade = resolvedGrade.legacyGradeName;
      }
    }

    // Password update: hash when a new password is provided.
    if (typeof updatePayload.password === 'string') {
      const nextPass = updatePayload.password.trim();
      if (nextPass) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        updatePayload.password = await bcrypt.hash(nextPass, salt);
      } else {
        delete updatePayload.password;
      }
    }

    // Contact Number Cleaning & Validation
    const cleanPhone = (num) => {
      if (!num) return num;
      let digits = String(num).replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      return digits;
    };

    if (updatePayload.contactNo) updatePayload.contactNo = cleanPhone(updatePayload.contactNo);
    if (updatePayload.emergencyContactNumber) updatePayload.emergencyContactNumber = cleanPhone(updatePayload.emergencyContactNumber);

    const phoneRe = /^\d{8,15}$/;
    const isDraft = updatePayload.status === 'Draft' || (await Employee.findById(req.params.id))?.status === 'Draft';

    if (!isDraft) {
      if (updatePayload.contactNo && !phoneRe.test(updatePayload.contactNo)) {
        return res.status(400).json({ success: false, error: "invalid_contact", message: "Contact number must be between 8 and 15 digits." });
      }
      if (updatePayload.emergencyContactNumber && !phoneRe.test(updatePayload.emergencyContactNumber)) {
        return res.status(400).json({ success: false, error: "invalid_emergency_contact", message: "Emergency contact must be between 8 and 15 digits." });
      }
    }

    // delete updatePayload.employeeId; <= MODIFIED: Allow update if Draft
    delete updatePayload.tenant;

    // Handle joiningDate conversion if provided
    if (updatePayload.joiningDate) {
      updatePayload.joiningDate = new Date(updatePayload.joiningDate);
    }

    // 1. Fetch Existing Employee to check Status
    const existing = await Employee.findOne(buildEmployeeScopeFilter(req.params.id, tenantId));
    if (!existing) return res.status(404).json({ error: "not_found", message: "Employee not found" });
    await backfillEmployeeTenant(Employee, existing, tenantId);
    if (!hasTenantValue(existing.tenant) && hasTenantValue(tenantId)) {
      updatePayload.tenant = tenantId;
    }

    const nextDepartmentId = updatePayload.departmentId || existing.departmentId;
    const nextDesignationId = updatePayload.designationId || existing.designationId;
    const nextSalary = updatePayload.salary !== undefined ? updatePayload.salary : existing.salary;
    const gradeBandInputChanged =
      updatePayload.departmentId !== undefined ||
      updatePayload.designationId !== undefined ||
      updatePayload.salary !== undefined;

    if (gradeBandInputChanged && nextDepartmentId && nextDesignationId) {
      const assignment = await gradeBandAssignmentService.resolveAssignment({
        models: getModels(req),
        tenantId,
        departmentId: nextDepartmentId,
        designationId: nextDesignationId,
        salary: nextSalary,
      });
      gradeBandAssignmentService.applyAssignmentToPayload(updatePayload, assignment, {
        allowGradeOverride: canOverrideGradeBand(req),
        allowBandOverride: canOverrideGradeBand(req),
      });
    }

    // 2. Safeguard: Only allow employeeId update if status is 'Draft' OR generation mode is 'MANUAL'
    const companyIdConfig = require('./companyIdConfig.controller');
    const idResult = await companyIdConfig.generateIdInternal({
      tenantId: tenantId,
      entityType: 'EMP',
      increment: false
    });
    const generationMode = idResult.generationMode || 'AUTO';

    if (existing.status !== 'Draft' && generationMode !== 'MANUAL') {
      delete updatePayload.employeeId;
    } else if (updatePayload.employeeId && updatePayload.employeeId !== existing.employeeId) {
      // If employeeId is being updated (either in Draft or MANUAL mode), check for duplicates
      const exists = await Employee.findOne({
        employeeId: updatePayload.employeeId,
        tenant: tenantId,
        _id: { $ne: req.params.id } // Exclude current employee
      });
      if (exists) {
        return res.status(400).json({
          success: false,
          error: "employeeId_exists",
          message: "Employee ID already in use. Please provide a unique ID."
        });
      }
    }

    const oldStatus = existing.status;
    const newStatus = updatePayload.status;
    const oldGradeId = existing.gradeId ? String(existing.gradeId) : '';
    const oldGradeName = String(existing.grade || '').trim();
    const oldBand = String(existing.band || '').trim();
    const oldBandId = existing.bandId ? String(existing.bandId) : '';
    const oldSalary = Number(existing.salary || 0);
    const oldPayrollTemplateId = String(existing.payrollTemplateId || existing.salaryTemplateId || '');
    const oldDepartmentId = existing.departmentId ? String(existing.departmentId) : '';
    const oldDepartment = String(existing.department || '').trim();
    const oldEmployeeType = String(existing.employeeType || existing.jobType || '').trim();
    const oldDesignation = String(existing.designation || existing.role || '').trim();

    // Require salary structure (Basic, HRA, Allowances, Deductions, CTC) before activating from Draft
    const activatingFromDraft = (oldStatus === 'Draft' || String(oldStatus).toLowerCase() === 'draft') &&
      (newStatus === 'Active' || newStatus === 'active' || String(newStatus).toLowerCase() === 'active');
    if (activatingFromDraft) {
      const hasStructure = await hasSalaryStructureForEmployee(req.tenantDB, req.tenantId, existing._id, existing);
      if (!hasStructure && !updatePayload.salaryTemplateId) {
        return res.status(400).json({
          success: false,
          error: 'salary_structure_required',
          message: 'Salary structure is required before activating the employee. Please add Basic, HRA, Allowances, Deductions and CTC (Salary Structure or Compensation) to activate.'
        });
      }
    }

    const emp = await Employee.findOneAndUpdate(
      buildEmployeeScopeFilter(req.params.id, tenantId),
      updatePayload,
      { new: true, runValidators: true }
    ).populate('gradeId', GRADE_PUBLIC_SELECT);

    if (!emp) return res.status(404).json({ error: "not_found", message: "Employee not found" });

    // Handle Headcount Changes on Status Change
    if (oldStatus !== newStatus) {
      const { Department, Position } = getModels(req);

      // Moving OUT of active
      if (oldStatus === 'active' && (newStatus === 'resigned' || newStatus === 'notice')) {
        if (emp.departmentId) await Department.findByIdAndUpdate(emp.departmentId, { $inc: { currentHeadcount: -1 } });
        if (emp.positionId) await Position.findByIdAndUpdate(emp.positionId, { $inc: { currentCount: -1 } });
      }

      // Moving INTO active (e.g. from notice/resigned - rare but possible)
      if (newStatus === 'active' && oldStatus !== 'active') {
        if (emp.departmentId) await Department.findByIdAndUpdate(emp.departmentId, { $inc: { currentHeadcount: 1 } });
        if (emp.positionId) await Position.findByIdAndUpdate(emp.positionId, { $inc: { currentCount: 1 } });
      }
    }



    // Re-initialize balances if policy or grade changed. Grade changes may alter the selected policy
    // and/or quota overrides for the current leave year.
    const gradeChanged =
      oldGradeId !== String(emp.gradeId || '') ||
      oldGradeName !== String(emp.grade || '').trim();

    const bandChanged = oldBand !== String(emp.band || '').trim();
    const gradeBandChanged =
      gradeChanged ||
      bandChanged ||
      oldBandId !== String(emp.bandId || '') ||
      oldSalary !== Number(emp.salary || 0) ||
      oldPayrollTemplateId !== String(emp.payrollTemplateId || emp.salaryTemplateId || '');
    const departmentChanged =
      oldDepartmentId !== String(emp.departmentId || '') ||
      oldDepartment !== String(emp.department || '').trim();
    const employeeTypeChanged = oldEmployeeType !== String(emp.employeeType || emp.jobType || '').trim();
    const designationChanged = oldDesignation !== String(emp.designation || emp.role || '').trim();
    const policyScopeChanged = gradeChanged || bandChanged || departmentChanged || employeeTypeChanged || designationChanged || activatingFromDraft;

    console.log(`[EMPLOYEE_UPDATE_DIAG] id=${emp.employeeId} policyScopeChanged=${policyScopeChanged} gradeChanged=${gradeChanged} bandChanged=${bandChanged} departmentChanged=${departmentChanged} employeeTypeChanged=${employeeTypeChanged} designationChanged=${designationChanged}`);

    if (policyScopeChanged) {
      try {
        console.log(`[EMPLOYEE_UPDATE_DIAG] Policy scope changed. Auto-resolving best policy...`);
        await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
          employee: emp,
          tenantId,
          tenantDB: req.tenantDB,
          year: new Date().getFullYear()
        });
      } catch (balErr) {
        console.error("Failed to update leave balances after grade change:", balErr);
      }
    }

    if (gradeBandChanged) {
      await gradeBandAssignmentService.writeAudit({
        models: getModels(req),
        tenantId,
        entityId: emp._id,
        action: 'GRADE_BAND_UPDATED',
        before: {
          gradeId: existing.gradeId || null,
          grade: existing.grade || '',
          bandId: existing.bandId || null,
          band: existing.band || '',
          salary: existing.salary || 0,
          payrollTemplateId: existing.payrollTemplateId || existing.salaryTemplateId || null,
        },
        after: {
          gradeId: emp.gradeId || null,
          grade: emp.grade || '',
          bandId: emp.bandId || null,
          band: emp.band || '',
          salary: emp.salary || 0,
          payrollTemplateId: emp.payrollTemplateId || emp.salaryTemplateId || null,
        },
        performedBy: req.user?._id || req.user?.id || null,
        meta: { source: 'employee_update' },
      });
    }

    _invalidateOrgCache(tenantId);
    if (!res.headersSent) {
      return res.json({ success: true, data: sanitizeEmployee(emp) });
    }

  } catch (err) {
    console.error('Employee update error:', err);

    if (res.headersSent) {
      console.warn('[UPDATE_EMPLOYEE] Headers already sent, skipping error response');
      return;
    }

    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.code || "validation_failed",
        message: err.message
      });
    }

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors || {}).map(e => e.message).join(', ');
      return res.status(400).json({
        success: false,
        error: "validation_failed",
        message: details || "Employee validation failed."
      });
    }

    // Duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "employee_duplicate",
        message: "Employee with this unique field already exists."
      });
    }

    res.status(500).json({
      success: false,
      error: "update_failed",
      message: err.message || "Failed to update employee"
    });
  }
};

/* ---------------------------------------------
   DELETE EMPLOYEE
--------------------------------------------- */
exports.remove = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;

    const emp = await Employee.findOneAndDelete(buildEmployeeScopeFilter(req.params.id, tenantId));

    if (!emp)
      return res.status(404).json({ error: "not_found" });

    _invalidateOrgCache(tenantId);
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "delete_failed" });
  }
};


// ── In-memory org-tree cache (2-minute TTL per tenant) ──────────────────────
// Placed here so it's available to setManager, removeManager, and companyOrgTree
const _orgTreeCache = new Map(); // tenantId → { payload, expiresAt }
const ORG_TREE_TTL_MS = 2 * 60 * 1000; // 2 minutes
function _invalidateOrgCache(tenantId) {
  if (tenantId) {
    _orgTreeCache.delete(String(tenantId));
    _orgTreeCache.delete(String(tenantId) + '_structural');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

/* ---------------------------------------------
   ORG / REPORTING: Set manager, list direct reports, reporting chain, org tree
   IMPROVED: Better validation, cycle prevention, tenant checks, optimized queries
--------------------------------------------- */

/**
 * SET MANAGER - Improved with comprehensive validation
 * - Prevents self-assignment
 * - Prevents circular chains
 * - Validates tenant match
 * - Optimized queries with lean() and projection
 */
exports.setManager = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const empId = req.params.id;
    const { managerId } = req.body; // may be null to clear manager

    // Validate id formats early to avoid cast errors
    const ObjectId = mongoose.Types.ObjectId;
    if (!ObjectId.isValid(empId)) {
      console.warn(`setManager: invalid employee id received: ${empId}`);
      return res.status(400).json({ error: 'invalid_employee_id', message: 'Invalid employee id' });
    }
    if (managerId && managerId !== null && managerId !== '') {
      if (!ObjectId.isValid(managerId)) {
        console.warn(`setManager: invalid manager id received: ${managerId}`);
        return res.status(400).json({ error: 'invalid_manager_id', message: 'Invalid manager id' });
      }
    }

    // Validation 1: Prevent employee from becoming their own manager
    if (managerId && String(managerId) === String(empId)) {
      return res.status(400).json({ error: 'cannot_set_self_manager', message: 'Employee cannot be their own manager' });
    }

    // Get employee with minimal projection for performance
    const emp = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('_id manager tenant department role')
      .lean();

    if (!emp) {
      return res.status(404).json({ error: 'employee_not_found', message: 'Employee not found' });
    }

    // If clearing manager (setting to null)
    if (!managerId || managerId === null || managerId === '') {
      await Employee.updateOne(
        { _id: empId, tenant: tenantId },
        { $set: { manager: null } }
      );

      // Return updated employee with full details
      const updated = await Employee.findOne({ _id: empId, tenant: tenantId })
        .select('-password')
        .lean();

      return res.json({
        success: true,
        employee: updated,
        message: 'Manager removed successfully'
      });
    }

    // Validation 2: Manager must exist and be from same tenant
    const mgr = await Employee.findOne({ _id: managerId, tenant: tenantId })
      .select('_id manager tenant department role')
      .lean();

    if (!mgr) {
      return res.status(404).json({
        error: 'manager_not_found',
        message: 'Manager not found or belongs to different tenant'
      });
    }

    // Validation 3: Prevent circular management chain
    // Walk up the manager's chain to ensure we don't create a cycle
    const visited = new Set([String(empId)]); // Track visited nodes to prevent cycles
    let current = mgr;
    const MAX_DEPTH = 1000; // Safety limit for very deep hierarchies
    let depth = 0;

    while (current && current.manager) {
      const currentManagerId = String(current.manager);

      // If we encounter the employee in the manager's chain, it's a cycle
      if (visited.has(currentManagerId)) {
        return res.status(400).json({
          error: 'cycle_detected',
          message: 'This assignment would create a circular management chain'
        });
      }

      visited.add(currentManagerId);

      // If the manager's manager is the employee, it's a cycle
      if (currentManagerId === String(empId)) {
        return res.status(400).json({
          error: 'cycle_detected',
          message: 'This assignment would create a circular management chain'
        });
      }

      // Get next manager in chain
      current = await Employee.findOne({ _id: current.manager, tenant: tenantId })
        .select('_id manager')
        .lean();

      depth++;
      if (depth > MAX_DEPTH) {
        console.warn('Max depth reached while checking for cycles');
        break;
      }
    }

    // Validation 4: Manager/Department check
    // NOTE: previously we rejected assignments where employee and manager had different department values.
    // That constraint caused many valid assignments to fail when departments are stored as names/codes or when
    // managers span departments. Relaxing to WARN only — we keep the check logged for diagnostics.
    try {
      if (emp.department && mgr.department && String(emp.department) !== String(mgr.department)) {
        console.warn(`setManager: department mismatch for emp=${empId} (empDept=${emp.department}) vs mgr=${managerId} (mgrDept=${mgr.department}). Allowing assignment.`);
      }
    } catch (e) {
      // Defensive: if dept fields are unexpected, don't block the operation
      console.warn('setManager: department comparison failed', e && e.message);
    }

    // Debug log: input summary (helpful when reproducing client 400/500)
    console.debug(`setManager: emp=${empId} manager=${managerId} tenant=${tenantId}`);

    // All validations passed - update manager
    await Employee.updateOne(
      { _id: empId, tenant: tenantId },
      { $set: { manager: managerId } }
    );

    // Return updated employee with populated manager details
    const updated = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('-password')
      .populate('manager', 'firstName lastName employeeId role department')
      .lean();

    // Invalidate org tree cache so the next request reflects the new manager assignment
    _invalidateOrgCache(tenantId);

    res.json({
      success: true,
      employee: updated,
      message: 'Manager assigned successfully'
    });

  } catch (err) {
    console.error('setManager error:', err);
    res.status(500).json({ error: 'set_manager_failed', message: err.message });
  }
};

/**
 * REMOVE MANAGER - Dedicated endpoint to clear manager
 */
exports.removeManager = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const empId = req.params.id;

    const emp = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('_id manager')
      .lean();

    if (!emp) {
      return res.status(404).json({ error: 'employee_not_found' });
    }

    await Employee.updateOne(
      { _id: empId, tenant: tenantId },
      { $set: { manager: null } }
    );

    const updated = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('-password')
      .lean();

    // Invalidate org tree cache so the next request reflects the cleared manager
    _invalidateOrgCache(tenantId);

    res.json({
      success: true,
      employee: updated,
      message: 'Manager removed successfully'
    });

  } catch (err) {
    console.error('removeManager error:', err);
    res.status(500).json({ error: 'remove_manager_failed', message: err.message });
  }
};

/**
 * GET DIRECT REPORTS - Optimized with projection
 */
exports.directReports = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const managerId = req.params.id;

    // Optimized query with projection - only fetch needed fields
    const items = await Employee.find({ tenant: tenantId, manager: managerId })
      .select('firstName lastName employeeId role department departmentId email profilePic')
      .populate('departmentId', 'name')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const normalizedItems = items.map(emp => ({
      ...emp,
      department: (emp.departmentId && emp.departmentId.name) || emp.department || 'General',
      departmentId: emp.departmentId ? (emp.departmentId._id || emp.departmentId) : null
    }));

    res.json(normalizedItems);
  } catch (err) {
    console.error('directReports error:', err);
    res.status(500).json({ error: 'direct_reports_failed', message: err.message });
  }
};

/**
 * GET MANAGER - Optimized with projection
 */
exports.getManager = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const empId = req.params.id;

    const emp = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('manager')
      .populate('manager', 'firstName lastName employeeId role department email profilePic')
      .lean();

    if (!emp) {
      return res.status(404).json({ error: 'not_found', message: 'Employee not found' });
    }

    res.json(emp.manager || null);
  } catch (err) {
    console.error('getManager error:', err);
    res.status(500).json({ error: 'get_manager_failed', message: err.message });
  }
};

/**
 * GET REPORTING CHAIN - Walk up the management chain
 * Optimized: Uses projection and handles null managers gracefully
 */
exports.reportingChain = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const empId = req.params.id;

    const chain = [];
    const visited = new Set(); // Prevent infinite loops
    let current = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('manager')
      .lean();

    if (!current) {
      return res.status(404).json({ error: 'not_found', message: 'Employee not found' });
    }

    const MAX_DEPTH = 200;
    let depth = 0;

    // Walk up the chain
    while (current && current.manager) {
      const managerId = String(current.manager);

      // Prevent infinite loops
      if (visited.has(managerId)) {
        console.warn('Circular reference detected in reporting chain');
        break;
      }
      visited.add(managerId);

      // Get manager details with optimized projection
      const mgr = await Employee.findOne({ _id: managerId, tenant: tenantId })
        .select('firstName lastName employeeId role department email profilePic manager')
        .lean();

      if (!mgr) break;

      chain.push(mgr);
      current = mgr;
      depth++;

      if (depth > MAX_DEPTH) {
        console.warn('Max depth reached in reporting chain');
        break;
      }
    }

    res.json(chain);
  } catch (err) {
    console.error('reportingChain error:', err);
    res.status(500).json({ error: 'reporting_chain_failed', message: err.message });
  }
};

/**
 * BUILD SUBTREE - Optimized recursive function for org tree
 * - Uses lean() for performance
 * - Uses projection to fetch only needed fields
 * - Handles null managers gracefully
 * - Prevents infinite recursion
 */
async function buildSubtree(Employee, tenantId, empId, depthLeft, visited = new Set()) {
  // Prevent infinite recursion
  const empIdStr = String(empId);
  if (visited.has(empIdStr)) {
    console.warn(`Circular reference detected for employee ${empIdStr}`);
    return [];
  }
  visited.add(empIdStr);

  // Base case: depth limit reached
  if (depthLeft <= 0) {
    // Still fetch direct reports but mark as leaf nodes
    const subs = await Employee.find({ tenant: tenantId, manager: empId })
      .select('firstName lastName employeeId role department email profilePic')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return subs.map(s => ({ ...s, reports: [] }));
  }

  // Fetch direct reports with optimized projection
  const subs = await Employee.find({ tenant: tenantId, manager: empId })
    .select('firstName lastName employeeId role department email profilePic')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  if (!subs || subs.length === 0) {
    return [];
  }

  // Recursively build subtree for each direct report
  const results = [];
  for (const sub of subs) {
    const reports = await buildSubtree(Employee, tenantId, sub._id, depthLeft - 1, new Set(visited));
    results.push({ ...sub, reports });
  }

  return results;
}

const ORG_SELECT_FIELDS = 'firstName lastName employeeId role department departmentId email profilePic manager status designation';

function getManagerId(emp) {
  if (!emp || !emp.manager) return null;
  if (typeof emp.manager === 'string') return emp.manager;
  if (emp.manager && emp.manager._id) return String(emp.manager._id);
  if (typeof emp.manager.toString === 'function') return String(emp.manager);
  return null;
}

function normalizeOrgEmployee(emp) {
  return {
    _id: emp._id,
    firstName: emp.firstName || '',
    lastName: emp.lastName || '',
    employeeId: emp.employeeId || '',
    role: emp.role || '',
    department: (emp.departmentId && emp.departmentId.name) || emp.department || 'General',
    departmentId: emp.departmentId ? (emp.departmentId._id || emp.departmentId) : null,
    email: emp.email || '',
    profilePic: emp.profilePic || null,
    status: emp.status || '',
    designation: emp.designation || emp.role || '',
    manager: getManagerId(emp),
    subordinates: []
  };
}

function buildOrgHierarchyFromEmployees(allEmployees, depth = 10) {
  const employeeMap = new Map();
  const roots = [];
  const safeDepth = Math.min(Math.max(Number(depth) || 10, 1), 20);

  allEmployees.forEach((emp) => {
    if (!emp || !emp._id) return;
    employeeMap.set(String(emp._id), normalizeOrgEmployee(emp));
  });

  employeeMap.forEach((emp, empId) => {
    const managerId = emp.manager;

    if (!managerId || managerId === empId || managerId === '') {
      roots.push(emp);
      return;
    }

    const manager = employeeMap.get(managerId);
    if (!manager) {
      roots.push(emp);
      return;
    }

    if (!manager.subordinates.some(sub => String(sub._id) === empId)) {
      manager.subordinates.push(emp);
    }
  });

  const seenRoots = new Set();
  const uniqueRoots = roots.filter((root) => {
    const id = String(root._id);
    if (seenRoots.has(id)) return false;
    seenRoots.add(id);
    return true;
  });

  function sortTree(node) {
    node.subordinates.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    node.subordinates.forEach(sortTree);
  }

  function limitDepth(node, currentDepth, visited = new Set()) {
    const id = String(node._id);
    if (visited.has(id)) {
      node.subordinates = [];
      return;
    }

    visited.add(id);
    if (currentDepth >= safeDepth) {
      node.subordinates = [];
      return;
    }

    node.subordinates.forEach(sub => limitDepth(sub, currentDepth + 1, new Set(visited)));
  }

  uniqueRoots.forEach((root) => {
    sortTree(root);
    limitDepth(root, 0);
  });

  function countInTree(node, visited = new Set()) {
    const id = String(node._id);
    if (visited.has(id)) return 0;
    visited.add(id);
    return 1 + node.subordinates.reduce((sum, sub) => sum + countInTree(sub, new Set(visited)), 0);
  }

  const withManager = allEmployees.filter(e => {
    const managerId = getManagerId(e);
    return managerId && managerId !== String(e._id) && managerId !== '';
  }).length;

  return {
    roots: uniqueRoots,
    stats: {
      total: allEmployees.length,
      roots: uniqueRoots.length,
      withManager,
      withoutManager: allEmployees.length - withManager,
      inTree: uniqueRoots.reduce((sum, root) => sum + countInTree(root), 0)
    }
  };
}

function toReportsTree(node) {
  const { subordinates = [], ...rest } = node;
  return {
    ...rest,
    reports: subordinates.map(toReportsTree)
  };
}

/**
 * GET ORG TREE - Get organizational tree starting from a specific employee
 * Improved: Better error handling, optimized queries, null manager handling
 */
exports.orgTree = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const empId = req.params.id;
    const depth = Math.min(parseInt(req.query.depth || '5', 10), 20); // Cap at 20 for performance

    // Get root employee with optimized projection
    const root = await Employee.findOne({ _id: empId, tenant: tenantId })
      .select('firstName lastName employeeId role department email profilePic manager')
      .lean();

    if (!root) {
      return res.status(404).json({ error: 'not_found', message: 'Employee not found' });
    }

    // Build subtree recursively
    const reports = await buildSubtree(Employee, tenantId, root._id, depth);

    res.json({
      root,
      reports,
      depth: depth,
      totalReports: reports.length
    });
  } catch (err) {
    console.error('orgTree error:', err);
    res.status(500).json({ error: 'org_tree_failed', message: err.message });
  }
};

exports.getOrgRoot = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
    const rootId = tenant?.meta?.orgRootEmployeeId || null;
    if (!rootId) return res.json(null);
    const { Employee } = getModels(req);
    const emp = await Employee.findOne({ _id: rootId, tenant: tenantId }).select('-password').lean();
    res.json(emp || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'get_org_root_failed' });
  }
};

exports.setOrgRoot = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { employeeId } = req.body;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
    const { Employee } = getModels(req);
    const emp = await Employee.findOne({ _id: employeeId, tenant: tenantId }).select('-password');
    if (!emp) return res.status(404).json({ error: 'employee_not_found' });
    tenant.meta = tenant.meta || {};
    tenant.meta.orgRootEmployeeId = String(emp._id);
    await tenant.save();
    res.json(emp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'set_org_root_failed' });
  }
};

/**
 * GET COMPANY ORG TREE - Get full company organizational tree from root
 * Improved: Better error handling, fallback to top-level employees if root not set
 * Performance: Results are cached per-tenant for 2 minutes to avoid repeated
 *              full-table scans on every page refresh.
 */
exports.companyOrgTree = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const depth = Math.min(parseInt(req.query.depth || '8', 10), 20); // Default 8, cap at 20
    const { Employee } = getModels(req);

    const cacheKey = String(tenantId) + '_structural';
    const cached = _orgTreeCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json({ ...cached.payload, cached: true });
    }

    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found', message: 'Tenant not found' });
    }

    const allEmployees = await Employee.find({ tenant: tenantId })
      .select(ORG_SELECT_FIELDS)
      .populate('departmentId', 'name')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    if (!allEmployees || allEmployees.length === 0) {
      return res.json({
        root: null, roots: [], reports: [], hierarchy: [], depth, totalReports: 0,
        source: 'empty', stats: { total: 0, roots: 0, withManager: 0, withoutManager: 0, inTree: 0 }
      });
    }

    // --- STRUCTURAL BUILDER (Organization -> Departments -> Employees) ---
    const departmentEmployees = new Map();
    const employeeMap = new Map();

    allEmployees.forEach(emp => {
      const normalized = normalizeOrgEmployee(emp);
      employeeMap.set(String(emp._id), normalized);

      const deptName = normalized.department || 'General';
      if (!departmentEmployees.has(deptName)) {
        departmentEmployees.set(deptName, []);
      }
      departmentEmployees.get(deptName).push(normalized);
    });

    const departmentNodes = [];

    departmentEmployees.forEach((employeesInDept, deptName) => {
      const deptId = 'dept-' + deptName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const deptEmpMap = new Map();
      
      employeesInDept.forEach(emp => {
        deptEmpMap.set(String(emp._id), emp);
      });

      const deptRoots = [];

      employeesInDept.forEach(emp => {
        const managerId = emp.manager;
        if (managerId && deptEmpMap.has(String(managerId))) {
          const managerNode = deptEmpMap.get(String(managerId));
          managerNode.subordinates.push(emp);
        } else {
          deptRoots.push(emp);
        }
      });

      departmentNodes.push({
        _id: deptId,
        type: 'department',
        isDepartment: true,
        firstName: deptName,
        lastName: 'Department',
        role: 'Department',
        department: deptName,
        subordinates: deptRoots,
        isExpanded: true
      });
    });

    // Sort departments alphabetically
    departmentNodes.sort((a, b) => a.firstName.localeCompare(b.firstName));

    const companyNode = {
      _id: 'company-root',
      type: 'company',
      isCompany: true,
      firstName: tenant.companyName || 'Company',
      lastName: '',
      role: 'Organization',
      subordinates: departmentNodes,
      isExpanded: true
    };

    const payload = {
      root: companyNode,
      roots: [companyNode],
      reports: companyNode.subordinates.map(toReportsTree),
      hierarchy: [companyNode],
      depth,
      totalReports: allEmployees.length,
      source: 'structural_tree',
      stats: { inTree: allEmployees.length }
    };

    _orgTreeCache.set(cacheKey, { payload, expiresAt: Date.now() + ORG_TREE_TTL_MS });
    res.json(payload);

  } catch (err) {
    console.error('companyOrgTree error:', err);
    res.status(500).json({ error: 'company_org_tree_failed', message: err.message });
  }
};

/**
 * GET TOP-LEVEL EMPLOYEES - Employees with no manager (CEO/Founders)
 * New endpoint for better UX
 */
exports.getTopLevelEmployees = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;

    const allEmployees = await Employee.find({ tenant: tenantId })
      .select(ORG_SELECT_FIELDS)
      .populate('departmentId', 'name')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const { roots, stats } = buildOrgHierarchyFromEmployees(allEmployees, 1);

    res.json({
      employees: roots.map(({ subordinates, ...emp }) => emp),
      count: roots.length,
      stats
    });
  } catch (err) {
    console.error('getTopLevelEmployees error:', err);
    res.status(500).json({ error: 'get_top_level_failed', message: err.message });
  }
};

/* ---------------------------------------------
   GET FULL HIERARCHY (CEO → HR → Employees)
   Returns complete nested structure
   IMPROVED: Optimized queries, better null handling, depth limiting
--------------------------------------------- */
exports.getHierarchy = async (req, res) => {
  try {
    // Validate tenant context
    if (!req.user || !req.user.tenantId) {
      console.error("getHierarchy ERROR: Missing user or tenantId in request");
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'User context or tenant not found'
      });
    }

    const tenantId = req.user.tenantId || req.tenantId;
    if (!tenantId) {
      console.error("getHierarchy ERROR: tenantId not available");
      return res.status(400).json({
        success: false,
        error: 'tenant_missing',
        message: 'Tenant ID is required'
      });
    }

    // Safe depth parsing: default 10, min 1, max 20
    const depth = Math.min(Math.max(parseInt(req.query.depth || '10', 10) || 10, 1), 20);

    // Ensure tenantDB is available
    if (!req.tenantDB) {
      try {
        const getTenantDB = require('../utils/tenantDB');
        req.tenantDB = await getTenantDB(tenantId);
        // Models are already registered by dbManager, no need to register here
      } catch (e) {
        console.error('getHierarchy: failed to get tenantDB', e.message);
        return res.status(500).json({
          success: false,
          error: 'tenant_db_missing',
          message: 'Tenant database connection not available'
        });
      }
    }

    // Get Employee model
    let Employee;
    try {
      const models = getModels(req);
      Employee = models.Employee;
      if (!Employee || typeof Employee.aggregate !== 'function') {
        throw new Error('Employee model is not properly initialized');
      }
    } catch (e) {
      console.error('getHierarchy: failed to get models', e.message);
      return res.status(500).json({
        success: false,
        error: 'model_error',
        message: 'Failed to load employee model'
      });
    }

    // Normalize tenantId to string for queries
    const tenantIdStr = typeof tenantId === 'string' ? tenantId : tenantId.toString();

    // Use MongoDB aggregation with $graphLookup for safe hierarchy building
    try {
      // First, get all employees to build hierarchy manually (more reliable than $graphLookup with tenant filtering)
      const allEmployees = await Employee.find({ tenant: tenantIdStr })
        .select('firstName lastName employeeId role department departmentId email profilePic manager')
        .populate('departmentId', 'name')
        .lean();

      // Handle empty result
      if (!allEmployees || allEmployees.length === 0) {
        return res.json({
          success: true,
          hierarchy: [],
          stats: {
            total: 0,
            roots: 0,
            withManager: 0,
            withoutManager: 0,
            inTree: 0
          }
        });
      }

      // Helper: safe manager ID extraction
      const getManagerId = (emp) => {
        if (!emp || !emp.manager) return null;
        if (typeof emp.manager === 'string') return emp.manager;
        if (emp.manager && emp.manager._id) return String(emp.manager._id);
        if (emp.manager && typeof emp.manager.toString === 'function') return String(emp.manager);
        return null;
      };

      // Build employee map
      const employeeMap = new Map();
      allEmployees.forEach(emp => {
        if (!emp || !emp._id) return;
        const empId = String(emp._id);
        employeeMap.set(empId, {
          _id: emp._id,
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          employeeId: emp.employeeId || '',
          role: emp.role || '',
          department: (emp.departmentId && emp.departmentId.name) || emp.department || 'General',
          departmentId: emp.departmentId ? (emp.departmentId._id || emp.departmentId) : null,
          email: emp.email || '',
          profilePic: emp.profilePic || null,
          manager: getManagerId(emp),
          subordinates: []
        });
      });

      // Build hierarchy tree
      const roots = [];
      employeeMap.forEach((emp, empId) => {
        const managerId = emp.manager;

        // Null checks: if no manager or manager is self, it's a root
        if (!managerId || managerId === empId || managerId === '') {
          roots.push(emp);
          return;
        }

        // Try to find manager in map
        const manager = employeeMap.get(managerId);
        if (manager) {
          // Add to manager's subordinates (avoid duplicates)
          if (!manager.subordinates.some(sub => String(sub._id) === empId)) {
            manager.subordinates.push(emp);
          }
        } else {
          // Manager not found (orphaned), treat as root
          roots.push(emp);
        }
      });

      // Limit depth recursively
      function limitDepth(node, currentDepth, visited = new Set()) {
        const id = String(node._id);
        if (visited.has(id)) return; // Cycle detected
        visited.add(id);

        if (currentDepth >= depth) {
          node.subordinates = [];
          return;
        }

        if (node.subordinates && node.subordinates.length > 0) {
          node.subordinates.forEach(sub => limitDepth(sub, currentDepth + 1, new Set(visited)));
        }
      }

      roots.forEach(root => limitDepth(root, 0));

      // Count employees in tree
      function countInTree(node, visited = new Set()) {
        const id = String(node._id);
        if (visited.has(id)) return 0;
        visited.add(id);
        let count = 1;
        if (node.subordinates && node.subordinates.length > 0) {
          node.subordinates.forEach(sub => {
            count += countInTree(sub, new Set(visited));
          });
        }
        return count;
      }

      const totalInTree = roots.reduce((sum, root) => sum + countInTree(root), 0);
      const withManager = allEmployees.filter(e => {
        const mgrId = getManagerId(e);
        return mgrId && mgrId !== String(e._id) && mgrId !== '';
      }).length;

      return res.json({
        success: true,
        hierarchy: roots,
        stats: {
          total: allEmployees.length,
          roots: roots.length,
          withManager: withManager,
          withoutManager: allEmployees.length - withManager,
          inTree: totalInTree
        }
      });

    } catch (dbError) {
      console.error('getHierarchy: database query error', dbError);
      console.error('Error:', dbError.message);
      if (dbError.stack) console.error('Stack:', dbError.stack);

      // Fallback: return empty hierarchy on error
      return res.json({
        success: true,
        hierarchy: [],
        stats: {
          total: 0,
          roots: 0,
          withManager: 0,
          withoutManager: 0,
          inTree: 0
        }
      });
    }

  } catch (err) {
    console.error('getHierarchy: unexpected error', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    if (err.stack) {
      console.error('Error stack:', err.stack);
    }

    return res.status(500).json({
      success: false,
      error: 'hierarchy_failed',
      message: err.message || 'Unknown error occurred while building hierarchy'
    });
  }
};

/* -----------------------------------------
   BULK UPLOAD TEMPLATE
----------------------------------------- */
// exports.downloadBulkUploadTemp = async (req, res) => {
//   try {
//     const XLSX = require('xlsx');

//     // Create a new workbook
//     const workbook = XLSX.utils.book_new();

//     // Sample data with all possible columns
//     const sampleData = [
//       {
//         'Employee ID': 'EMP001',
//         'First Name': 'John',
//         'Middle Name': 'M',
//         'Last Name': 'Doe',
//         'Email': 'john.doe@company.com',
//         'Contact No': '9876543210',
//         'Gender': 'Male',
//         'Date of Birth': '1990-01-15',
//         'Marital Status': 'Single',
//         'Blood Group': 'O+',
//         'Nationality': 'Indian',
//         'Father Name': 'James Doe',
//         'Mother Name': 'Jane Doe',
//         'Emergency Contact Name': 'Jane Doe',
//         'Emergency Contact Number': '9876543211',
//         'Temp Address Line 1': '123 Main St',
//         'Temp Address Line 2': 'Apt 4B',
//         'Temp City': 'New York',
//         'Temp State': 'NY',
//         'Temp Pin Code': '10001',
//         'Temp Country': 'USA',
//         'Perm Address Line 1': '456 Oak Ave',
//         'Perm Address Line 2': 'House 5',
//         'Perm City': 'Boston',
//         'Perm State': 'MA',
//         'Perm Pin Code': '02101',
//         'Perm Country': 'USA',
//         'Joining Date': '2024-01-01',
//         'Department': 'Tech',
//         'Role': 'employee',
//         'Job Type': 'Full-Time',
//         'Bank Name': 'State Bank',
//         'Account Number': '123456789',
//         'IFSC Code': 'SBIN0001234',
//         'Branch Name': 'Main Branch',
//         'Bank Location': 'New York'
//       }
//     ];

//     // Add headers with description
//     const headers = [
//       'Employee ID (Required)',
//       'First Name (Required)',
//       'Middle Name',
//       'Last Name (Required)',
//       'Email (Required)',
//       'Contact No',
//       'Gender (M/F/Other)',
//       'Date of Birth (YYYY-MM-DD)',
//       'Marital Status',
//       'Blood Group',
//       'Nationality',
//       'Father Name',
//       'Mother Name',
//       'Emergency Contact Name',
//       'Emergency Contact Number',
//       'Temp Address Line 1',
//       'Temp Address Line 2',
//       'Temp City',
//       'Temp State',
//       'Temp Pin Code',
//       'Temp Country',
//       'Perm Address Line 1',
//       'Perm Address Line 2',
//       'Perm City',
//       'Perm State',
//       'Perm Pin Code',
//       'Perm Country',
//       'Joining Date (YYYY-MM-DD, Required)',
//       'Department',
//       'Role',
//       'Job Type',
//       'Bank Name',
//       'Account Number',
//       'IFSC Code',
//       'Branch Name',
//       'Bank Location'
//     ];

//     // Create worksheet with sample data
//     const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: 1 });

//     // Set column widths for better readability
//     worksheet['!cols'] = [
//       { wch: 12 },
//       { wch: 12 },
//       { wch: 12 },
//       { wch: 12 },
//       { wch: 20 },
//       { wch: 12 },
//       { wch: 10 },
//       { wch: 15 },
//       { wch: 15 },
//       { wch: 12 },
//       { wch: 12 },
//       { wch: 15 },
//       { wch: 15 },
//       { wch: 20 },
//       { wch: 20 },
//       { wch: 20 },
//       { wch: 20 },
//       { wch: 15 },
//       { wch: 12 },
//       { wch: 12 },
//       { wch: 12 },
//       { wch: 20 },
//       { wch: 20 },
//       { wch: 15 },
//     res.status(500).json({
//       success: false,
//       error: 'template_generation_failed',
//       message: err.message || 'Failed to generate template'
//     });
//   }
// };
function autoFitColumns(worksheet, data) {
  const colWidths = [];

  data.forEach(row => {
    row.forEach((cell, colIndex) => {
      const cellValue = cell ? cell.toString() : '';
      colWidths[colIndex] = Math.max(
        colWidths[colIndex] || 10,
        cellValue.length + 2
      );
    });
  });

  worksheet['!cols'] = colWidths.map(wch => ({ wch }));
}

exports.downloadBulkUploadTemp = async (req, res) => {
  try {
    const XLSX = require('@sheetjs/xlsx');
    const wb   = XLSX.utils.book_new();

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION DEFINITIONS — each section has a name + array of fields
    // Row layout:
    //   Row 0  →  Section heading (MERGED across all its columns)
    //   Row 1  →  Field names
    //   Row 2  →  Required / Optional / Conditional
    //   Row 3+ →  Employee data (sample rows + blank entry rows)
    // ─────────────────────────────────────────────────────────────────────────
    const SECTIONS = [
      {
        name: 'Step 1 — Personal Information',
        fields: [
          { col: 'First Name',                    req: 'Required'    },
          { col: 'Middle Name',                   req: 'Optional'    },
          { col: 'Last Name',                     req: 'Required'    },
          { col: 'Gender',                        req: 'Required'    },
          { col: 'Date of Birth',                 req: 'Required'    },
          { col: 'Contact Number',                req: 'Required'    },
          { col: 'Blood Group',                   req: 'Required'    },
          { col: 'Marital Status',                req: 'Required'    },
          { col: 'Nationality',                   req: 'Required'    },
          { col: 'Emergency Contact Name',        req: 'Required'    },
          { col: 'Emergency Contact Number',      req: 'Required'    },
          { col: 'Personal Email',                req: 'Optional'    },
          { col: 'Place of Birth',                req: 'Optional'    },
          { col: 'Height',                        req: 'Optional'    },
          { col: 'Weight',                        req: 'Optional'    },
          { col: 'Cast / Category',               req: 'Optional'    },
          { col: 'Hobbies',                       req: 'Optional'    },
          { col: 'Physical Disability / Sickness',req: 'Optional'    },
          { col: 'Disability Details',            req: 'Conditional' },
        ]
      },
      {
        name: 'Step 2 — Job / Official Details',
        fields: [
          { col: 'Department',                    req: 'Required'    },
          { col: 'Joining Date',                  req: 'Required'    },
          { col: 'Grade',                         req: 'Required'    },
          { col: 'Band',                          req: 'Required'    },
          { col: 'Employee Type',                 req: 'Required'    },
          { col: 'Employee ID',                   req: 'Conditional' },
          { col: 'Designation',                   req: 'Optional'    },
          { col: 'Manager Employee ID',           req: 'Optional'    },
          { col: 'Work Mode',                     req: 'Optional'    },
          { col: 'Employment Type',               req: 'Optional'    },
          { col: 'Shift Name',                    req: 'Optional'    },
          { col: 'Leave Policy',                  req: 'Optional'    },
          { col: 'Sub Company',                   req: 'Optional'    },
          { col: 'Branch',                        req: 'Optional'    },
          { col: 'Division',                      req: 'Optional'    },
        ]
      },
      {
        name: 'Step 3 — Education Details',
        fields: [
          { col: 'Education Type',                req: 'Required'    },
          { col: 'University / Institution',      req: 'Optional'    },
          { col: '10th Marks / Percentage',       req: 'Optional'    },
          { col: '12th Marks / Percentage',       req: 'Optional'    },
          { col: 'Year of Passing',               req: 'Optional'    },
          { col: 'CGPA or Percentage (Degree)',   req: 'Optional'    },
          { col: 'Highest Qualification',         req: 'Optional'    },
        ]
      },
      {
        name: 'Step 4 — Identity Documents (KYC)',
        fields: [
          { col: 'Aadhar Number',                 req: 'Required'    },
          { col: 'PAN Number',                    req: 'Required'    },
        ]
      },
      {
        name: 'Step 5 — Work Experience',
        fields: [
          { col: 'Last Company Name',             req: 'Optional'    },
          { col: 'Experience From Date',          req: 'Conditional' },
          { col: 'Experience To Date',            req: 'Conditional' },
          { col: 'Last Drawn Salary',             req: 'Optional'    },
          { col: 'Reporting Person Name',         req: 'Conditional' },
          { col: 'Reporting Person Email',        req: 'Conditional' },
          { col: 'Reporting Person Contact',      req: 'Optional'    },
        ]
      },
      {
        name: 'Step 6 — Bank Details',
        fields: [
          { col: 'Bank Name',                     req: 'Required'    },
          { col: 'Account Number',                req: 'Required'    },
          { col: 'IFSC Code',                     req: 'Required'    },
          { col: 'Branch Name',                   req: 'Required'    },
          { col: 'Bank Location / City',          req: 'Optional'    },
        ]
      },
      {
        name: 'Step 7 — Languages & Previous Interview',
        fields: [
          { col: 'Languages Known',               req: 'Optional'    },
          { col: 'Language — Speak',              req: 'Optional'    },
          { col: 'Language — Read',               req: 'Optional'    },
          { col: 'Language — Write',              req: 'Optional'    },
          { col: 'Previous Interview with Company', req: 'Optional'  },
          { col: 'Previous Interview Date',       req: 'Conditional' },
          { col: 'Previous Interview Dept / Location', req: 'Conditional' },
          { col: 'Interviewed By',                req: 'Conditional' },
          { col: 'Company Car Model',             req: 'Optional'    },
          { col: 'Car Mileage (km)',               req: 'Optional'    },
          { col: 'Car Petrol (Rs/Month)',          req: 'Optional'    },
          { col: 'Leased Accommodation Details',  req: 'Optional'    },
          { col: 'Monthly Rent (Rs)',              req: 'Optional'    },
          { col: 'Security Deposit (Rs)',          req: 'Optional'    },
          { col: 'Hard Furnishing Limits',        req: 'Optional'    },
          { col: 'Incentive Particulars',         req: 'Optional'    },
          { col: 'Telephone Details',             req: 'Optional'    },
          { col: 'Tax at Source (Rs/Month)',       req: 'Optional'    },
          { col: 'Any Related Employee in Company', req: 'Optional'  },
          { col: 'Related Employee Name',         req: 'Conditional' },
          { col: 'Related Employee Relationship', req: 'Conditional' },
          { col: 'Related Employee Designation',  req: 'Optional'    },
          { col: 'Reference 1 — Name',            req: 'Optional'    },
          { col: 'Reference 1 — Company',         req: 'Optional'    },
          { col: 'Reference 1 — Designation',     req: 'Optional'    },
          { col: 'Reference 1 — Phone',           req: 'Optional'    },
          { col: 'Reference 1 — Email',           req: 'Optional'    },
          { col: 'Reference 1 — Period Known',    req: 'Optional'    },
          { col: 'Reference 2 — Name',            req: 'Optional'    },
          { col: 'Reference 2 — Company',         req: 'Optional'    },
          { col: 'Reference 2 — Phone',           req: 'Optional'    },
          { col: 'Reference 2 — Email',           req: 'Optional'    },
        ]
      },
      {
        name: 'Step 8 — Job History Annexure',
        fields: [
          { col: 'Company Name',                  req: 'Optional'    },
          { col: 'Company Turnover (Rs)',          req: 'Optional'    },
          { col: 'Total Employees',               req: 'Optional'    },
          { col: 'Industry',                      req: 'Optional'    },
          { col: 'Designation Held',              req: 'Optional'    },
          { col: 'Duties & Responsibilities',     req: 'Optional'    },
        ]
      },
      {
        name: 'Step 9 — Address Details',
        fields: [
          { col: 'Temp Address Line 1',           req: 'Optional'    },
          { col: 'Temp Address Line 2',           req: 'Optional'    },
          { col: 'Temp City',                     req: 'Optional'    },
          { col: 'Temp State',                    req: 'Optional'    },
          { col: 'Temp Pin Code',                 req: 'Optional'    },
          { col: 'Temp Country',                  req: 'Optional'    },
          { col: 'Perm Address Line 1',           req: 'Optional'    },
          { col: 'Perm Address Line 2',           req: 'Optional'    },
          { col: 'Perm City',                     req: 'Optional'    },
          { col: 'Perm State',                    req: 'Optional'    },
          { col: 'Perm Pin Code',                 req: 'Optional'    },
          { col: 'Perm Country',                  req: 'Optional'    },
        ]
      },
      {
        name: 'Step 10 — Login Credentials & Salary',
        fields: [
          { col: 'Official Email',                req: 'Required'    },
          { col: 'Password',                      req: 'Required'    },
          { col: 'Role / Access Level',           req: 'Optional'    },
        ]
      },
      {
        name: 'Family & Dependents',
        fields: [
          { col: 'Father First Name',             req: 'Optional'    },
          { col: 'Father Last Name',              req: 'Optional'    },
          { col: 'Father Blood Group',            req: 'Optional'    },
          { col: 'Father Aadhar Number',          req: 'Optional'    },
          { col: 'Mother First Name',             req: 'Optional'    },
          { col: 'Mother Last Name',              req: 'Optional'    },
          { col: 'Mother Blood Group',            req: 'Optional'    },
          { col: 'Mother Aadhar Number',          req: 'Optional'    },
          { col: 'Spouse Name',                   req: 'Optional'    },
          { col: 'Spouse Relation',               req: 'Optional'    },
          { col: 'Spouse Blood Group',            req: 'Optional'    },
          { col: 'Spouse Date of Birth',          req: 'Optional'    },
          { col: 'Spouse Contact No',             req: 'Optional'    },
          { col: 'Marriage Date',                 req: 'Optional'    },
          { col: 'Child 1 Name',                  req: 'Optional'    },
          { col: 'Child 1 Gender',                req: 'Optional'    },
          { col: 'Child 1 Date of Birth',         req: 'Optional'    },
          { col: 'Child 2 Name',                  req: 'Optional'    },
          { col: 'Child 2 Gender',                req: 'Optional'    },
          { col: 'Child 2 Date of Birth',         req: 'Optional'    },
          { col: 'Brother 1 Name',                req: 'Optional'    },
          { col: 'Brother 1 Date of Birth',       req: 'Optional'    },
          { col: 'Sister 1 Name',                 req: 'Optional'    },
          { col: 'Sister 1 Date of Birth',        req: 'Optional'    },
        ]
      },
    ];

    // ─── BUILD ROWS ───────────────────────────────────────────────────────────
    const rowSections = [];   // Row 0 — merged section headings
    const rowFields   = [];   // Row 1 — field names
    const rowReq      = [];   // Row 2 — Required / Optional / Conditional

    const merges = [];        // worksheet['!merges']
    let colCursor = 0;

    for (const sec of SECTIONS) {
      const startCol = colCursor;
      // Row 0: section name in first cell, empty in rest
      rowSections.push(sec.name);
      for (let i = 1; i < sec.fields.length; i++) rowSections.push('');

      // Merge the section heading across all its columns
      if (sec.fields.length > 1) {
        merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + sec.fields.length - 1 } });
      }

      for (const f of sec.fields) {
        rowFields.push(f.col);
        rowReq.push(f.req);
        colCursor++;
      }
    }

    // ─── SAMPLE DATA ──────────────────────────────────────────────────────────
    // Values must align exactly with the column order above.
    // Step 1 (19), Step 2 (15), Step 3 (7), Step 4 (2), Step 5 (7),
    // Step 6 (5), Step 7 (32), Step 8 (6), Step 9 (12), Step 10 (3), Family (24)
    const sample1 = [
      // Step 1 — Personal Information (19)
      'Dhiren','Vinodbhai','Makwana','Male','1990-01-15',
      '9876543210','O+','Married','Indian',
      'Vinodbhai Makwana','9876543211',
      'dhiren.p@gmail.com','Ahmedabad','175','70','General','Reading','no','',
      // Step 2 — Job / Official Details (15)
      'Technology','2025-06-01','G1','B1','Full-Time',
      '','Software Engineer','','Work From Office (WFO)','Permanent',
      'Morning Shift','','','HQ Branch','',
      // Step 3 — Education Details (7)
      'Regular','Gujarat University','85%','78%','2012','8.5','B.E. Computer Engineering',
      // Step 4 — Identity Documents KYC (2)
      '123456789012','ABCDE1234F',
      // Step 5 — Work Experience (7)
      'Infosys Ltd','2018-01-01','2023-12-31','45000',
      'Ramesh Shah','ramesh.shah@infosys.com','9988776655',
      // Step 6 — Bank Details (5)
      'State Bank of India','123456789012','SBIN0001234','SBI Main Branch','Ahmedabad',
      // Step 7 — Languages & Previous Interview + Perquisites + References (32)
      'English,Hindi,Gujarati','yes','yes','yes','no','','','',
      '','','','','','','','','','',
      'no','','','',
      'Anil Shah','Wipro','Manager','9911223344','anil@wipro.com','5 years',
      'Suresh Mehta','Tata','9922334455','suresh@tata.com',
      // Step 8 — Job History Annexure (6)
      'Infosys Ltd','5000Cr','10000','IT','Senior Developer','Development and coding',
      // Step 9 — Address Details (12)
      '123 Sector 14','Near Water Tank','Gandhinagar','Gujarat','382721','India',
      '47 Panchvati','Opp School','Ahmedabad','Gujarat','380001','India',
      // Step 10 — Login Credentials & Salary (3)
      'dhiren.makwana@gitakshmi.com','Welcome@123','employee',
      // Family & Dependents (24)
      'Vinodbhai','Makwana','B+','987654321011',
      'Hemlattaben','Makwana','A+','987654321012',
      'Priya Makwana','Wife','B+','1992-05-20','9876541230','2015-11-12',
      'Rohan','Male','2018-03-10',
      'Raj','Male','2020-07-15',
      'Mohan','1985-06-01',
      'Gita','1988-09-15',
    ];

    const sample2 = [
      // Step 1 (19)
      'Priya','','Patel','Female','1995-07-22',
      '8765432109','A+','Single','Indian',
      'Ramesh Patel','9988776655',
      'priya.p@gmail.com','Surat','162','55','OBC','Dancing','no','',
      // Step 2 (15)
      'Human Resources','2025-06-15','G2','B2','Part-Time',
      '','HR Executive','','Hybrid','Contract',
      '','','','','',
      // Step 3 (7)
      'Diploma','Surat Polytechnic','90%','','2016','','Diploma in HR Management',
      // Step 4 (2)
      '234567890123','FGHIJ5678K',
      // Step 5 (7)
      'TCS','2020-06-01','2024-05-31','35000',
      'Sunita Gupta','sunita.gupta@tcs.com','',
      // Step 6 (5)
      'HDFC Bank','234567890123','HDFC0002345','HDFC Surat','Surat',
      // Step 7 (32)
      'English,Gujarati','yes','yes','no','yes','2023-01-15','HR Dept Surat','Mr. Joshi',
      '','','','','','','','','','',
      'no','','','',
      'Meera Shah','Infosys','HR Lead','9833221100','meera@infosys.com','3 years',
      'Kiran Patel','HCL','9744332211','kiran@hcl.com',
      // Step 8 (6)
      'TCS','8000Cr','25000','IT','HR Executive','Recruitment and onboarding',
      // Step 9 (12)
      '56 Park Avenue','','Surat','Gujarat','395001','India',
      '56 Park Avenue','','Surat','Gujarat','395001','India',
      // Step 10 (3)
      'priya.patel@gitakshmi.com','Welcome@456','employee',
      // Family (24)
      'Ramesh','Patel','O+','876543210109',
      'Anita','Patel','A+','876543210110',
      '','','','','','',
      '','','',
      '','',
      '','',
      '','',
    ];

    // Pad / truncate to exact column count
    const totalCols = rowFields.length;
    while (sample1.length < totalCols) sample1.push('');
    while (sample2.length < totalCols) sample2.push('');
    sample1.length = totalCols;
    sample2.length = totalCols;

    const dataRows = [];

    // User requested only one dummy row with all fields filled.
    dataRows.push(sample1);


    // ─── BUILD WORKSHEET ──────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet([rowSections, rowFields, rowReq, ...dataRows]);

    // ─── STYLES ───────────────────────────────────────────────────────────────
    // Section heading: dark navy, white bold
    const S_SEC  = { font:{bold:true,color:{rgb:'FFFFFF'},sz:11}, fill:{fgColor:{rgb:'1E3A5F'}}, alignment:{horizontal:'center',vertical:'center',wrapText:false} };
    // Field name row: slate
    const S_FLD  = { font:{bold:true,color:{rgb:'1E293B'},sz:10}, fill:{fgColor:{rgb:'E2E8F0'}}, alignment:{horizontal:'center',vertical:'center',wrapText:true} };
    // Req tag styles
    const S_REQ  = { font:{bold:true,color:{rgb:'FFFFFF'},sz:9},  fill:{fgColor:{rgb:'B91C1C'}}, alignment:{horizontal:'center',vertical:'center'} };
    const S_OPT  = { font:{bold:true,color:{rgb:'14532D'},sz:9},  fill:{fgColor:{rgb:'DCFCE7'}}, alignment:{horizontal:'center',vertical:'center'} };
    const S_COND = { font:{bold:true,color:{rgb:'78350F'},sz:9},  fill:{fgColor:{rgb:'FEF3C7'}}, alignment:{horizontal:'center',vertical:'center'} };
    // Sample data rows
    const S_DATA = { font:{sz:10},                                fill:{fgColor:{rgb:'F8FAFC'}}, alignment:{horizontal:'left',  vertical:'center'} };

    for (let c = 0; c < totalCols; c++) {
      const a0 = XLSX.utils.encode_cell({r:0,c});
      const a1 = XLSX.utils.encode_cell({r:1,c});
      const a2 = XLSX.utils.encode_cell({r:2,c});
      if (ws[a0]) ws[a0].s = S_SEC;
      if (ws[a1]) ws[a1].s = S_FLD;
      if (ws[a2]) {
        const req = rowReq[c];
        ws[a2].s = req === 'Required' ? S_REQ : req === 'Conditional' ? S_COND : S_OPT;
      }
      for (let r = 0; r < dataRows.length; r++) {
        const cell = XLSX.utils.encode_cell({r: r + 3, c});
        if (ws[cell]) ws[cell].s = S_DATA;
      }
    }

    ws['!merges'] = merges;
    ws['!rows']   = [
      { hpt: 32 },  // Row 0 — section headings
      { hpt: 36 },  // Row 1 — field names
      { hpt: 20 },  // Row 2 — req/opt/cond
      { hpt: 20 },  // Row 3 — sample 1
      { hpt: 20 },  // Row 4 — sample 2
    ];
    ws['!cols']   = rowFields.map(f => ({ wch: Math.max(f.length + 3, 18) }));
    // Freeze top 3 rows so headers always visible while scrolling data
    ws['!freeze'] = { xSplit: 0, ySplit: 3, topLeftCell: 'A4', activePane: 'bottomLeft', state: 'frozen' };

    // ─── LEGEND SHEET ─────────────────────────────────────────────────────────
    const legendAoa = [
      ['GT HRMS — Employee Master Bulk Import Template', ''],
      ['', ''],
      ['HOW TO USE THIS TEMPLATE', ''],
      ['Row 1', 'Section heading (merged) — do NOT edit'],
      ['Row 2', 'Field name — do NOT edit'],
      ['Row 3', 'Required / Optional / Conditional — do NOT edit'],
      ['Row 4+', 'Enter your employee data here (one employee per row)'],
      ['', ''],
      ['HEADER COLOUR GUIDE', ''],
      ['🔴  Required  (Red)',      'MUST be filled. Upload will fail if missing.'],
      ['🟡  Conditional  (Yellow)','Fill only under specific conditions (see below).'],
      ['🟢  Optional  (Green)',    'Leave blank if not applicable. System uses defaults.'],
      ['', ''],
      ['FIELD FORMAT NOTES', ''],
      ['Date fields (DOB, Joining Date, etc.)', 'YYYY-MM-DD  →  e.g. 1990-01-15'],
      ['Gender',                               'Male / Female / Other'],
      ['Blood Group',                          'A+ / A- / B+ / B- / O+ / O- / AB+ / AB-'],
      ['Employee Type',                        'Full-Time / Part-Time / Intern / Internship / Contract / Consultant'],
      ['Work Mode',                            'Work From Office (WFO) / Work From Home (WFH) / Hybrid / Field / Onsite'],
      ['Employment Type',                      'Permanent / Contract'],
      ['Education Type',                       'Regular / Diploma'],
      ['Role / Access Level',                  'employee / hr / admin'],
      ['Physical Disability / Sickness',       'yes  or  no'],
      ['Previous Interview with Company',      'yes  or  no'],
      ['Aadhar Number',                        'Exactly 12 digits  →  e.g. 123456789012'],
      ['PAN Number',                           'Exactly 10 characters  →  e.g. ABCDE1234F'],
      ['IFSC Code',                            'Format: AAAA0XXXXXX  →  e.g. SBIN0001234'],
      ['Account Number',                       '9 to 18 digits'],
      ['Languages Known',                      'Comma-separated  →  e.g. English,Hindi,Gujarati'],
      ['Language Speak / Read / Write',        'yes  or  no'],
      ['', ''],
      ['CONDITIONAL FIELD RULES', ''],
      ['Employee ID',                          'Leave blank — auto-generated. Fill only if your ID config is MANUAL.'],
      ['Disability Details',                   'Fill only when Physical Disability / Sickness = yes'],
      ['Experience From Date & To Date',       'Fill when Last Company Name is entered (From must be before To)'],
      ['Reporting Person Name & Email',        'Fill when Last Company Name is entered'],
      ['Previous Interview Date / Dept / By', 'Fill when Previous Interview with Company = yes'],
      ['Related Employee Name & Relationship', 'Fill when Any Related Employee in Company = yes'],
      ['', ''],
      ['FIELDS THAT CANNOT BE IMPORTED VIA EXCEL (upload after employee creation)', ''],
      ['Profile Photo',                        'Upload via employee profile page → Step 1'],
      ['10th / 12th / Diploma / Degree Marksheets','Upload via employee profile page → Step 3'],
      ['Aadhar Front & Back image',            'Upload via employee profile page → Step 4'],
      ['PAN Card image',                       'Upload via employee profile page → Step 4'],
      ['Bank Proof (Cancelled Cheque)',        'Upload via employee profile page → Step 6'],
      ['Salary Template & Effective Date',     'Assign via employee profile page → Step 10'],
    ];

    const legendWs = XLSX.utils.aoa_to_sheet(legendAoa);
    legendWs['!cols'] = [{ wch: 48 }, { wch: 65 }];
    const LS = {font:{bold:true,color:{rgb:'FFFFFF'},sz:13},fill:{fgColor:{rgb:'1E3A5F'}},alignment:{wrapText:true}};
    const LH = {font:{bold:true,sz:10},fill:{fgColor:{rgb:'DBEAFE'}}};
    if (legendWs['A1']) legendWs['A1'].s = LS;
    ['A3','A9','A14','A31','A38'].forEach(addr => { if (legendWs[addr]) legendWs[addr].s = LH; });

    XLSX.utils.book_append_sheet(wb, ws,       'Employee Data');
    XLSX.utils.book_append_sheet(wb, legendWs, 'Legend & Notes');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="HRMS_Employee_Master_Template_${Date.now()}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);

  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({
      success: false,
      error: 'template_generation_failed',
      message: err.message || 'Failed to generate template'
    });
  }
};



/* -----------------------------------------
   BULK UPLOAD EMPLOYEES
----------------------------------------- */

/**
 * Helper: Generate next sequential employee ID
 * Format: EMP{NNNN} (e.g., EMP0001, EMP0002, etc.)
 */
async function generateNextEmployeeId(Employee, tenantId, startFrom = 1) {
  try {
    // Find all existing employees with IDs matching EMP pattern
    const existingEmps = await Employee.find({
      tenant: tenantId,
      employeeId: /^EMP\d+$/i
    }).select('employeeId').lean();

    let maxNumber = 0;

    // Extract numeric parts and find the highest
    existingEmps.forEach(emp => {
      const match = emp.employeeId.match(/^EMP(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    // Start from the higher of: maxNumber + 1 or startFrom
    const nextNumber = Math.max(maxNumber + 1, startFrom);

    // Return formatted ID with 4-digit padding
    return `EMP${String(nextNumber).padStart(4, '0')}`;
  } catch (err) {
    console.error('Error generating employee ID:', err);
    // Fallback to timestamp-based ID
    return `EMP${Date.now().toString().slice(-8)}`;
  }
}

exports.bulkUploadEmployees = async (req, res) => {
  try {
    const { records } = req.body;

    // ====== INPUT VALIDATION ======
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: "Records must be an array",
        uploadedCount: 0,
        failedCount: 0,
        errors: ["Invalid request format - records must be an array"]
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No records provided",
        uploadedCount: 0,
        failedCount: 0,
        errors: ["No employee records to upload"]
      });
    }

    if (records.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Maximum 1000 records allowed per upload",
        uploadedCount: 0,
        failedCount: records.length,
        errors: ["Exceeded maximum record limit of 1000 records"]
      });
    }

    const { Employee, Department, LeavePolicy } = getModels(req);
    const tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant context missing for bulk upload",
        uploadedCount: 0,
        failedCount: records.length || 0,
        errors: ["Tenant context missing"]
      });
    }
    const userId = req.user.id;

    // Fetch Company ID Configuration for both EMP and INTN headers info
    const [empConfig, intnConfig] = await Promise.all([
      CompanyIdConfig.findOne({ companyId: tenantId, entityType: 'EMPLOYEE' }).lean(),
      CompanyIdConfig.findOne({ companyId: tenantId, entityType: 'INTN' }).lean()
    ]);

    const configs = {
      EMPLOYEE: {
        prefix: empConfig?.prefix || 'EMP',
        resetPolicy: empConfig?.resetPolicy || 'YEARLY'
      },
      INTN: {
        prefix: intnConfig?.prefix || 'INTN',
        resetPolicy: intnConfig?.resetPolicy || 'YEARLY'
      }
    };

    const isInternRow = (row) => {
      for (const key of Object.keys(row)) {
        const normKey = normalize(key);
        if (normKey === 'jobtype' || normKey === 'employeetype') {
          const val = String(row[key] || '').toLowerCase();
          return val.includes('intern');
        }
      }
      return false;
    };

    // Helper to format Financial Year based on Joining Date (matches manual creation logic)
    const formatFY = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // Month is 0-indexed
      let startYear, endYear;
      
      if (month >= 4) {
        startYear = year % 100;
        endYear = (year + 1) % 100;
      } else {
        startYear = (year - 1) % 100;
        endYear = year % 100;
      }
      
      const pad = (num) => String(num).padStart(2, '0');
      return `${pad(startYear)}-${pad(endYear)}`;
    };

    const results = {
      uploadedCount: 0,
      failedCount: 0,
      errors: [],
      warnings: [],
      processedIds: [],
      autoGeneratedIds: []
    };
    const tenantUserLimit = await getTenantUserLimitContext(Employee, tenantId);
    if (tenantUserLimit) {
      try {
        assertTenantUserLimit(tenantUserLimit, records.length, 0);
      } catch (limitErr) {
        return res.status(limitErr.statusCode || 403).json({
          success: false,
          error: limitErr.code || 'USER_LIMIT_REACHED',
          message: limitErr.message,
          uploadedCount: 0,
          failedCount: records.length,
          errors: [limitErr.message],
          warnings: [],
          autoGeneratedIds: [],
          details: limitErr.details || null
        });
      }
    }

    // ====== HELPER FUNCTIONS ======

    // Helper: Normalize column names (remove spaces, special chars, and parentheses with content)
    const normalize = (s) => {
      if (!s) return '';
      // Remove content in parentheses first, then normalize
      return s.toString()
        .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
        .toLowerCase()
        .replace(/\s/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    // Helper: Validate email with better domain checking
    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      return emailRegex.test(email);
    };

    // Helper: Validate and parse date flexibly
    const validateDate = (dateVal) => {
      if (!dateVal) return null;
      let dateObj;

      if (dateVal instanceof Date) {
        dateObj = dateVal;
      } else if (typeof dateVal === 'number' || (!isNaN(dateVal) && !isNaN(parseFloat(dateVal)))) {
        const serial = parseFloat(dateVal);
        dateObj = new Date((serial - 25569) * 86400 * 1000);
      } else {
        const dateStr = dateVal.toString().trim();
        // Try parsing YYYY-MM-DD format
        const matchYmd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchYmd) {
          dateObj = new Date(`${matchYmd[1]}-${matchYmd[2]}-${matchYmd[3]}T00:00:00Z`);
        } else {
          // Try DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
          const matchDmy = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
          if (matchDmy) {
            const day = parseInt(matchDmy[1], 10);
            const month = parseInt(matchDmy[2], 10) - 1; // 0-indexed month
            const year = parseInt(matchDmy[3], 10);
            dateObj = new Date(Date.UTC(year, month, day));
          } else {
            dateObj = new Date(dateStr);
          }
        }
      }

      if (!dateObj || isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date format: ${dateVal}`);
      }
      return dateObj;
    };

    // Helper: Validate phone number
    const validatePhone = (phone) => {
      if (!phone) return true; // Optional field
      const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;
      return phoneRegex.test(phone);
    };

    // ====== PRE-PROCESSING & CACHING ======

    // Cache for lookups
    const deptCache = {};
    const policyCache = {};
    const processedEmails = new Set();
    const processedEmpIds = new Set();

    // Pre-cache departments
    const allDepts = await Department.find({ mainCompanyId: tenantId }).select('_id name').lean();
    allDepts.forEach(d => {
      const deptName = d?.name ? d.name.toLowerCase().trim() : '';
      if (deptName) {
        deptCache[deptName] = d._id;
      }
    });

    // Pre-cache leave policies
    const allPolicies = await LeavePolicy.find({ tenant: tenantId }).select('_id name').lean();
    allPolicies.forEach(p => {
      const policyName = p?.name ? p.name.toLowerCase().trim() : '';
      if (policyName) {
        policyCache[policyName] = p._id;
      }
    });

    // Get default leave policy if needed
    const defaultPolicy = allPolicies.length > 0 ? allPolicies[0]._id : null;

    // Pre-fetch existing employees for bulk checking
    const existingEmps = await Employee.find({ tenant: tenantId }).select('employeeId email').lean();
    const existingEmpIds = new Set(
      existingEmps
        .map(e => (e?.employeeId ? e.employeeId.toLowerCase() : ''))
        .filter(Boolean)
    );
    const existingEmails = new Set(
      existingEmps
        .map(e => (e?.email ? e.email.toLowerCase() : ''))
        .filter(Boolean)
    );

    // Cache for post-process counter updates
    const generatedNumbers = { EMPLOYEE: [], INTN: [] };

    // ====== PROCESSING LOOP ======
    for (let i = 0; i < records.length; i++) {
      const row = records[i] && typeof records[i] === 'object' ? records[i] : {};
      const rowIdx = i + 2; // 1-indexed + header row

      // Skip completely blank or non-employee placeholder rows (like rows with only a serial number)
      const identityFields = [
        'name', 'employeename', 'fullname', 'empname', 
        'firstname', 'lastname', 'email', 'emailaddress', 
        'companymailid', 'personalemailid', 'mailid'
      ];
      let hasCoreInfo = false;
      for (const key of Object.keys(row)) {
        const normKey = normalize(key);
        if (identityFields.includes(normKey)) {
          if (String(row[key] || '').trim()) {
            hasCoreInfo = true;
            break;
          }
        }
      }
      if (!hasCoreInfo) {
        continue;
      }

      try {
        // ====== EXTRACT FIELDS ======
        let empId = '';
        let firstName = '';
        let middleName = '';
        let lastName = '';
        let email = '';
        let contactNo = '';
        let gender = '';
        let dob = null;
        let joiningDate = null;
        let departmentName = '';
        let role = '';
        let jobType = '';
        let maritalStatus = '';
        let nationality = '';
        let bloodGroup = '';
        let fatherName = '';
        let motherName = '';
        let emergencyContactName = '';
        let emergencyContactNumber = '';
        let bankName = '';
        let accountNumber = '';
        let ifscCode = '';
        let branchName = '';
        let bankLocation = '';
        let policyName = '';
        let password = '';
        let tempAddr = {};
        let permAddr = {};

        const fieldPatterns = [
          { field: 'empId', patterns: ['employeeid', 'empid', 'employeecode', 'empcode'] },
          { field: 'firstName', patterns: ['firstname', 'first'] },
          { field: 'middleName', patterns: ['middlename', 'middle'] },
          { field: 'lastName', patterns: ['lastname', 'last'] },
          { field: 'fullName', patterns: ['name', 'employeename', 'fullname', 'empname'] },
          { field: 'email', patterns: ['officialemail', 'email', 'emailaddress', 'companymailid', 'companyemail', 'workemail', 'mailid'] },
          { field: 'personalEmail', patterns: ['personalemailid', 'personalemail', 'personalmailid'] },
          { field: 'contactNo', patterns: ['contactnumber', 'contactno', 'phone', 'mobile', 'mobileno', 'phoneno'] },
          { field: 'gender', patterns: ['gender'] },
          { field: 'dob', patterns: ['dob', 'dateofbirth'] },
          { field: 'joiningDate', patterns: ['joiningdate', 'doj', 'dateofjoining', 'dateofjoin', 'dojdate', 'joining'] },
          { field: 'departmentName', patterns: ['department', 'dept', 'departmentname', 'deptname', 'department_name', 'dept_name'] },
          { field: 'role', patterns: ['role', 'designation', 'designationrole', 'roledesignation'] },
          { field: 'jobType', patterns: ['jobtype', 'employeetype', 'employmenttype', 'type'] },
          { field: 'maritalStatus', patterns: ['maritalstatus', 'marritalstatus'] },
          { field: 'nationality', patterns: ['nationality'] },
          { field: 'bloodGroup', patterns: ['bloodgroup'] },
          { field: 'fatherName', patterns: ['fathername', 'fatherfirstname'] },
          { field: 'motherName', patterns: ['mothername', 'motherfirstname'] },
          { field: 'emergencyContactName', patterns: ['emergencycontactname', 'emergencycontactpersonname', 'emergencycontactperson', 'emergencycontact'] },
          { field: 'emergencyContactNumber', patterns: ['emergencycontactnumber', 'contactnumber', 'emergencymobile', 'emergencycontactno', 'emergencyphone'] },
          { field: 'bankName', patterns: ['bankname', 'bank'] },
          { field: 'accountNumber', patterns: ['accountnumber', 'acnumber', 'accno', 'accountno'] },
          { field: 'ifscCode', patterns: ['ifsccode', 'ifscode', 'ifsc', 'ifsiccode', 'ifsciccode'] },
          { field: 'branchName', patterns: ['branchname', 'branch'] },
          { field: 'bankLocation', patterns: ['banklocation', 'banklocationcity', 'bankaddress'] },
          { field: 'policyName', patterns: ['leavepolicy'] },
          { field: 'password', patterns: ['password'] },
          { field: 'panNumber', patterns: ['pannumber', 'panno', 'pan'] },
          { field: 'aadharNumber', patterns: ['aadharnumber', 'aadhar', 'aadharno', 'aadharcard', 'aadharcardnumber', 'aadhaar', 'aadhaarno', 'aadhaarnumber'] },
          { field: 'manager', patterns: ['manager', 'manageremployeeid', 'reportingmanager', 'reportingto', 'managerid', 'employeemanager'] },
          { field: 'qualification', patterns: ['qualification', 'highestqual', 'highestqualification', 'educationtype', 'degree'] },
          { field: 'yearOfPassing', patterns: ['yearofpassing', 'passingyear', 'yop'] },
          { field: 'cgpaOrPercentage', patterns: ['cgpapercentage', 'cgpaorpercentagedegree', 'cgpa', 'percentage', 'marks'] }
        ];

        const rowValues = {};
        let panNumber = '';
        let aadharNumber = '';

        for (const key of Object.keys(row)) {
          const normKey = normalize(key);
          const val = row[key];

          // Address matching - smart fallback for standard city/state/pincode/country columns
          if (normKey.includes('tempaddressline1')) {
            tempAddr.line1 = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempaddressline2')) {
            tempAddr.line2 = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempcity')) {
            tempAddr.city = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempstate')) {
            tempAddr.state = val ? val.toString().trim() : '';
          } else if (normKey.includes('temppincode') || normKey.includes('temppin')) {
            tempAddr.pinCode = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempcountry')) {
            tempAddr.country = val ? val.toString().trim() : '';
          } else if (normKey.includes('permaddressline1') || normKey === 'addressasperaadhar' || normKey === 'aadharaddress') {
            permAddr.line1 = val ? val.toString().trim() : '';
          } else if (normKey.includes('permaddressline2')) {
            permAddr.line2 = val ? val.toString().trim() : '';
          } else if (normKey.includes('permcity') || normKey === 'city' || normKey === 'town' || normKey === 'district') {
            permAddr.city = val ? val.toString().trim() : '';
          } else if (normKey.includes('permstate') || normKey === 'state') {
            permAddr.state = val ? val.toString().trim() : '';
          } else if (normKey.includes('permpincode') || normKey.includes('permpin') || normKey === 'pincode' || normKey === 'pin' || normKey === 'postalcode') {
            permAddr.pinCode = val ? val.toString().trim() : '';
          } else if (normKey.includes('permcountry') || normKey === 'country') {
            permAddr.country = val ? val.toString().trim() : '';
          } else if (normKey === 'permanentaddress') {
            if (permAddr.line1) {
              tempAddr.line1 = val ? val.toString().trim() : '';
            } else {
              permAddr.line1 = val ? val.toString().trim() : '';
            }
          }

          for (const { field, patterns } of fieldPatterns) {
            if (patterns.includes(normKey)) {
              if (!rowValues[field]) rowValues[field] = [];
              rowValues[field].push({ key: normKey, value: val });
            }
          }
        }

        // Hydrate variables
        if (rowValues['empId']) empId = rowValues['empId'][0].value ? rowValues['empId'][0].value.toString().trim() : '';
        if (rowValues['firstName']) firstName = rowValues['firstName'][0].value ? rowValues['firstName'][0].value.toString().trim() : '';
        if (rowValues['middleName']) middleName = rowValues['middleName'][0].value ? rowValues['middleName'][0].value.toString().trim() : '';
        if (rowValues['lastName']) lastName = rowValues['lastName'][0].value ? rowValues['lastName'][0].value.toString().trim() : '';
        
        // Handle full name column split if needed
        if ((!firstName || !lastName) && rowValues['fullName']) {
          const fullName = rowValues['fullName'][0].value ? rowValues['fullName'][0].value.toString().trim() : '';
          if (fullName) {
            const parts = fullName.split(/\s+/).filter(Boolean);
            if (parts.length >= 3) {
              firstName = parts[0];
              middleName = parts[1];
              lastName = parts.slice(2).join(' ');
            } else if (parts.length === 2) {
              firstName = parts[0];
              lastName = parts[1];
            } else if (parts.length === 1) {
              firstName = parts[0];
              lastName = 'Doe';
            }
          }
        }

        let personalEmail = '';
        if (rowValues['personalEmail'] && rowValues['personalEmail'][0].value) {
          personalEmail = rowValues['personalEmail'][0].value.toString().trim().toLowerCase();
        }

        if (rowValues['email']) {
          const companyEmail = rowValues['email'].find(m => (m.key.includes('company') || m.key.includes('work')) && String(m.value || '').trim() !== '');
          const chosenEmail = companyEmail || rowValues['email'].find(m => String(m.value || '').trim() !== '');
          email = chosenEmail && chosenEmail.value ? chosenEmail.value.toString().trim().toLowerCase() : '';
        }
        if (!email && personalEmail) {
          email = personalEmail;
        }

        if (rowValues['contactNo']) contactNo = rowValues['contactNo'][0].value ? rowValues['contactNo'][0].value.toString().trim() : '';
        if (rowValues['gender']) gender = rowValues['gender'][0].value ? rowValues['gender'][0].value.toString().trim() : '';
        if (rowValues['dob']) dob = rowValues['dob'][0].value;
        if (rowValues['joiningDate']) joiningDate = rowValues['joiningDate'][0].value;
        if (rowValues['departmentName']) departmentName = rowValues['departmentName'][0].value ? rowValues['departmentName'][0].value.toString().trim() : '';
        if (rowValues['role']) role = rowValues['role'][0].value ? rowValues['role'][0].value.toString().trim() : '';
        if (rowValues['jobType']) jobType = rowValues['jobType'][0].value ? rowValues['jobType'][0].value.toString().trim() : '';
        if (rowValues['maritalStatus']) maritalStatus = rowValues['maritalStatus'][0].value ? rowValues['maritalStatus'][0].value.toString().trim() : '';
        if (rowValues['nationality']) nationality = rowValues['nationality'][0].value ? rowValues['nationality'][0].value.toString().trim() : '';
        if (rowValues['bloodGroup']) bloodGroup = rowValues['bloodGroup'][0].value ? rowValues['bloodGroup'][0].value.toString().trim() : '';
        if (rowValues['fatherName']) fatherName = rowValues['fatherName'][0].value ? rowValues['fatherName'][0].value.toString().trim() : '';
        if (rowValues['motherName']) motherName = rowValues['motherName'][0].value ? rowValues['motherName'][0].value.toString().trim() : '';
        if (rowValues['emergencyContactName']) emergencyContactName = rowValues['emergencyContactName'][0].value ? rowValues['emergencyContactName'][0].value.toString().trim() : '';
        if (rowValues['emergencyContactNumber']) emergencyContactNumber = rowValues['emergencyContactNumber'][0].value ? rowValues['emergencyContactNumber'][0].value.toString().trim() : '';
        if (rowValues['bankName']) bankName = rowValues['bankName'][0].value ? rowValues['bankName'][0].value.toString().trim() : '';
        if (rowValues['accountNumber']) accountNumber = rowValues['accountNumber'][0].value ? rowValues['accountNumber'][0].value.toString().trim() : '';
        if (rowValues['ifscCode']) ifscCode = rowValues['ifscCode'][0].value ? rowValues['ifscCode'][0].value.toString().trim() : '';
        if (rowValues['branchName']) branchName = rowValues['branchName'][0].value ? rowValues['branchName'][0].value.toString().trim() : '';
        if (rowValues['bankLocation']) bankLocation = rowValues['bankLocation'][0].value ? rowValues['bankLocation'][0].value.toString().trim() : '';
        if (rowValues['policyName']) policyName = rowValues['policyName'][0].value ? rowValues['policyName'][0].value.toString().trim() : '';
        if (rowValues['password']) password = rowValues['password'][0].value ? rowValues['password'][0].value.toString().trim() : '';
        if (rowValues['panNumber']) panNumber = rowValues['panNumber'][0].value ? rowValues['panNumber'][0].value.toString().trim() : '';
        if (rowValues['aadharNumber']) aadharNumber = rowValues['aadharNumber'][0].value ? rowValues['aadharNumber'][0].value.toString().trim() : '';

        // Hydrate qualifications and education fields
        let highestQualification = '';
        let yearOfPassing = '';
        let cgpaOrPercentage = '';
        if (rowValues['qualification'] && rowValues['qualification'][0].value) {
          highestQualification = rowValues['qualification'][0].value.toString().trim();
        }
        if (rowValues['yearOfPassing'] && rowValues['yearOfPassing'][0].value) {
          yearOfPassing = rowValues['yearOfPassing'][0].value.toString().trim();
        }
        if (rowValues['cgpaOrPercentage'] && rowValues['cgpaOrPercentage'][0].value) {
          cgpaOrPercentage = rowValues['cgpaOrPercentage'][0].value.toString().trim();
        }

        // Hydrate marriageDate
        let marriageDate = null;
        let marriageDateVal = '';
        for (const k of Object.keys(row)) {
          if (normalize(k) === 'marriagedate' || normalize(k) === 'anniversarydate') {
            marriageDateVal = row[k];
            break;
          }
        }
        if (marriageDateVal) {
          try { marriageDate = validateDate(marriageDateVal); } catch(e) {}
        }

        // Hydrate manager
        let managerId = null;
        let managerVal = '';
        if (rowValues['manager'] && rowValues['manager'][0].value) {
          managerVal = rowValues['manager'][0].value.toString().trim();
        }
        if (managerVal) {
          const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const managerQuery = {
            tenant: tenantId,
            isDeleted: { $ne: true },
            $or: [
              { employeeId: managerVal },
              { email: { $regex: new RegExp(`^${escapeRegex(managerVal)}$`, 'i') } },
              { firstName: { $regex: new RegExp(`^${escapeRegex(managerVal)}$`, 'i') } },
              {
                $expr: {
                  $eq: [
                    { $concat: ["$firstName", " ", "$lastName"] },
                    managerVal
                  ]
                }
              }
            ]
          };
          const resolvedManager = await Employee.findOne(managerQuery).select('_id').lean();
          if (resolvedManager) {
            managerId = resolvedManager._id;
          } else {
            results.warnings.push(`Row ${rowIdx}: Manager "${managerVal}" not found - reporting manager left blank`);
          }
        }

        // Hydrate repeating family blocks
        const familyMembers = [];
        const children = [];
        const brothers = [];
        const sisters = [];
        let spouseDetails = undefined;

        for (let idxFamily = 0; idxFamily < 15; idxFamily++) {
          const nameKey = idxFamily === 0 ? 'familymembername' : `familymembername${idxFamily}`;
          const relationKey = idxFamily === 0 ? 'relation' : `relation${idxFamily}`;
          const dobKey = `dob${idxFamily + 1}`;

          let nameVal = '';
          let relationVal = '';
          let dobVal = null;

          for (const k of Object.keys(row)) {
            const normK = normalize(k);
            if (normK === nameKey) nameVal = String(row[k] || '').trim();
            if (normK === relationKey) relationVal = String(row[k] || '').trim();
            if (normK === dobKey) dobVal = row[k];
          }

          if (nameVal || relationVal || dobVal) {
            let parsedDob = null;
            if (dobVal) {
              try { parsedDob = validateDate(dobVal); } catch (e) {}
            }
            familyMembers.push({
              name: nameVal,
              relation: relationVal,
              dob: parsedDob
            });
          }
        }

        familyMembers.forEach(f => {
          const relationLower = String(f.relation || '').toLowerCase();
          if (relationLower.includes('mother')) {
            motherName = f.name;
          } else if (relationLower.includes('father')) {
            if (!fatherName) fatherName = f.name;
          } else if (relationLower.includes('spouse') || relationLower.includes('wife') || relationLower.includes('husband')) {
            spouseDetails = {
              spouseName: f.name,
              relation: f.relation,
              dob: f.dob
            };
          } else if (relationLower.includes('child') || relationLower.includes('son') || relationLower.includes('daughter')) {
            children.push({
              name: f.name,
              gender: relationLower.includes('son') ? 'Male' : (relationLower.includes('daughter') ? 'Female' : undefined),
              dob: f.dob
            });
          } else if (relationLower.includes('brother')) {
            brothers.push({
              name: f.name,
              dob: f.dob
            });
          } else if (relationLower.includes('sister')) {
            sisters.push({
              name: f.name,
              dob: f.dob
            });
          }
        });

        // Hydrate repeating experience blocks
        const experience = [];
        for (let idxExp = 0; idxExp < 10; idxExp++) {
          const companyKey = idxExp === 0 ? 'lastcompant' : `lastcompant${idxExp}`;
          const fromKey = idxExp === 0 ? 'from' : `from${idxExp}`;
          const toKey = idxExp === 0 ? 'to' : `to${idxExp}`;

          let companyVal = '';
          let fromVal = null;
          let toVal = null;

          for (const k of Object.keys(row)) {
            const normK = normalize(k);
            if (normK === companyKey) companyVal = String(row[k] || '').trim();
            if (normK === fromKey) fromVal = row[k];
            if (normK === toKey) toVal = row[k];
          }

          if (companyVal || fromVal || toVal) {
            let parsedFrom = null;
            let parsedTo = null;
            if (fromVal) {
              try { parsedFrom = validateDate(fromVal); } catch(e) {}
            }
            if (toVal) {
              try { parsedTo = validateDate(toVal); } catch(e) {}
            }
            experience.push({
              companyName: companyVal,
              from: parsedFrom,
              to: parsedTo
            });
          }
        }

        let lastCtcVal = '';
        for (const k of Object.keys(row)) {
          if (normalize(k) === 'lastctc') {
            lastCtcVal = row[k];
            break;
          }
        }
        if (lastCtcVal && experience.length > 0) {
          experience[0].lastDrawnSalary = parseFloat(String(lastCtcVal).replace(/[^0-9.]/g, '')) || undefined;
        }

        // ====== AUTO-GENERATE EMPLOYEE ID IF MISSING ======
        if (!empId) {
          // Check both jobType and role for "intern" keyword
          const isIntern = 
            String(jobType || '').toLowerCase().includes('intern') || 
            String(role || '').toLowerCase().includes('intern');
            
          const entityType = isIntern ? 'INTN' : 'EMPLOYEE';
          
          const idResult = await companyIdConfigController.generateIdInternal({
            tenantId,
            entityType,
            increment: true,
            financialYear: joiningDate ? formatFY(joiningDate) : formatFY(new Date())
          });
          empId = idResult.id;
          generatedNumbers[entityType].push(idResult.counter);
          results.autoGeneratedIds.push(empId);
        }

        // ====== VALIDATION ======
        if (!empId) throw new Error('Employee ID is required or could not be generated');
        if (!firstName) {
          firstName = 'Employee';
          results.warnings.push(`Row ${rowIdx}: First Name missing - auto-filled`);
        }
        if (!lastName) {
          lastName = `Row${rowIdx}`;
          results.warnings.push(`Row ${rowIdx}: Last Name missing - auto-filled`);
        }
        if (!email) {
          email = `${empId.toLowerCase()}@placeholder.local`;
          results.warnings.push(`Row ${rowIdx}: Email missing - auto-generated as ${email}`);
        }

        // Employee ID validation
        const type = String(jobType || '').toLowerCase().includes('intern') ? 'INTN' : 'EMPLOYEE';
        let empIdLower = empId.toLowerCase();
        if (!/^[a-zA-Z0-9\-_]{1,50}$/.test(empId)) {
          const oldId = empId;
          empId = generateUniqueEmployeeId(type);
          empIdLower = empId.toLowerCase();
          results.warnings.push(`Row ${rowIdx}: Invalid Employee ID "${oldId}" replaced with ${empId}`);
        }

        // Check for existing Employee ID (Upsert logic)
        let isUpdate = false;
        let existingEmployeeDoc = null;
        if (existingEmpIds.has(empIdLower)) {
          isUpdate = true;
          existingEmployeeDoc = await Employee.findOne({ tenant: tenantId, employeeId: { $regex: new RegExp(`^${empId}$`, 'i') } });
          results.warnings.push(`Row ${rowIdx}: Updating existing employee "${empId}"`);
        }

        // Check for duplicate Employee ID within current batch
        if (!isUpdate && processedEmpIds.has(empIdLower) && !autoGeneratedMap.has(i)) {
          const oldId = empId;
          empId = generateUniqueEmployeeId();
          empIdLower = empId.toLowerCase();
          results.warnings.push(`Row ${rowIdx}: Duplicate Employee ID "${oldId}" in file replaced with ${empId}`);
        }

        // Email validation (auto-correct invalid email)
        if (!validateEmail(email)) {
          const sanitized = String(email || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
          email = `${sanitized || empId.toLowerCase()}@placeholder.local`;
          results.warnings.push(`Row ${rowIdx}: Invalid email format corrected to ${email}`);
        }

        // Check for duplicate Email (within current batch or existing)
        let emailLower = email.toLowerCase();
        if (processedEmails.has(emailLower)) {
          const sanitized = empId.toLowerCase().replace(/[^a-z0-9._-]/g, '');
          email = `${sanitized}_${rowIdx}_${Date.now()}@placeholder.local`;
          emailLower = email.toLowerCase();
          results.warnings.push(`Row ${rowIdx}: Duplicate email in file - changed to ${email}`);
        }
        if (existingEmails.has(emailLower)) {
          if (isUpdate && existingEmployeeDoc && existingEmployeeDoc.email && existingEmployeeDoc.email.toLowerCase() === emailLower) {
            // Keep the email, it belongs to the employee being updated
          } else {
            email = `${empId.toLowerCase()}_${Date.now()}@placeholder.local`;
            emailLower = email.toLowerCase();
            results.warnings.push(`Row ${rowIdx}: Duplicate email found - changed to ${email}`);
          }
        }

        // First/Last Name length soft normalization
        if (firstName.length < 2) firstName = `${firstName}X`;
        if (lastName.length < 2) lastName = `${lastName}X`;

        // Contact number validation
        if (contactNo && !validatePhone(contactNo)) {
          results.warnings.push(`Row ${rowIdx}: Contact number format may be invalid - "${contactNo}"`);
        }

        // Parse and validate dates
        let dobDate = null;
        let joiningDateObj = null;

        if (dob) {
          try {
            dobDate = validateDate(dob);
            const age = (new Date() - dobDate) / (365.25 * 24 * 60 * 60 * 1000);
            if (age < 18) {
              results.warnings.push(`Row ${rowIdx}: Employee appears to be under 18 years old`);
            }
            if (dobDate > new Date()) {
              throw new Error('Date of Birth cannot be in the future');
            }
          } catch (err) {
            results.warnings.push(`Row ${rowIdx}: ${err.message} - will skip DOB`);
            dobDate = null;
          }
        }

        try {
          joiningDateObj = joiningDate ? validateDate(joiningDate) : new Date();
          if (joiningDateObj > new Date()) {
            results.warnings.push(`Row ${rowIdx}: Joining Date is in the future`);
          }
        } catch (err) {
          joiningDateObj = new Date();
          results.warnings.push(`Row ${rowIdx}: Invalid Joining Date - defaulted to today`);
        }

        // Validate Gender
        let validGender = null;
        if (gender) {
          const normalizedGender = gender.toLowerCase();
          if (['male', 'm'].includes(normalizedGender)) {
            validGender = 'Male';
          } else if (['female', 'f'].includes(normalizedGender)) {
            validGender = 'Female';
          } else if (['other', 'o'].includes(normalizedGender)) {
            validGender = 'Other';
          } else {
            results.warnings.push(`Row ${rowIdx}: Invalid gender value "${gender}" - will skip`);
          }
        }

        // Validate Job Type
        let validJobType = null;
        if (jobType) {
          const normalizedJobType = jobType.toLowerCase().replace(/\s/g, '');
          if (['fulltime', 'ft', 'full-time'].includes(normalizedJobType)) {
            validJobType = 'Full-Time';
          } else if (['parttime', 'pt', 'part-time'].includes(normalizedJobType)) {
            validJobType = 'Part-Time';
          } else if (['internship', 'intern'].includes(normalizedJobType)) {
            validJobType = 'Internship';
          } else {
            results.warnings.push(`Row ${rowIdx}: Invalid job type "${jobType}" - will use Full-Time`);
            validJobType = 'Full-Time';
          }
        } else {
          validJobType = 'Full-Time';
        }

        // Resolve Department (create if not exists)
        let departmentId = null;
        if (departmentName) {
          const deptLower = departmentName.toLowerCase().trim();
          departmentId = deptCache[deptLower];
          if (!departmentId) {
            try {
              let deptCode = departmentName
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .split(/\s+/)
                .map(word => word[0])
                .join('');
              
              if (!deptCode || deptCode.length < 2) {
                deptCode = departmentName.slice(0, 3).toUpperCase();
              }
              
              const existingDeptWithCode = await Department.findOne({
                mainCompanyId: tenantId,
                code: deptCode
              });
              if (existingDeptWithCode) {
                deptCode = `${deptCode}${Math.floor(10 + Math.random() * 90)}`;
              }

              const newDept = await Department.create({
                name: departmentName.trim(),
                code: deptCode,
                mainCompanyId: tenantId,
                isActive: true
              });

              departmentId = newDept._id;
              deptCache[deptLower] = departmentId;
              results.warnings.push(`Row ${rowIdx}: Department "${departmentName}" not found - automatically created with code "${deptCode}"`);
            } catch (deptErr) {
              results.warnings.push(`Row ${rowIdx}: Failed to automatically create department "${departmentName}" (${deptErr.message}) - left blank`);
            }
          }
        }

        // Resolve Leave Policy
        let policyId = null;
        if (policyName) {
          const policyLower = policyName.toLowerCase().trim();
          policyId = policyCache[policyLower];
          if (!policyId) {
            results.warnings.push(`Row ${rowIdx}: Leave Policy "${policyName}" not found - will use default`);
            if (defaultPolicy) policyId = defaultPolicy;
          }
        } else if (defaultPolicy) {
          policyId = defaultPolicy;
        }

        // Hash password if provided, or generate default password for new users
        let hashedPassword = undefined;
        if (password) {
          try {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
          } catch (hashErr) {
            results.warnings.push(`Row ${rowIdx}: Failed to hash password`);
          }
        }

        // If no password provided and it's a new user, generate default password
        if (!isUpdate && !hashedPassword) {
          try {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const defaultPassword = empId;
            hashedPassword = await bcrypt.hash(defaultPassword, salt);
            results.warnings.push(`Row ${rowIdx}: No password provided - default password set to Employee ID (${empId})`);
          } catch (hashErr) {
            results.warnings.push(`Row ${rowIdx}: Failed to generate default password`);
          }
        }

        assertTenantUserLimit(tenantUserLimit, 1, results.uploadedCount);

        let finalEmployee;

        if (isUpdate && existingEmployeeDoc) {
          // UPDATE EXISTING EMPLOYEE
          existingEmployeeDoc.firstName = firstName;
          existingEmployeeDoc.middleName = middleName || undefined;
          existingEmployeeDoc.lastName = lastName;
          existingEmployeeDoc.email = email;
          if (personalEmail) existingEmployeeDoc.personalEmail = personalEmail;
          if (hashedPassword) existingEmployeeDoc.password = hashedPassword;
          
          existingEmployeeDoc.contactNo = contactNo || existingEmployeeDoc.contactNo;
          existingEmployeeDoc.gender = validGender || existingEmployeeDoc.gender;
          if (dobDate) existingEmployeeDoc.dob = dobDate;
          if (joiningDateObj) existingEmployeeDoc.joiningDate = joiningDateObj;
          if (departmentId) existingEmployeeDoc.departmentId = departmentId;
          existingEmployeeDoc.department = departmentName || existingEmployeeDoc.department;
          existingEmployeeDoc.role = role || existingEmployeeDoc.role;
          existingEmployeeDoc.designation = role || existingEmployeeDoc.designation;
          existingEmployeeDoc.employeeType = validJobType || existingEmployeeDoc.employeeType;
          existingEmployeeDoc.maritalStatus = maritalStatus || existingEmployeeDoc.maritalStatus;
          existingEmployeeDoc.nationality = nationality || existingEmployeeDoc.nationality;
          existingEmployeeDoc.bloodGroup = bloodGroup || existingEmployeeDoc.bloodGroup;
          existingEmployeeDoc.fatherName = fatherName || existingEmployeeDoc.fatherName;
          existingEmployeeDoc.motherName = motherName || existingEmployeeDoc.motherName;
          if (marriageDate) existingEmployeeDoc.marriageDate = marriageDate;
          existingEmployeeDoc.highestQualification = highestQualification || existingEmployeeDoc.highestQualification;
          
          if (!existingEmployeeDoc.education) existingEmployeeDoc.education = {};
          if (highestQualification) existingEmployeeDoc.education.type = highestQualification;
          if (cgpaOrPercentage) existingEmployeeDoc.education.class10Marks = cgpaOrPercentage;
          if (cgpaOrPercentage) existingEmployeeDoc.education.class12Marks = cgpaOrPercentage;
          if (yearOfPassing) existingEmployeeDoc.education.yearOfPassing = yearOfPassing;
          if (cgpaOrPercentage) existingEmployeeDoc.education.cgpaOrPercentage = cgpaOrPercentage;

          existingEmployeeDoc.manager = managerId || existingEmployeeDoc.manager;
          existingEmployeeDoc.reportingManagerId = managerId || existingEmployeeDoc.reportingManagerId;
          if (spouseDetails) existingEmployeeDoc.spouseDetails = spouseDetails;
          if (children.length > 0) existingEmployeeDoc.children = children;
          if (brothers.length > 0) existingEmployeeDoc.brothers = brothers;
          if (sisters.length > 0) existingEmployeeDoc.sisters = sisters;
          if (experience.length > 0) existingEmployeeDoc.experience = experience;
          existingEmployeeDoc.emergencyContactName = emergencyContactName || existingEmployeeDoc.emergencyContactName;
          existingEmployeeDoc.emergencyContactNumber = emergencyContactNumber || existingEmployeeDoc.emergencyContactNumber;
          if (policyId) existingEmployeeDoc.leavePolicy = policyId;
          
          if (bankName || accountNumber || ifscCode) {
            existingEmployeeDoc.bankDetails = {
              bankName: bankName || existingEmployeeDoc.bankDetails?.bankName,
              accountNumber: accountNumber || existingEmployeeDoc.bankDetails?.accountNumber,
              ifsc: ifscCode || existingEmployeeDoc.bankDetails?.ifsc,
              branchName: branchName || existingEmployeeDoc.bankDetails?.branchName,
              location: bankLocation || existingEmployeeDoc.bankDetails?.location
            };
          }
          if (Object.keys(tempAddr).length > 0) existingEmployeeDoc.tempAddress = tempAddr;
          if (Object.keys(permAddr).length > 0) existingEmployeeDoc.permAddress = permAddr;
          if (panNumber || aadharNumber) {
            existingEmployeeDoc.documents = existingEmployeeDoc.documents || {};
            if (panNumber) existingEmployeeDoc.documents.panNumber = panNumber;
            if (aadharNumber) existingEmployeeDoc.documents.aadharNumber = aadharNumber;
          }
          finalEmployee = existingEmployeeDoc;
        } else {
          // CREATE NEW EMPLOYEE
          finalEmployee = new Employee({
            mainCompanyId: tenantId,
            tenant: tenantId,
            employeeId: empId,
            employeeCode: empId,
            firstName,
            middleName: middleName || undefined,
            lastName,
            email,
            personalEmail: personalEmail || undefined,
            password: hashedPassword,
            contactNo: contactNo || undefined,
            gender: validGender || undefined,
            dob: dobDate,
            joiningDate: joiningDateObj,
            departmentId,
            department: departmentName || undefined,
            role: role || undefined,
            designation: role || undefined,
            employeeType: validJobType,
            maritalStatus: maritalStatus || undefined,
            nationality: nationality || undefined,
            bloodGroup: bloodGroup || undefined,
            fatherName: fatherName || undefined,
            motherName: motherName || undefined,
            marriageDate: marriageDate || undefined,
            highestQualification: highestQualification || undefined,
            education: {
              type: highestQualification || undefined,
              class10Marks: cgpaOrPercentage || undefined,
              class12Marks: cgpaOrPercentage || undefined,
              yearOfPassing: yearOfPassing || undefined,
              cgpaOrPercentage: cgpaOrPercentage || undefined
            },
            manager: managerId || undefined,
            reportingManagerId: managerId || undefined,
            spouseDetails: spouseDetails || undefined,
            children: children.length > 0 ? children : undefined,
            brothers: brothers.length > 0 ? brothers : undefined,
            sisters: sisters.length > 0 ? sisters : undefined,
            experience: experience.length > 0 ? experience : undefined,
            emergencyContactName: emergencyContactName || undefined,
            emergencyContactNumber: emergencyContactNumber || undefined,
            leavePolicy: policyId,
            bankDetails: (bankName || accountNumber || ifscCode) ? {
              bankName: bankName || undefined,
              accountNumber: accountNumber || undefined,
              ifsc: ifscCode || undefined,
              branchName: branchName || undefined,
              location: bankLocation || undefined
            } : undefined,
            tempAddress: Object.keys(tempAddr).length > 0 ? tempAddr : undefined,
            permAddress: Object.keys(permAddr).length > 0 ? permAddr : undefined,
            documents: (panNumber || aadharNumber) ? {
              panNumber: panNumber || undefined,
              aadharNumber: aadharNumber || undefined
            } : undefined,
            status: 'active',
            lastStep: 6 // Mark as completed
          });
        }

        // Save with detailed error logging
        try {
          await finalEmployee.save();

          // Keep GT ONE/global auth in sync for employee email login (non-fatal on failure)
          try {
            const User = getGlobalUserModel();
            const normalizedEmail = String(email || '').toLowerCase().trim();
            if (normalizedEmail) {
              const existingUser = await User.findOne({ email: normalizedEmail }).lean();
              if (!existingUser) {
                await User.create({
                  name: `${firstName || ''} ${lastName || ''}`.trim() || empId,
                  email: normalizedEmail,
                  password: hashedPassword || finalEmployee.password,
                  role: 'employee',
                  mainCompanyId: tenantId,
                  tenant: tenantId,
                  companyId: tenantId,
                  permissions: getDefaultPerms('employee')
                });
              } else if (String(existingUser.role || '').toLowerCase() === 'employee') {
                await User.findByIdAndUpdate(existingUser._id, {
                  $set: {
                    name: `${firstName || ''} ${lastName || ''}`.trim() || existingUser.name || empId,
                    password: hashedPassword || finalEmployee.password,
                    mainCompanyId: tenantId,
                    tenant: tenantId,
                    companyId: tenantId
                  }
                });
              } else {
                results.warnings.push(`Row ${rowIdx}: Global user exists with non-employee role (${existingUser.role}) - skipped auth sync`);
              }
            }
          } catch (syncErr) {
            results.warnings.push(`Row ${rowIdx}: Employee saved but global login sync failed (${syncErr.message})`);
          }
          
          // Soft leave policy assignment for bulk upload (do not fail employee creation)
          if (!isUpdate) {
            try {
              const LeavePolicy = req.tenantDB.model('LeavePolicy');
              const LeaveBalance = req.tenantDB.model('LeaveBalance');
              const selectedPolicy = finalEmployee.leavePolicy
                ? await LeavePolicy.findOne({ _id: finalEmployee.leavePolicy, tenant: tenantId })
                : null;
              if (selectedPolicy) {
                await leaveManagementService.assignPolicyToEmployee({
                  employee: finalEmployee,
                  tenantId,
                  policy: selectedPolicy,
                  year: finalEmployee.joiningDate.getFullYear(),
                  prorate: true,
                  models: { Employee, LeavePolicy, LeaveBalance }
                });
              } else {
                results.warnings.push(`Row ${rowIdx}: No active leave policy found - employee created without policy assignment`);
              }
            } catch (pErr) {
              console.error(`Row ${rowIdx}: Policy auto-assignment warning (bulk):`, pErr.message);
              results.warnings.push(`Row ${rowIdx}: Leave policy assignment skipped (${pErr.message})`);
            }
          }

          results.uploadedCount++;
          results.processedIds.push(finalEmployee._id || empId);
          processedEmpIds.add(empIdLower);
          processedEmails.add(emailLower);
        } catch (saveErr) {
          // Detailed save error logging
          console.error(`Row ${rowIdx} save failed:`, saveErr);
          throw new Error(`Failed to save employee: ${saveErr.message}`);
        }

      } catch (error) {
        results.failedCount++;
        const errorMsg = `Row ${rowIdx}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error('Bulk upload row error:', errorMsg, error);
      }
    }

    // ====== POST-PROCESS HIERARCHY REBUILD ======
    // Rebuild hierarchies reactively for all successfully uploaded employees in this batch
    for (const empId of results.processedIds) {
      try {
        const empDoc = await Employee.findOne({ tenant: tenantId, employeeId: empId }).select('_id').lean();
        if (empDoc) {
          await employeeHierarchyService.buildEmployeeHierarchy({
            tenantDB: req.tenantDB,
            tenantId,
            employeeId: empDoc._id
          });
        }
      } catch (postHierarchyErr) {
        console.error(`Post-processing hierarchy build warning for employee ${empId}:`, postHierarchyErr.message);
        results.warnings.push(`Post-process hierarchy build failed for employee ID ${empId}: ${postHierarchyErr.message}`);
      }
    }

    // Note: Counters are already synchronized by generateIdInternal call in the loop

    // ====== PREPARE RESPONSE ======
    const allFailed = results.uploadedCount === 0;
    const allSucceeded = results.failedCount === 0;

    let message = '';
    if (allSucceeded) {
      message = `Successfully uploaded all ${results.uploadedCount} employee(s)`;
      if (results.autoGeneratedIds.length > 0) {
        message += ` (${results.autoGeneratedIds.length} ID(s) auto-generated)`;
      }
    } else if (allFailed) {
      message = `Failed to upload all ${results.failedCount} employee(s)`;
    } else {
      message = `Uploaded ${results.uploadedCount} employee(s) successfully, ${results.failedCount} failed`;
      if (results.autoGeneratedIds.length > 0) {
        message += ` (${results.autoGeneratedIds.length} ID(s) auto-generated)`;
      }
    }

    _invalidateOrgCache(tenantId);
    res.json({
      success: !allFailed, // Only success if at least one record uploaded
      uploadedCount: results.uploadedCount,
      failedCount: results.failedCount,
      errors: results.errors,
      warnings: results.warnings,
      autoGeneratedIds: results.autoGeneratedIds,
      message
    });

  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({
      success: false,
      message: "Bulk upload failed due to server error",
      error: err.message,
      uploadedCount: 0,
      failedCount: 0,
      errors: [err.message || 'An unexpected error occurred']
    });
  }
};
