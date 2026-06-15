const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODULE_LABEL_BY_CODE = {
  hr: 'HR',
  payroll: 'Payroll',
  attendance: 'Attendance',
  leave: 'Leave',
  recruitment: 'Hiring',
  backgroundVerification: 'BGV',
  documentManagement: 'Documents',
  socialMediaIntegration: 'Social Media',
  employeePortal: 'Employee Portal',
  reports: 'Reports'
};

const MODULE_CODE_BY_LABEL = {
  hr: 'hr',
  'hr management': 'hr',
  hrm: 'hr',
  payroll: 'payroll',
  'payroll system': 'payroll',
  attendance: 'attendance',
  'attendance management': 'attendance',
  leave: 'leave',
  hiring: 'recruitment',
  recruitment: 'recruitment',
  bgv: 'backgroundVerification',
  'background verification': 'backgroundVerification',
  documents: 'documentManagement',
  'doc management': 'documentManagement',
  'document management': 'documentManagement',
  'social media': 'socialMediaIntegration',
  'social media integration': 'socialMediaIntegration',
  'employee portal': 'employeePortal',
  ess: 'employeePortal',
  reports: 'reports'
};

const MODULE_DEPENDENCIES = {
  leave: ['hr'],
  backgroundVerification: ['hr'],
  documentManagement: ['hr'],
  employeePortal: ['hr']
};

function toSafeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function toSafeName(value = '') {
  return String(value).trim();
}

function sanitizePhone(value = '') {
  return String(value).replace(/[^\d+]/g, '').trim();
}

function resolveModulesFromEnabled(enabledModules = {}) {
  return Object.entries(MODULE_LABEL_BY_CODE)
    .filter(([key]) => enabledModules?.[key] === true)
    .map(([, label]) => label);
}

function normalizeModuleCode(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (MODULE_LABEL_BY_CODE[raw]) return raw;
  if (MODULE_LABEL_BY_CODE[lower]) return lower;
  return MODULE_CODE_BY_LABEL[lower] || null;
}

function normalizeModuleArray(modules = []) {
  if (!Array.isArray(modules)) return [];
  const unique = new Set();
  modules.forEach((m) => {
    const code = normalizeModuleCode(m);
    if (code) unique.add(code);
  });
  return Array.from(unique);
}

function applyModuleDependencies(codes = []) {
  const set = new Set(codes);
  let changed = true;

  while (changed) {
    changed = false;
    Object.entries(MODULE_DEPENDENCIES).forEach(([module, deps]) => {
      if (set.has(module)) {
        deps.forEach((dep) => {
          if (!set.has(dep)) {
            set.add(dep);
            changed = true;
          }
        });
      }
    });
  }

  return Array.from(set);
}

function moduleCodesToLabels(codes = []) {
  return codes
    .map((code) => MODULE_LABEL_BY_CODE[code] || code)
    .filter(Boolean);
}

function buildEnabledModulesObject(codes = []) {
  const out = Object.keys(MODULE_LABEL_BY_CODE).reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
  codes.forEach((code) => {
    if (Object.prototype.hasOwnProperty.call(out, code)) out[code] = true;
  });
  return out;
}

async function getParentCompany(companyId) {
  return Tenant.findById(companyId).lean();
}

function getNormalizedParentModuleCodes(parent = {}) {
  return normalizeModuleArray(
    Array.isArray(parent.modules) && parent.modules.length > 0
      ? parent.modules
      : resolveModulesFromEnabled(parent.enabledModules || {})
  );
}

exports.getMyCompanyDetails = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const company = await getParentCompany(companyId);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const created = await Tenant.countDocuments({
      parentCompanyId: companyId,
      status: { $ne: 'deleted' }
    });

    const limit = Number(company.subCompanyLimit || 0);
    const remaining = 999;

    return res.json({
      success: true,
      company: {
        _id: company._id,
        name: company.companyName || company.name || '',
        adminEmail: company.adminEmail || company.companyEmail || '',
        subCompanyLimit: limit
      },
      stats: { limit, created, remaining }
    });
  } catch (error) {
    console.error('getMyCompanyDetails error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company details',
      error: error.message
    });
  }
};

exports.getParentCompanyModules = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const company = await getParentCompany(companyId);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const parentModules = Array.isArray(company.modules) && company.modules.length > 0
      ? moduleCodesToLabels(normalizeModuleArray(company.modules))
      : resolveModulesFromEnabled(company.enabledModules || {});

    return res.json({
      success: true,
      modules: parentModules
    });
  } catch (error) {
    console.error('getParentCompanyModules error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company modules',
      error: error.message
    });
  }
};

