const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Group = require('../models/Group');
// User schema registration for populate support
let User;
try {
  User = mongoose.model('User');
} catch (e) {
  User = mongoose.model('User', require('../models/User'));
}
let Counter = require('../models/Counter');
const crypto = require('crypto');

// Counter may be exported as a Schema (for multi-tenant reuse) or as a Model.
if (typeof Counter.findOneAndUpdate !== 'function') {
  try {
    Counter = mongoose.model('TenantCounter', Counter); // Use unique name 'TenantCounter' to avoid conflict
  } catch (e) {
    Counter = mongoose.model('TenantCounter');
  }
}

const getTenantDB = require('../utils/tenantDB');
const emailService = require('../utils/emailService');
const smsService = require('../utils/smsService');
const jwtUtil = require('../utils/jwt');

const EmployeeSchema = require('../models/Employee');
const DepartmentSchema = require('../models/Department');
const LeaveRequestSchema = require('../models/LeaveRequest');
const ActivitySchema = require('../models/Activity');
const AttendanceSchema = require('../models/Attendance');
const { logActivity } = require('../services/activityLogger');
const UserSchema = require('../models/User');

const MODULE_KEY_MAP = {
  hr: 'hr',
  payroll: 'payroll',
  attendance: 'attendance',
  leave: 'leave',
  recruitment: 'recruitment',
  backgroundverification: 'backgroundVerification',
  backgroundVerification: 'backgroundVerification',
  documentmanagement: 'documentManagement',
  documentManagement: 'documentManagement',
  socialmediaintegration: 'socialMediaIntegration',
  socialMediaIntegration: 'socialMediaIntegration',
  socialmedia: 'socialMediaIntegration',
  socialMedia: 'socialMediaIntegration',
  employeeportal: 'employeePortal',
  employeePortal: 'employeePortal',
  ess: 'employeePortal',
  reports: 'reports',
  onboarding: 'onboarding',
  policy: 'policy',
  customstudio: 'customStudio',
  'custom studio': 'customStudio',
  customStudio: 'customStudio',
  access: 'accessControl',
  'access control': 'accessControl',
  accessControl: 'accessControl'
};

const MODULE_DEPENDENCIES = {
  leave: ['hr'],
  backgroundVerification: ['hr'],
  documentManagement: ['hr'],
  employeePortal: ['hr']
};

const PSA_MODULE_CODES = [
  'hr',
  'payroll',
  'attendance',
  'leave',
  'employeePortal',
  'recruitment',
  'backgroundVerification',
  'documentManagement',
  'socialMediaIntegration',
  'onboarding',
  'policy',
  'reports',
  'customStudio',
  'accessControl'
];

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSafeDatabaseName(companyName, companyCode, tenantObjectId) {
  const maxBytes = 38;
  const safeName = String(companyName || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
  const parts = ['company', safeName].filter(Boolean);
  let dbName = parts.join('_').slice(0, maxBytes);
  return dbName;
}

async function databaseNameExists(dbName) {
  const existingTenant = await Tenant.findOne({ databaseName: dbName }).select('_id').lean();
  if (existingTenant) return true;

  try {
    const adminDb = mongoose.connection.db?.admin?.();
    if (!adminDb) return false;
    const result = await adminDb.listDatabases({ nameOnly: true });
    return Array.isArray(result?.databases) && result.databases.some((db) => db.name === dbName);
  } catch (err) {
    console.warn(`[TENANT_DB_NAME_CHECK] Could not list databases, continuing with Tenant uniqueness only: ${err.message}`);
    return false;
  }
}

async function generateUniqueDatabaseName(companyName, companyCode, tenantObjectId) {
  const base = buildSafeDatabaseName(companyName, companyCode, tenantObjectId);
  let candidate = base;
  let attempt = 1;

  while (await databaseNameExists(candidate)) {
    attempt += 1;
    const suffix = `_${attempt}`;
    candidate = `${base.slice(0, 38 - suffix.length)}${suffix}`;
  }

  return candidate;
}

const MODULE_LABELS = {
  hr: 'HR',
  payroll: 'Payroll',
  attendance: 'Attendance',
  leave: 'Leave',
  recruitment: 'Hiring',
  backgroundVerification: 'BGV',
  documentManagement: 'Documents',
  socialMediaIntegration: 'Social Media',
  employeePortal: 'Employee Portal',
  reports: 'Reports',
  onboarding: 'Onboarding',
  policy: 'Policy'
};

const MODULE_ARRAY_TO_KEY = {
  hr: 'hr',
  'hr management': 'hr',
  payroll: 'payroll',
  attendance: 'attendance',
  leave: 'leave',
  hiring: 'recruitment',
  recruitment: 'recruitment',
  bgv: 'backgroundVerification',
  'background verification': 'backgroundVerification',
  documents: 'documentManagement',
  'document management': 'documentManagement',
  'social media': 'socialMediaIntegration',
  'social media integration': 'socialMediaIntegration',
  'employee portal': 'employeePortal',
  ess: 'employeePortal',
  reports: 'reports',
  onboarding: 'onboarding',
  policy: 'policy'
};

function defaultEnabledModules(value = false) {
  return {
    hr: !!value,
    payroll: !!value,
    attendance: !!value,
    leave: !!value,
    recruitment: !!value,
    backgroundVerification: !!value,
    documentManagement: !!value,
    socialMediaIntegration: !!value,
    employeePortal: !!value,
    reports: !!value,
    onboarding: !!value,
    policy: !!value,
    customStudio: !!value,
    accessControl: !!value
  };
}

function normalizeModuleKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return null;
  return MODULE_KEY_MAP[raw] || MODULE_KEY_MAP[raw.toLowerCase()] || MODULE_ARRAY_TO_KEY[raw.toLowerCase()] || null;
}