exports.getSubCompanyList = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const parent = await getParentCompany(companyId);

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const items = await Tenant.find({
      parentCompanyId: companyId,
      status: { $ne: 'deleted' }
    })
      .select('companyName companyEmail adminEmail ownerName adminName code createdAt status subCompanyLimit modules phone address')
      .sort({ createdAt: -1 })
      .lean();

    const limit = Number(parent.subCompanyLimit || 0);
    const created = items.length;
    const remaining = 999;

    return res.json({
      success: true,
      items,
      stats: { limit, created, remaining }
    });
  } catch (error) {
    console.error('getSubCompanyList error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-companies',
      error: error.message
    });
  }
};

exports.getSubCompanyById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const item = await Tenant.findOne({
      _id: id,
      parentCompanyId: companyId,
      status: { $ne: 'deleted' }
    })
      .select('companyName companyEmail adminEmail ownerName adminName code createdAt status subCompanyLimit modules phone address logo')
      .lean();

    if (!item) {
      return res.status(404).json({ success: false, message: 'Sub-company not found' });
    }

    return res.json({ success: true, item });
  } catch (error) {
    console.error('getSubCompanyById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-company',
      error: error.message
    });
  }
};

exports.updateSubCompany = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { name, adminName, adminEmail, phone, address, logo, modules } = req.body;

    const parent = await getParentCompany(companyId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const subCompany = await Tenant.findOne({
      _id: id,
      parentCompanyId: companyId,
      status: { $ne: 'deleted' }
    });

    if (!subCompany) {
      return res.status(404).json({ success: false, message: 'Sub-company not found' });
    }

    const finalName = name !== undefined ? toSafeName(name) : subCompany.companyName;
    const finalAdminName = adminName !== undefined ? toSafeName(adminName) : (subCompany.adminName || subCompany.ownerName);
    const finalEmail = adminEmail !== undefined ? toSafeEmail(adminEmail) : (subCompany.adminEmail || subCompany.companyEmail);
    const finalPhone = phone !== undefined ? sanitizePhone(phone) : subCompany.phone;
    const finalAddress = address !== undefined ? toSafeName(address) : subCompany.address;
    const finalLogo = logo !== undefined ? (String(logo || '').trim() || null) : subCompany.logo;

    if (!finalName || !finalAdminName || !finalEmail) {
      return res.status(400).json({
        success: false,
        message: 'name, adminName and adminEmail are required'
      });
    }

    if (!EMAIL_REGEX.test(finalEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const duplicateEmail = await Tenant.findOne({
      _id: { $ne: subCompany._id },
      $or: [{ companyEmail: finalEmail }, { adminEmail: finalEmail }]
    }).lean();
    if (duplicateEmail) {
      return res.status(400).json({
        success: false,
        message: 'Company with this email already exists'
      });
    }

    const parentModuleCodes = getNormalizedParentModuleCodes(parent);
    const requestedModuleCodesRaw = normalizeModuleArray(modules);
    const requestedModuleCodes = requestedModuleCodesRaw.length > 0
      ? requestedModuleCodesRaw
      : normalizeModuleArray(subCompany.modules || []);

    const invalidModule = requestedModuleCodes.find((moduleCode) => !parentModuleCodes.includes(moduleCode));
    if (invalidModule) {
      return res.status(400).json({
        success: false,
        message: `Invalid module selection: ${invalidModule}. You can assign only parent company modules.`
      });
    }

    const finalModuleCodes = applyModuleDependencies(requestedModuleCodes);
    const finalModules = moduleCodesToLabels(finalModuleCodes);
    const finalEnabledModules = buildEnabledModulesObject(finalModuleCodes);

    subCompany.companyName = finalName;
    subCompany.name = finalName;
    subCompany.adminName = finalAdminName;
    subCompany.ownerName = finalAdminName;
    subCompany.companyEmail = finalEmail;
    subCompany.adminEmail = finalEmail;
    subCompany.phone = finalPhone || undefined;
    subCompany.address = finalAddress || undefined;
    subCompany.logo = finalLogo;
    subCompany.modules = finalModules;
    subCompany.enabledModules = finalEnabledModules;
    await subCompany.save();

    const User = mongoose.model('User');
    await User.updateOne(
      { _id: subCompany.adminUser || null },
      { $set: { name: finalAdminName, email: finalEmail } }
    );

    return res.json({
      success: true,
      message: 'Sub-company updated successfully',
      item: {
        _id: subCompany._id,
        companyName: subCompany.companyName,
        adminEmail: subCompany.adminEmail,
        code: subCompany.code,
        status: subCompany.status,
        modules: subCompany.modules
      }
    });
  } catch (error) {
    console.error('updateSubCompany error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update sub-company',
      error: error.message
    });
  }
};

exports.toggleSubCompanyStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { status } = req.body;
    const finalStatus = String(status || '').trim().toLowerCase();

    if (!['active', 'inactive'].includes(finalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status must be active or inactive'
      });
    }

    const updated = await Tenant.findOneAndUpdate(
      {
        _id: id,
        parentCompanyId: companyId,
        status: { $ne: 'deleted' }
      },
      { $set: { status: finalStatus } },
      { new: true }
    )
      .select('companyName adminEmail code status modules')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Sub-company not found' });
    }

    return res.json({
      success: true,
      message: `Sub-company marked ${finalStatus}`,
      item: updated
    });
  } catch (error) {
    console.error('toggleSubCompanyStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update sub-company status',
      error: error.message
    });
  }
};

exports.createSubCompany = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, adminName, adminEmail, password, subCompanyLimit, phone, address, logo, modules } = req.body;

    const finalName = toSafeName(name);
    const finalAdminName = toSafeName(adminName);
    const finalEmail = toSafeEmail(adminEmail);
    const finalPassword = String(password || '');
    const finalPhone = sanitizePhone(phone || '');
    const finalAddress = toSafeName(address || '');
    const finalLogo = String(logo || '').trim() || null;
    const childLimit = Number.isInteger(Number(subCompanyLimit)) && Number(subCompanyLimit) >= 0
      ? Number(subCompanyLimit)
      : 0;

    if (!finalName || !finalAdminName || !finalEmail || !finalPassword) {
      return res.status(400).json({
        success: false,
        message: 'name, adminName, adminEmail and password are required'
      });
    }

    if (!EMAIL_REGEX.test(finalEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (finalPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const parent = await getParentCompany(companyId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const createdCount = await Tenant.countDocuments({
      parentCompanyId: companyId,
      status: { $ne: 'deleted' }
    });

    const parentLimit = Number(parent.subCompanyLimit || 0);

    const parentModuleCodes = getNormalizedParentModuleCodes(parent);
    const requestedModuleCodesRaw = normalizeModuleArray(modules);
    const requestedModuleCodes = requestedModuleCodesRaw.length > 0
      ? requestedModuleCodesRaw
      : parentModuleCodes;

    const invalidModule = requestedModuleCodes.find((moduleCode) => !parentModuleCodes.includes(moduleCode));
    if (invalidModule) {
      return res.status(400).json({
        success: false,
        message: `Invalid module selection: ${invalidModule}. You can assign only parent company modules.`
      });
    }

    const finalModuleCodes = applyModuleDependencies(requestedModuleCodes);
    const finalModules = moduleCodesToLabels(finalModuleCodes);
    const finalEnabledModules = buildEnabledModulesObject(finalModuleCodes);

    const duplicateEmail = await Tenant.findOne({
      $or: [{ companyEmail: finalEmail }, { adminEmail: finalEmail }]
    }).lean();
    if (duplicateEmail) {
      return res.status(400).json({
        success: false,
        message: 'Company with this email already exists'
      });
    }

    const User = mongoose.model('User');
    const existingUser = await User.findOne({ email: finalEmail }).lean();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    let finalCode;
    const rawPrefixSource = (parent.code || finalName || 'CMP').replace(/[^a-zA-Z0-9]/g, '');
    const prefix = (rawPrefixSource.substring(0, 3) || 'CMP').toUpperCase();
    const existingCodes = await Tenant.find({ code: new RegExp(`^${prefix}\\d{3}$`, 'i') }).select('code');
    let maxSeq = 0;
    for (const row of existingCodes) {
      const seq = parseInt(String(row.code || '').substring(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    finalCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;

    const subCompany = await Tenant.create({
      companyName: finalName,
      name: finalName,
      ownerName: finalAdminName,
      adminName: finalAdminName,
      companyEmail: finalEmail,
      adminEmail: finalEmail,
      password: hashedPassword,
      phone: finalPhone || undefined,
      address: finalAddress || undefined,
      logo: finalLogo,
      parentCompanyId: companyId,
      groupId: parent.groupId || null,
      subCompanyLimit: childLimit,
      tenantId: `tenant_${crypto.randomUUID()}`,
      apiKey: `key_${crypto.randomUUID()}`,
      code: finalCode,
      enabledModules: finalEnabledModules,
      modules: finalModules,
      status: 'active',
      isVerified: true
    });

    // Auto-create sub-company admin login user
    const adminUser = new User({
      name: finalAdminName,
      email: finalEmail,
      password: hashedPassword,
      role: 'company_admin',
      tenant: subCompany._id,
      mainCompanyId: subCompany._id,
      groupId: subCompany.groupId || null,
      companyId: subCompany._id
    });
    await adminUser.save();

    await Tenant.findByIdAndUpdate(subCompany._id, { $set: { adminUser: adminUser._id } });

    return res.status(201).json({
      success: true,
      message: 'Sub-company created successfully',
      data: {
        _id: subCompany._id,
        name: subCompany.companyName,
        adminName: subCompany.adminName,
        adminEmail: subCompany.adminEmail,
        code: subCompany.code,
        adminUserId: adminUser._id,
        parentCompanyId: subCompany.parentCompanyId
      }
    });
  } catch (error) {
    console.error('createSubCompany error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create sub-company',
      error: error.message
    });
  }
};