function normalizeEnabledModulesObject(input, base = defaultEnabledModules()) {
  const out = { ...base };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;

  Object.entries(input).forEach(([key, value]) => {
    const normalizedKey = normalizeModuleKey(key);
    if (normalizedKey) out[normalizedKey] = value === true;
  });
  return out;
}

function enabledModulesFromArray(modules = []) {
  const out = defaultEnabledModules();
  if (!Array.isArray(modules)) return out;

  modules.forEach((m) => {
    const normalizedKey = normalizeModuleKey(m);
    if (normalizedKey) out[normalizedKey] = true;
  });
  return applyModuleDependencies(out);
}

function enabledModulesToArray(enabledModules = {}) {
  const codes = Object.keys(defaultEnabledModules(false));
  return codes
    .filter((key) => enabledModules[key] === true)
    .map((key) => MODULE_LABELS[key] || key);
}

function applyModuleDependencies(enabledModules = {}) {
  const out = { ...defaultEnabledModules(), ...enabledModules };
  let changed = true;

  while (changed) {
    changed = false;
    Object.entries(MODULE_DEPENDENCIES).forEach(([moduleKey, deps]) => {
      if (out[moduleKey] === true) {
        deps.forEach((dep) => {
          if (out[dep] !== true) {
            out[dep] = true;
            changed = true;
          }
        });
      }
    });
  }

  return out;
}


const bcrypt = require('bcryptjs');

// ======================================================
// CREATE COMPANY (TENANT)
// ======================================================
exports.createCompany = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      adminEmail,
      ownerName,
      adminName,
      subCompanyLimit,
      parentCompanyId,
      groupId,
      phone,
      password,
      logo,
      code,
      meta,
      enabledModules,
      modules,
      userLimit
    } = req.body;

    const finalCompanyName = String(companyName || '').trim();
    const finalCompanyEmail = String(companyEmail || adminEmail || '').trim().toLowerCase();
    const finalAdminName = String(ownerName || adminName || '').trim();
    const finalSubCompanyLimit = Number(subCompanyLimit || 1000);
    const finalUserLimit = Number(userLimit || 0);
    const finalParentCompanyId = String(parentCompanyId || '').trim();
    const finalGroupId = String(groupId || '').trim();

    // Basic validation
    if (!finalCompanyName || !finalCompanyEmail || !finalAdminName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: companyName, companyEmail, ownerName, password'
      });
    }

    let group = null;
    let totalCompaniesInGroup = 0;
    let resolvedGroupId = null;

    if (finalGroupId) {
      if (!mongoose.Types.ObjectId.isValid(finalGroupId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid groupId'
        });
      }

      group = await Group.findById(finalGroupId).lean();
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const requesterId = String(req.user?.id || '').trim().toLowerCase();
      const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
      const groupCreatedBy = String(group.createdBy || '').trim().toLowerCase();

      // Optional ownership security when groupId is used.
      const isOwner = [requesterId, requesterEmail].filter(Boolean).includes(groupCreatedBy);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Group does not belong to this Super Admin'
        });
      }

      totalCompaniesInGroup = await Tenant.countDocuments({
        groupId: finalGroupId,
        status: { $ne: 'deleted' }
      });

      if (totalCompaniesInGroup >= Number(group.companyLimit || 0)) {
        return res.status(400).json({
          success: false,
          message: 'Company limit reached. Contact Super Admin'
        });
      }

      resolvedGroupId = finalGroupId;
    }

    // Check duplicate
    const existing = await Tenant.findOne({ companyEmail: finalCompanyEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Company with this email already exists'
      });
    }

    // Optional duplicate name guard inside same group if groupId was passed.
    if (resolvedGroupId) {
      const duplicateNameInGroup = await Tenant.findOne({
        groupId: resolvedGroupId,
        companyName: { $regex: new RegExp(`^${finalCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        status: { $ne: 'deleted' }
      }).lean();

      if (duplicateNameInGroup) {
        return res.status(400).json({
          success: false,
          message: 'Company with this name already exists in selected group'
        });
      }
    }

    let parentCompany = null;
    let createdSubCompanies = 0;
    if (finalParentCompanyId) {
      if (!mongoose.Types.ObjectId.isValid(finalParentCompanyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid parentCompanyId'
        });
      }

      parentCompany = await Tenant.findById(finalParentCompanyId).select('companyName subCompanyLimit status').lean();
      if (!parentCompany) {
        return res.status(404).json({
          success: false,
          message: 'Parent company not found'
        });
      }

      createdSubCompanies = await Tenant.countDocuments({
        parentCompanyId: finalParentCompanyId,
        status: { $ne: 'deleted' }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate SaaS IDs
    const tenantId = "tenant_" + crypto.randomUUID();
    const apiKey = "key_" + crypto.randomUUID();

    // Sleek Auto-generated Short Code fallback if none provided.
    let finalCode = String(code || '').trim();
    if (!finalCode) {
      const prefix = finalCompanyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toLowerCase() || 'cmp';
      const existingCodes = await Tenant.find({ code: new RegExp(`^${prefix}\\d{3}$`, 'i') }).select('code');
      let maxSeq = 0;
      for (const t of existingCodes) {
        const seq = parseInt(t.code.substring(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
      finalCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
    }
    finalCode = finalCode.toLowerCase();

    const duplicateCode = await Tenant.findOne({
      code: { $regex: new RegExp(`^${escapeRegex(finalCode)}$`, 'i') },
      status: { $ne: 'deleted' }
    }).select('_id companyName code').lean();

    if (duplicateCode) {
      return res.status(400).json({
        success: false,
        message: `Company code "${finalCode.toUpperCase()}" is already used by ${duplicateCode.companyName || 'another company'}. Please use a unique code.`
      });
    }

    // Default: all modules enabled for new companies. If the caller explicitly
    // sends an enabledModules object or a modules array, honour it; otherwise
    // onboard the tenant with every module active so they don't hit an
    // "Unauthorized" wall on first login.
    const normalizedEnabledModules = Array.isArray(modules)
      ? enabledModulesFromArray(modules)
      : (enabledModules && typeof enabledModules === 'object' && !Array.isArray(enabledModules)
        ? normalizeEnabledModulesObject(enabledModules, defaultEnabledModules(true))
        : defaultEnabledModules(true));

    const company = new Tenant({
      companyName: finalCompanyName,
      companyEmail: finalCompanyEmail,
      adminEmail: finalCompanyEmail,
      ownerName: finalAdminName,
      adminName: finalAdminName,
      groupId: resolvedGroupId,
      parentCompanyId: finalParentCompanyId || null,
      subCompanyLimit: finalSubCompanyLimit,
      userLimit: finalUserLimit,
      phone: phone?.trim(),
      password: hashedPassword,
      logo: logo || null,
      tenantId,
      apiKey,
      code: finalCode,
      enabledModules: normalizedEnabledModules,
      modules: enabledModulesToArray(normalizedEnabledModules),
      status: 'active', // Direct activation for SaaS creation
      isVerified: true,
      meta: { ...(meta || {}), primaryEmail: finalCompanyEmail, ownerName: finalAdminName, adminPassword: password }
    });

    company.databaseName = await generateUniqueDatabaseName(finalCompanyName, finalCode, company._id);


    // Create the Admin User in the MAIN database
    const User = mongoose.model('User');
    const isSubCompany = Boolean(finalParentCompanyId);
    const adminUser = new User({
      name: finalAdminName,
      email: finalCompanyEmail,
      password: hashedPassword,
      role: isSubCompany ? 'company_admin' : 'hr',
      tenant: company._id,
      mainCompanyId: company._id,
      groupId: resolvedGroupId,
      companyId: company._id
    });
    await adminUser.save();

    company.adminUser = adminUser._id;
    await company.save();

    // Log Activity
    await logActivity({
      actionType: "COMPANY_CREATED",
      message: `Company ${company.companyName} created`,
      tenantId: company.tenantId,
      companyName: company.companyName,
      performedBy: req.user?.email || "superadmin",
      metadata: {
        companyId: company._id
      }
    });

    // Initialize a fresh tenant database. This must use the Tenant _id so the
    // resolver lands on the exact databaseName stored above.
    try {
      const db = await getTenantDB(company._id);
      db.model("Employee", EmployeeSchema);
      db.model("Department", DepartmentSchema);
      db.model("LeaveRequest", LeaveRequestSchema);
      db.model("Attendance", AttendanceSchema);
      db.model("User", UserSchema);
      db.model('Activity', ActivitySchema);

      await db.db.collection('tenant_metadata').updateOne(
        { key: 'tenant' },
        {
          $setOnInsert: {
            key: 'tenant',
            tenantObjectId: company._id,
            tenantId: company.tenantId,
            companyCode: company.code,
            companyName: company.companyName,
            databaseName: company.databaseName,
            initializedAt: new Date(),
            isolated: true
          }
        },
        { upsert: true }
      );

      const Activity = db.model('Activity');
      await Activity.create({
        action: 'Tenant initialized',
        company: company.companyName,
        tenant: company._id,
        meta: { seeded: true, databaseName: company.databaseName }
      });
    } catch (dbErr) {
      console.warn('Tenant DB initialization skipped or failed:', dbErr.message);
    }

    res.json({
      success: true,
      company,
      ...(group ? {
        groupUsage: {
          limit: Number(group.companyLimit || 0),
          created: totalCompaniesInGroup + 1,
          remaining: Math.max(Number(group.companyLimit || 0) - (totalCompaniesInGroup + 1), 0)
        }
      } : {}),
      ...(parentCompany ? {
        subCompanyCreated: createdSubCompanies + 1
      } : {})
    });

  } catch (err) {
    console.error('Company creation error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ======================================================
// GET COMPANY COUNT BY GROUP (FOR PSA CREATE COMPANY UI)
// ======================================================
exports.getCompanyCountByGroup = async (req, res) => {
  try {
    const { groupId } = req.query;
    const finalGroupId = String(groupId || '').trim();

    if (!finalGroupId) {
      return res.status(400).json({
        success: false,
        message: 'groupId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(finalGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groupId'
      });
    }

    const group = await Group.findById(finalGroupId).lean();
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const requesterId = String(req.user?.id || '').trim().toLowerCase();
    const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
    const groupCreatedBy = String(group.createdBy || '').trim().toLowerCase();

    const isOwner = [requesterId, requesterEmail].filter(Boolean).includes(groupCreatedBy);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Group does not belong to this Super Admin'
      });
    }

    const total = await Tenant.countDocuments({
      groupId: finalGroupId,
      status: { $ne: 'deleted' }
    });

    return res.json({ total });
  } catch (error) {
    console.error('getCompanyCountByGroup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company count',
      error: error.message
    });
  }
};



// ======================================================
// BACKEND-ONLY COMPANY VERIFICATION (Recommended)
// ======================================================
exports.verifyCompany = async (req, res, next) => {
  try {
    const token = req.params.token;

    if (!token) {
      return res.status(400).send('<h3>Missing verification token</h3>');
    }

    const t = await Tenant.findOne({ verificationToken: token });

    if (!t) {
      return res.status(404).send('<h3>Invalid or expired verification link</h3>');
    }

    t.isVerified = true;
    t.status = 'active';
    t.verificationToken = null;
    await t.save();

    // Support JSON response for SPA consumption when requested
    const wantsJson = req.query.json === '1' || req.query.format === 'json';
    if (wantsJson) {
      return res.json({ success: true, message: 'Company activated', data: { id: t._id, name: t.name, code: t.code, status: t.status } });
    }

    return res.send(`
      <html>
      <body style="font-family:Arial;padding:40px;text-align:center;">
        <h2 style="color:green;">Company "${t.name}" has been successfully activated!</h2>
        <p>You may now log in to the HRMS dashboard.</p>
      </body>
      </html>
    `);

  } catch (err) {
    next(err);
  }
};

// ======================================================
// Other existing handlers (unchanged)
// ======================================================

exports.listTenants = async (req, res, next) => {
  try {
    let query = {};
    if (req.user?.role === 'company_super_admin' && req.user.groupId) {
      query.groupId = req.user.groupId;
    }
    const tenants = await Tenant.find(query).sort({ createdAt: -1 }).populate({
      path: 'adminUser',
      model: 'User'
    }).lean();
    
    // 🔥 CRITICAL: Ensure _id is a string for the frontend
    const sanitized = tenants.map(t => ({
      ...t,
      _id: t._id ? t._id.toString() : null
    }));
    
    res.json(sanitized);
  } catch (err) { next(err); }
};

exports.getTenant = async (req, res, next) => {
  try {
    const t = await Tenant.findById(req.params.id).populate({
      path: 'adminUser',
      model: 'User'
    }).lean();
    if (!t) return res.status(404).json({ error: 'not_found' });
    res.json({ ...t, _id: t._id.toString() });
  } catch (err) { next(err); }
};

// ======================================================
// PARENT / SUB-COMPANY TREE FOR PSA LISTING
// ======================================================
exports.getParentCompanies = async (req, res, next) => {
  try {
    let query = {
      parentCompanyId: null,
      status: { $ne: 'deleted' }
    };

    if (req.user?.role === 'company_super_admin' && req.user.groupId) {
      query.groupId = req.user.groupId;
    }

    const parents = await Tenant.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: 'adminUser',
        model: 'User'
      })
      .lean();

    return res.json({
      success: true,
      items: parents.map(p => ({ ...p, _id: p._id.toString() }))
    });
  } catch (error) {
    console.error('🔥 [getParentCompanies] ERROR:', error);
    next(error);
  }
};

exports.getSubCompaniesByParent = async (req, res) => {
  try {
    const parentId = String(req.query.parentId || '').trim();
    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: 'parentId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parentId'
      });
    }

    const items = await Tenant.find({
      parentCompanyId: parentId,
      status: { $ne: 'deleted' }
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'adminUser',
        model: 'User'
      })
      .lean();

    return res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('getSubCompaniesByParent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-companies',
      error: error.message
    });
  }
};

exports.getMyModules = async (req, res, next) => {
  try {
    const role = (req.user?.role || '').toLowerCase();
    const tid = req.tenantId || req.user?.tenantId;

    if (!tid) {
      if (role === 'psa') {
        const psaModules = {
          hr: true, payroll: true, attendance: true, leave: true,
          recruitment: true, backgroundVerification: true, documentManagement: true,
          socialMediaIntegration: true, onboarding: true, employeePortal: true, reports: true, policy: true,
          customStudio: true, accessControl: true
        };
        const labels = ['HR', 'Payroll', 'Attendance', 'Leave', 'Hiring', 'BGV', 'Documents', 'Social Media', 'Onboarding', 'Employee Portal', 'Reports', 'Policy', 'Custom Studio', 'Access Control'];
        return res.json({ enabledModules: psaModules, modules: labels });
      }
      return res.status(400).json({ error: 'no_tenant' });
    }

    const t = await Tenant.findById(tid).select('enabledModules modules').lean();
    if (!t) {
      return res.json({ 
        enabledModules: defaultEnabledModules(true), 
        modules: enabledModulesToArray(defaultEnabledModules(true)) 
      });
    }
    // If the tenant has no enabledModules configured (legacy tenant),
    // default ALL modules to true so employees/HR don't hit Unauthorized.
    const hasConfiguredModules = t.enabledModules && typeof t.enabledModules === 'object' && Object.keys(t.enabledModules).length > 0;
    const effectiveEnabledModules = hasConfiguredModules ? t.enabledModules : defaultEnabledModules(true);
    const resolvedModules = Array.isArray(t.modules) && t.modules.length > 0
      ? t.modules
      : enabledModulesToArray(effectiveEnabledModules);
    res.json({ enabledModules: effectiveEnabledModules, modules: resolvedModules });
  } catch (err) { next(err); }
};

exports.getMyTenant = async (req, res, next) => {
  try {
    const tid = req.tenantId || req.user?.tenantId;
    const role = (req.user?.role || '').toLowerCase();
    const isHR = ['hr', 'admin', 'psa', 'company_admin', 'company_super_admin'].includes(role);

    if (!tid) {
      if (role === 'psa') {
        return res.json({ 
          _id: 'psa_tenant', 
          companyName: 'HRMS Super Admin',
          code: 'PSA',
          status: 'active'
        });
      }
      return res.status(400).json({ error: 'no_tenant' });
    }
    let t = null;
    if (mongoose.Types.ObjectId.isValid(tid)) {
      t = await Tenant.findById(tid).select('-password -apiKey -meta.adminPassword').lean();
    }
    
    if (!t) {
      t = await Tenant.findOne({ tenantId: tid }).select('-password -apiKey -meta.adminPassword').lean();
    }
    
    if (!t) {
      const fallback = {
        _id: tid,
        name: req.user?.companyName || req.user?.companyCode || 'My Company',
        companyName: req.user?.companyName || req.user?.companyCode || 'My Company',
        code: req.user?.companyCode || tid.substring(0, 6) || 'TMP',
        status: 'active',
        enabledModules: defaultEnabledModules(true),
        modules: enabledModulesToArray(defaultEnabledModules(true))
      };
      return res.json(fallback);
    }
    
    if (!isHR) {
      return res.json({
        _id: t._id,
        name: t.name || t.companyName,
        companyName: t.companyName,
        logo: t.logo || t.meta?.logo,
        code: t.code,
        status: t.status,
        enabledModules: (t.enabledModules && Object.keys(t.enabledModules).length > 0) ? t.enabledModules : defaultEnabledModules(true),
        modules: (Array.isArray(t.modules) && t.modules.length > 0)
          ? t.modules
          : enabledModulesToArray((t.enabledModules && Object.keys(t.enabledModules).length > 0) ? t.enabledModules : defaultEnabledModules(true))
      });
    }

    res.json(t);
  } catch (err) { next(err); }
};


exports.updateTenant = async (req, res, next) => {
  try {
    const { name, companyName, companyEmail, ownerName, phone, domain, emailDomain, plan, status, meta, modules, enabledModules, code, subCompanyLimit, userLimit, logo, password, dmsCompanyId } = req.body;

    const existing = await Tenant.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const updates = {};
    if (logo !== undefined) updates.logo = logo;
    if (name !== undefined) updates.name = name.trim();
    if (companyName !== undefined) updates.companyName = companyName.trim();
    if (companyEmail !== undefined) updates.companyEmail = companyEmail.trim();
    if (ownerName !== undefined) updates.ownerName = ownerName.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (code !== undefined) updates.code = code.trim();
    if (domain !== undefined) updates.domain = domain?.trim() || null;
    if (emailDomain !== undefined) updates.emailDomain = emailDomain?.trim() || null;
    if (plan !== undefined) updates.plan = plan;
    if (status !== undefined) updates.status = status;
    if (dmsCompanyId !== undefined) updates.dmsCompanyId = dmsCompanyId ? dmsCompanyId.trim() : null;
    
    if (Array.isArray(modules)) {
      const normalizedEnabledModules = enabledModulesFromArray(modules);
      updates.enabledModules = normalizedEnabledModules;
      updates.modules = enabledModulesToArray(normalizedEnabledModules);
    } else if (enabledModules && typeof enabledModules === 'object' && !Array.isArray(enabledModules)) {
      const normalizedEnabledModules = applyModuleDependencies(normalizeEnabledModulesObject(
        enabledModules,
        defaultEnabledModules(false)
      ));
      updates.enabledModules = normalizedEnabledModules;
      updates.modules = enabledModulesToArray(normalizedEnabledModules);
    }

    if (meta !== undefined && typeof meta === 'object') {
      updates.meta = { ...(existing.meta || {}), ...meta };
    }

    if (subCompanyLimit !== undefined) {
      const parsedSubCompanyLimit = Number(subCompanyLimit);
      updates.subCompanyLimit = isNaN(parsedSubCompanyLimit) ? 1000 : parsedSubCompanyLimit;
    }
    
    if (userLimit !== undefined) {
      const parsedUserLimit = Number(userLimit);
      if (!isNaN(parsedUserLimit) && parsedUserLimit >= 0) {
        updates.userLimit = parsedUserLimit;
      }
    }

    const t = await Tenant.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!t) return res.status(404).json({ error: 'not_found' });

    let newHashedPassword = null;
    if (password) {
      newHashedPassword = await bcrypt.hash(password, 10);
      await Tenant.findByIdAndUpdate(req.params.id, { 
        $set: { 
          password: newHashedPassword,
          'meta.adminPassword': password 
        } 
      });
    }

    if (ownerName !== undefined || password) {
      if (t.adminUser) {
        try {
          const User = mongoose.model('User');
          const userUpdates = {};
          if (ownerName !== undefined) userUpdates.name = ownerName.trim();
          if (newHashedPassword) userUpdates.password = newHashedPassword;
          
          if (Object.keys(userUpdates).length > 0) {
            await User.findByIdAndUpdate(t.adminUser, { $set: userUpdates });
          }
        } catch (userUpdateErr) {
          console.error('Failed to sync adminUser updates:', userUpdateErr.message);
        }
      }
    }

    await logActivity({
      actionType: "COMPANY_UPDATED",
      message: `Company ${t.companyName} updated`,
      tenantId: t.tenantId,
      companyName: t.companyName,
      performedBy: req.user?.email || "superadmin",
      metadata: {
        updatedFields: req.body
      }
    });

    res.json(t);
  } catch (err) { next(err); }
};

exports.deleteTenant = async (req, res, next) => {
  try {
    const t = await Tenant.findByIdAndUpdate(req.params.id, { $set: { status: 'deleted' } }, { new: true });
    if (!t) return res.status(404).json({ error: 'not_found' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.updateModules = async (req, res, next) => {
  try {
    const { enabledModules } = req.body;
    if (!enabledModules || typeof enabledModules !== 'object') {
      return res.status(400).json({ error: 'invalid_enabledModules_object' });
    }

    const before = await Tenant.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ error: 'not_found' });

    const normalizedEnabledModules = applyModuleDependencies(
      normalizeEnabledModulesObject(enabledModules, defaultEnabledModules(false))
    );

    const t = await Tenant.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          enabledModules: normalizedEnabledModules,
          modules: enabledModulesToArray(normalizedEnabledModules)
        }
      },
      { new: true }
    ).lean();
    if (!t) return res.status(404).json({ error: 'not_found' });

    await logActivity({
      actionType: "MODULES_UPDATED",
      message: `Modules updated for ${t.companyName}`,
      tenantId: t.tenantId,
      companyName: t.companyName,
      performedBy: req.user?.email || "superadmin",
      metadata: {
        enabledModules: normalizedEnabledModules
      }
    });

    try {
      const db = await getTenantDB(t._id);
      let Activity;
      try {
        Activity = db.model('Activity');
      } catch (e) {
        Activity = db.model('Activity', ActivitySchema);
      }

      const beforeModules = before.enabledModules || {};
      const afterModules = normalizedEnabledModules || {};

      const enabled = [];
      const disabled = [];

      Object.keys(afterModules).forEach(key => {
        if (afterModules[key] && !beforeModules[key]) enabled.push(key);
        if (!afterModules[key] && beforeModules[key]) disabled.push(key);
      });

      let actionText = 'Module configuration updated';
      if (enabled.length > 0 || disabled.length > 0) {
        actionText = `Modules updated. Enabled: ${enabled.join(', ') || 'none'}, Disabled: ${disabled.join(', ') || 'none'}`;
      }

      await Activity.create({
        action: actionText,
        company: t.companyName || t.name,
        tenant: t._id,
        meta: { enabled, disabled, before: beforeModules, after: afterModules }
      });
    } catch (activityErr) {
      console.error('Failed to log tenant module update activity:', activityErr.message);
    }

    res.json(t);
  } catch (err) { next(err); }
};


exports.sendActivationEmail = async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const { adminEmail, password } = req.body;
    if (!adminEmail) return res.status(400).json({ error: 'admin_email_required' });

    const t = await Tenant.findById(tenantId);
    if (!t) return res.status(404).json({ error: 'not_found' });

    const token = jwtUtil.sign({ tenantId: t._id }, { expiresIn: '7d' });
    const backendBase = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const activationUrl = `${backendBase}/api/tenants/activate?token=${token}`;

    const subject = `Activate your company account: ${t.name}`;
    const html = `
      <p>Hello,</p>
      <p>Your company <strong>${t.name}</strong> has been created.</p>
      <p>Company Code: <strong>${t.code}</strong></p>
      ${password ? `<p>Temporary Password: <strong>${password}</strong></p>` : ''}
      <p>Please click the link below to confirm and activate your account:</p>
      <p><a href="${activationUrl}">Activate account</a></p>
      <p>This link expires in 7 days.</p>
    `;

    await emailService.sendMail({ to: adminEmail, subject, html });
    res.json({ success: true, message: 'activation_email_sent' });
  } catch (err) { next(err); }
};


exports.sendActivationSms = async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone_required' });

    const t = await Tenant.findById(tenantId);
    if (!t) return res.status(404).json({ error: 'not_found' });

    const token = jwtUtil.sign({ tenantId: t._id }, { expiresIn: '7d' });
    const backendBase = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const activationUrl = `${backendBase}/api/tenants/activate?token=${token}`;

    const body = `Activate company ${t.name} (code: ${t.code}). Open: ${activationUrl}`;

    await smsService.sendSms({ to: phone, body });
    res.json({ success: true, message: 'activation_sms_sent' });
  } catch (err) { next(err); }
};


exports.activateTenant = async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).send('<h3>Missing token</h3>');

    let payload;
    try {
      payload = jwtUtil.verify(token);
    } catch (e) {
      return res.status(400).send('<h3>Invalid or expired token</h3>');
    }

    const tenantId = payload.tenantId;
    if (!tenantId) return res.status(400).send('<h3>Invalid token payload</h3>');

    const t = await Tenant.findByIdAndUpdate(tenantId, { $set: { status: 'active' } }, { new: true }).lean();
    if (!t) return res.status(404).send('<h3>Tenant not found</h3>');

    return res.send(`
      <html><body>
      <h2>Company "${t.name}" activated</h2>
      <p>You may now log in.</p>
      </body></html>
    `);
  } catch (err) { next(err); }
};


exports.psaStats = async (req, res, next) => {
  try {
    const tenantFilter = { status: { $ne: 'deleted' } };
    const [total, activeTenantsCount, tenants, totalUsers] = await Promise.all([
      Tenant.countDocuments(tenantFilter),
      Tenant.countDocuments({ status: 'active' }),
      Tenant.find(tenantFilter).select('enabledModules').lean(),
      User.countDocuments({
        role: { $nin: ['psa', 'super_admin', 'superadmin'] }
      }).catch(() => 0)
    ]);

    const activeModules = tenants.reduce((acc, t) => {
      const modules = t.enabledModules || {};
      return acc + PSA_MODULE_CODES.filter((key) => modules?.[key] === true).length;
    }, 0);
    const deactiveTenants = total - activeTenantsCount;

    res.json({
      companies: total,
      activeTenants: activeTenantsCount,
      deactiveTenants,
      activeModules,
      totalUsers,
      total,
      active: activeTenantsCount,
      inactive: deactiveTenants
    });
  } catch (err) {
    console.error("PSA Stats error:", err);
    next(err);
  }
};

exports.updateTenantPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const t = await Tenant.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'not_found' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const adminEmail = (t.adminEmail || t.companyEmail || t.meta?.primaryEmail || t.meta?.email || '').trim().toLowerCase();

    const meta = {
      ...(t.meta || {}),
      adminPassword: password,
      primaryEmail: adminEmail,
      email: adminEmail
    };

    t.password = hashedPassword;
    t.meta = meta;
    t.adminEmail = adminEmail; 
    await t.save();

    const User = mongoose.model('User');
    const updatedUser = await User.findOneAndUpdate(
      { tenant: t._id, role: 'hr' },
      { password: hashedPassword },
      { new: true }
    );

    if (t.adminEmail) {
      await User.findOneAndUpdate(
        { tenant: t._id, role: 'hr' },
        { email: t.adminEmail.trim().toLowerCase() }
      );
    }

    res.json({
      success: true,
      message: "Tenant security credentials updated successfully",
      updatedUser: !!updatedUser
    });
  } catch (err) {
    console.error("Update tenant password error:", err);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DMS INTEGRATION SETTINGS — GET & SAVE dmsCompanyId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/tenants/dms-integration
 * Returns the current dmsCompanyId for the authenticated company (tenant).
 */
exports.getDmsIntegration = async (req, res) => {
  try {
    // Resolve the tenant's Tenant document from the main DB
    const tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Could not determine tenant ID.' });
    }

    let tenant = null;
    if (mongoose.Types.ObjectId.isValid(tenantId)) {
      tenant = await Tenant.findById(tenantId).select('companyName dmsCompanyId').lean();
    }
    if (!tenant) {
      tenant = await Tenant.findOne({ tenantId }).select('companyName dmsCompanyId').lean();
    }
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    return res.json({
      success: true,
      dmsCompanyId: tenant.dmsCompanyId || '',
      companyName: tenant.companyName || ''
    });
  } catch (err) {
    console.error('[DMS Integration] getDmsIntegration error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/tenants/dms-integration
 * Body: { dmsCompanyId: "..." }
 * Sets the dmsCompanyId for the authenticated company (tenant).
 */
exports.saveDmsIntegration = async (req, res) => {
  try {
    const { dmsCompanyId } = req.body;
    if (typeof dmsCompanyId !== 'string') {
      return res.status(400).json({ success: false, message: 'dmsCompanyId must be a string' });
    }

    // Resolve tenant ID from the authenticated user
    const tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Could not determine tenant ID.' });
    }

    let tenant = null;
    if (mongoose.Types.ObjectId.isValid(tenantId)) {
      tenant = await Tenant.findByIdAndUpdate(
        tenantId,
        { $set: { dmsCompanyId: dmsCompanyId.trim() } },
        { new: true }
      ).select('companyName dmsCompanyId').lean();
    }
    if (!tenant) {
      tenant = await Tenant.findOneAndUpdate(
        { tenantId },
        { $set: { dmsCompanyId: dmsCompanyId.trim() } },
        { new: true }
      ).select('companyName dmsCompanyId').lean();
    }
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    console.log(`[DMS Integration] dmsCompanyId set to: "${tenant.dmsCompanyId}" for "${tenant.companyName}"`);
    
    // 🔥 Background Sync: Automatically push all existing open/active positions to DMS
    if (tenant.dmsCompanyId) {
        setImmediate(async () => {
            try {
                const getTenantDB = require('../utils/tenantDB');
                const db = await getTenantDB(tenant._id);
                if (!db.models.Requirement) {
                    db.model('Requirement', require('../models/Requirement'));
                }
                const Requirement = db.model('Requirement');
                // Find open or active requirements
                const requirements = await Requirement.find({ status: { $in: ['Open', 'Active'] } }).lean();
                
                const axios = require('axios');
                const dmsUrl = process.env.DMS_URL;
                const dmsToken = process.env.DMS_SECURE_TOKEN;
                
                if (dmsUrl && dmsToken && requirements.length > 0) {
                    console.log(`[DMS Sync] Auto-syncing ${requirements.length} positions for tenant ${tenant.companyName}...`);
                    for (const req of requirements) {
                        const positionId = req.jobOpeningId || String(req._id);
                        const positionName = req.jobTitle || 'Unknown Position';
                        try {
                            await axios.post(
                                `${dmsUrl}/api/v1/hrms/hiring/positions`,
                                {
                                    companyId: tenant.dmsCompanyId,
                                    positionId: positionId,
                                    positionName: positionName
                                },
                                {
                                    headers: { 'x-hrms-secure-token': dmsToken },
                                    timeout: 10000
                                }
                            );
                            console.log(`[DMS Sync] ✅ Auto-synced position ${positionId}`);
                        } catch (err) {
                            console.error(`[DMS Sync] ❌ Failed to auto-sync position ${positionId}:`, err.response?.data?.message || err.message);
                        }
                    }
                }
            } catch (syncErr) {
                console.error('[DMS Sync] Auto-sync background task failed:', syncErr.message);
            }
        });
    }

    return res.json({
      success: true,
      message: 'DMS Company ID saved successfully.',
      dmsCompanyId: tenant.dmsCompanyId,
      companyName: tenant.companyName
    });
  } catch (err) {
    console.error('[DMS Integration] saveDmsIntegration error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
