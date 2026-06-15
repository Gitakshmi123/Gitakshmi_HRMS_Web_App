const mongoose = require('mongoose');
const { sanitizeOnboarding, sanitizeEmployee, sanitizeData } = require('../utils/apiSanitizer');
const fs = require('fs/promises');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const getTenantDB = require('../utils/tenantDB');
const companyIdConfig = require('./companyIdConfig.controller');
const { sendMail } = require('../utils/emailService');
const SalaryEngine = require('../services/salaryEngine');
const { syncToTracker } = require('../utils/trackerSync');
const {
  getModels,
  normalizeRole,
  resolveActorUser,
  createInAppNotification,
  createAuditLog,
  refreshInstanceMetrics,
  appendActivity,
  activatePendingTasks,
  createTasksFromTemplate,
} = require('../services/onboarding.service');

const ONBOARDING_TOKEN_SCOPE = 'employee_onboarding';
const ONBOARDING_TOKEN_TTL = process.env.ONBOARDING_TOKEN_TTL || '7d';
const ONBOARDING_TOKEN_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ONBOARDING_STATUSES = Object.freeze([
  'not_started',
  'invited',
  'in_progress',
  'form_submitted',
  'docs_pending',
  'verification',
  'verified',
  'completed',
  'blocked',
  'cancelled',
]);

function ensureTenant(req, res) {
  const tenantId = req.tenantId || req.user?.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_required' });
    return null;
  }
  return tenantId;
}

function canWorkTask(role, taskRole) {
  const normalized = normalizeRole(role);
  if (['psa', 'super_admin', 'company_admin', 'hr'].includes(normalized)) return true;
  return normalized === normalizeRole(taskRole);
}

function getTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getClientBaseUrl(req) {
  // 1. Try to use the dynamic Origin or Referer from the request first.
  // This ensures links work correctly in local dev, staging, and production
  // without needing to constantly change .env files.
  const originHeader = req?.headers?.origin;
  if (originHeader && !originHeader.includes('null')) {
    return String(originHeader).replace(/\/+$/, '');
  }

  const refererHeader = req?.headers?.referer;
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin.replace(/\/+$/, '');
    } catch (_error) {}
  }

  // 2. Fallback to configured environment variables (good for emails)
  const envBaseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
  if (envBaseUrl) {
    return String(envBaseUrl).replace(/\/+$/, '');
  }


  const host =
    (typeof req?.get === 'function' ? req.get('host') : null) ||
    req?.headers?.['x-forwarded-host'] ||
    req?.headers?.host;

  const protocol =
    req?.protocol ||
    (typeof req?.get === 'function' ? req.get('x-forwarded-proto') : null) ||
    req?.headers?.['x-forwarded-proto'] ||
    (host && /localhost|127\.0\.0\.1/i.test(String(host)) ? 'http' : 'https');

  if (host) {
    return `${String(protocol).split(',')[0]}://${host}`.replace(/\/+$/, '');
  }

  return 'http://localhost:5176';
}

const EmailService = require('../services/email.service');

async function sendEmailSafe({ to, subject, html, text }) {
  if (!to) return null;
  try {
    return await EmailService.sendEmail(to, subject, html || text);
  } catch (error) {
    console.warn('[onboarding] email skipped:', error.message);
    return null;
  }
}

function splitName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
  };
}

function mergeUniqueSteps(existing = [], next = []) {
  return Array.from(new Set([...(existing || []), ...(next || [])].filter(Boolean)));
}

function isValidOnboardingStatus(status) {
  return ONBOARDING_STATUSES.includes(status);
}

function setWorkflowStatus(instance, status) {
  if (!isValidOnboardingStatus(status)) {
    const err = new Error('invalid_onboarding_status');
    err.status = 400;
    throw err;
  }
  instance.status = status;
  if (status === 'completed') instance.completedAt = instance.completedAt || new Date();
  return instance;
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

async function storeOnboardingFile({ file, instance }) {
  const destination = String(file.destination || '').replace(/\\/g, '/');
  const bucket = destination.includes('/incoming') ? 'incoming' : String(instance.tenant);
  const localPath = `/uploads/onboarding/${bucket}/${file.filename}`;
  if (!hasCloudinaryConfig()) {
    return {
      storageProvider: 'local',
      path: localPath,
      secureUrl: localPath,
      storageKey: file.filename,
    };
  }

  try {
    if (!process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: `hrms/${instance.tenant}/onboarding/${instance._id}`,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });
    await fs.unlink(file.path).catch(() => null);
    return {
      storageProvider: 'cloudinary',
      path: result.secure_url,
      secureUrl: result.secure_url,
      storageKey: result.public_id,
    };
  } catch (error) {
    console.warn('[onboarding document storage] Cloudinary upload failed, using local file:', error.message);
    return {
      storageProvider: 'local',
      path: localPath,
      secureUrl: localPath,
      storageKey: file.filename,
    };
  }
}

function onboardingDocumentUrl(document) {
  return document?.secureUrl || document?.path || '';
}

async function syncApprovedDocumentsToEmployee({ models, instance, employee }) {
  const approvedDocuments = await models.OnboardingDocument.find({
    tenant: instance.tenant,
    onboardingInstance: instance._id,
    employee: employee._id,
    status: 'approved',
  }).sort({ type: 1, version: -1 }).lean();

  if (approvedDocuments.length === 0) return [];

  const latestByType = approvedDocuments.reduce((acc, document) => {
    const type = String(document.type || '').toUpperCase();
    if (!acc[type]) acc[type] = document;
    return acc;
  }, {});

  employee.documents = { ...(employee.documents || {}) };
  employee.bankDetails = { ...(employee.bankDetails || {}) };
  employee.education = { ...(employee.education || {}) };

  if (latestByType.AADHAAR) employee.documents.aadharFront = onboardingDocumentUrl(latestByType.AADHAAR);
  if (latestByType.PAN) employee.documents.panCard = onboardingDocumentUrl(latestByType.PAN);
  if (latestByType.BANK_PROOF) employee.bankDetails.bankProofUrl = onboardingDocumentUrl(latestByType.BANK_PROOF);
  if (latestByType.EDUCATION) employee.education.otherDegree = onboardingDocumentUrl(latestByType.EDUCATION);

  employee.meta = {
    ...(employee.meta || {}),
    onboardingDocuments: approvedDocuments.map((document) => ({
      id: document._id,
      type: document.type,
      label: document.label,
      url: onboardingDocumentUrl(document),
      storageProvider: document.storageProvider || 'local',
      verifiedAt: document.verifiedAt,
    })),
    onboardingDocumentsSyncedAt: new Date(),
  };
  await employee.save();
  return approvedDocuments;
}

async function markApplicantOnboardingComplete({ models, instance, employee, actor }) {
  if (!instance.applicant) return null;

  const applicant = await models.Applicant.findOne({ _id: instance.applicant, tenant: instance.tenant });
  if (!applicant) return null;

  applicant.employeeId = employee._id;
  applicant.isOnboarded = true;
  applicant.onboardingInstanceId = instance._id;
  applicant.onboardingStatus = 'completed';
  applicant.onboardingCompletedAt = new Date();
  if (!/hired|onboard/i.test(String(applicant.status || ''))) applicant.status = 'Hired';
  applicant.timeline = [
    ...(applicant.timeline || []),
    {
      status: 'Onboarded',
      message: `Employee onboarding completed for ${employee.employeeId || employee.email}`,
      updatedBy: actor?.name || 'HR',
      timestamp: new Date(),
    },
  ];
  await applicant.save();

  // Sync with Candidate Tracker
  try {
    const db = await getTenantDB(instance.tenant);
    const pseudoReq = { tenantDB: db, tenantId: instance.tenant };
    await syncToTracker(pseudoReq, {
      applicant,
      status: applicant.status, // Should be 'Hired'
      stage: 'Onboarding',
      remarks: `Onboarding completed for employee ${employee.employeeId || employee.email}`,
      actionBy: actor?.name || 'System'
    });
  } catch (syncErr) {
    console.warn('[onboarding markComplete] syncToTracker skipped:', syncErr.message);
  }

  return applicant;
}

function normalizeSalaryComponent(component) {
  return {
    name: component.name,
    monthlyAmount: Number(component.monthlyAmount || 0),
    annualAmount: Number(component.annualAmount || component.yearlyAmount || 0),
    componentCode: component.componentCode || component.code || '',
  };
}

async function configurePayrollFromOnboarding({ req, models, tenantId, employee, instance, actor }) {
  const applicant = instance.applicant
    ? await models.Applicant.findOne({ _id: instance.applicant, tenant: tenantId }).select('salaryTemplateId salarySnapshotId salarySnapshot').lean()
    : null;
  const salaryTemplateId = instance.payrollSetup?.salaryTemplateId || employee.salaryTemplateId || applicant?.salaryTemplateId || null;
  if (!salaryTemplateId) return { status: 'not_configured' };

  const salaryTemplate = await models.SalaryTemplate.findOne({
    _id: salaryTemplateId,
    tenantId,
    isActive: { $ne: false },
  }).lean();
  if (!salaryTemplate) return { status: 'not_configured', reason: 'salary_template_not_found' };

  const effectiveFrom = new Date(instance.payrollSetup?.effectiveFrom || employee.joiningDate || new Date());
  let snapshot = null;
  const existingSnapshotId = instance.payrollSetup?.salarySnapshotId || applicant?.salarySnapshotId || employee.currentSalarySnapshotId || employee.currentSnapshotId;
  if (existingSnapshotId) {
    snapshot = await models.EmployeeSalarySnapshot.findById(existingSnapshotId).catch(() => null);
    if (snapshot && !snapshot.employee) {
      snapshot.employee = employee._id;
      await snapshot.save();
    }
  }

  const ctcAnnual = Number(instance.payrollSetup?.ctcAnnual || snapshot?.ctc || applicant?.salarySnapshot?.ctcYearly || salaryTemplate.annualCTC || 0);
  if (ctcAnnual <= 0) return { status: 'not_configured', reason: 'ctc_required' };

  if (!snapshot && req.tenantDB) {
    snapshot = await SalaryEngine.generateSnapshot({
      tenantDB: req.tenantDB,
      employeeId: employee._id,
      tenantId,
      annualCTC: ctcAnnual,
      template: salaryTemplate,
      effectiveDate: effectiveFrom,
    });
    snapshot.reason = 'JOINING';
    snapshot.createdBy = actor.id || undefined;
    snapshot.locked = true;
    snapshot.lockedAt = new Date();
    await snapshot.save();
  }

  const earnings = (snapshot?.earnings?.length ? snapshot.earnings : salaryTemplate.earnings || []).map(normalizeSalaryComponent);
  const deductions = (snapshot?.employeeDeductions?.length ? snapshot.employeeDeductions : salaryTemplate.employeeDeductions || []).map(normalizeSalaryComponent);
  const benefits = (snapshot?.benefits?.length ? snapshot.benefits : salaryTemplate.employerDeductions || []).map(normalizeSalaryComponent);
  const monthlyCTC = Number(snapshot?.monthlyCTC || salaryTemplate.monthlyCTC || Math.round(ctcAnnual / 12));
  const netSalaryMonthly = Number(
    snapshot?.summary?.netPay ||
    snapshot?.breakdown?.netPay ||
    Math.max(0, earnings.reduce((sum, item) => sum + item.monthlyAmount, 0) - deductions.reduce((sum, item) => sum + item.monthlyAmount, 0)) ||
    monthlyCTC
  );

  let assignment = null;
  if (instance.payrollSetup?.salaryAssignmentId) {
    assignment = await models.SalaryAssignment.findById(instance.payrollSetup.salaryAssignmentId).catch(() => null);
  }

  if (!assignment) {
    await models.SalaryAssignment.updateMany(
      { tenantId, employeeId: employee._id, isCurrent: true },
      { $set: { isCurrent: false, effectiveTo: effectiveFrom } }
    ).catch(() => null);

    assignment = await models.SalaryAssignment.create({
      tenantId,
      employeeId: employee._id,
      salaryTemplateId,
      ctcAnnual,
      monthlyCTC,
      earnings,
      deductions,
      benefits,
      netSalaryMonthly,
      effectiveFrom,
      isConfirmed: true,
      isCurrent: true,
      assignedBy: actor.id,
    });
  } else {
    assignment.set({
      salaryTemplateId,
      ctcAnnual,
      monthlyCTC,
      earnings,
      deductions,
      benefits,
      netSalaryMonthly,
      effectiveFrom,
      isConfirmed: true,
      isCurrent: true,
      assignedBy: actor.id,
    });
    await assignment.save();
  }

  employee.salaryTemplateId = salaryTemplateId;
  employee.salaryAssigned = true;
  employee.salary = monthlyCTC;
  if (snapshot?._id) {
    const existingSnapshots = (employee.salarySnapshots || []).map((id) => String(id));
    if (!existingSnapshots.includes(String(snapshot._id))) employee.salarySnapshots = [...(employee.salarySnapshots || []), snapshot._id];
    employee.currentSalarySnapshotId = snapshot._id;
    employee.currentSnapshotId = snapshot._id;
  }
  await employee.save();

  return {
    status: 'configured',
    salaryTemplateId,
    ctcAnnual,
    monthlyCTC,
    salaryAssignmentId: assignment._id,
    salarySnapshotId: snapshot?._id || null,
  };
}

function onboardingFormSchema() {
  return {
    steps: [
      {
        key: 'personalInfo',
        title: 'Personal Info',
        fields: ['firstName', 'lastName', 'email', 'mobile', 'dob', 'gender', 'fatherName', 'emergencyContactName', 'emergencyContactNumber', 'currentAddress', 'permanentAddress'],
      },
      {
        key: 'jobDetails',
        title: 'Job Details',
        fields: ['designation', 'department', 'joiningDate', 'workLocation', 'employeeType', 'workMode'],
      },
      {
        key: 'documents',
        title: 'Documents Upload',
        requiredDocuments: [
          { type: 'AADHAAR', label: 'Aadhaar Card' },
          { type: 'PAN', label: 'PAN Card' },
          { type: 'BANK_PROOF', label: 'Cancelled Cheque / Passbook' },
          { type: 'EDUCATION', label: 'Highest Education Proof' },
        ],
      },
      {
        key: 'bankDetails',
        title: 'Bank Details',
        fields: ['bankName', 'accountNumber', 'ifsc', 'branchName'],
      },
      {
        key: 'policyAcceptance',
        title: 'Policy Acceptance',
        policies: [
          { key: 'nda', label: 'Non Disclosure Agreement' },
          { key: 'codeOfConduct', label: 'Code of Conduct' },
          { key: 'dataPrivacy', label: 'Data Privacy & IT Usage Policy' },
        ],
      },
    ],
  };
}

async function ensureDefaultTemplate({ models, tenantId, actorId }) {
  const code = 'ZOHO_STD_ONBOARDING';
  const name = 'Standard Employee Onboarding';

  const defaultData = {
    name,
    code,
    description: 'Production onboarding pipeline: invite, form, KYC, bank, policy, verification, role, asset, payroll, activation.',
    targetRoles: ['employee'],
    isGlobal: false,
    isActive: true,
    steps: [
      { title: 'Offer Acceptance', type: 'offer', order: 1, assignedRole: 'employee', dueInDays: 1, slaHours: 24, checklist: ['Accept digital offer'] },
      { title: 'Personal Information', type: 'form', order: 2, assignedRole: 'employee', dueInDays: 2, slaHours: 48, checklist: ['Fill personal profile', 'Confirm contact details'] },
      { title: 'KYC & Education Documents', type: 'document', order: 3, assignedRole: 'employee', dueInDays: 3, slaHours: 72, requiresDocument: true, documentType: 'KYC', checklist: ['Aadhaar', 'PAN', 'Bank proof', 'Education proof'] },
      { title: 'Bank & Payroll Details', type: 'form', order: 4, assignedRole: 'employee', dueInDays: 3, slaHours: 72, checklist: ['Bank account', 'IFSC', 'Branch'] },
      { title: 'Policy Acceptance', type: 'form', order: 5, assignedRole: 'employee', dueInDays: 4, slaHours: 96, checklist: ['NDA', 'Code of conduct', 'Data privacy'] },
      { title: 'HR Document Verification', type: 'approval', order: 6, assignedRole: 'hr', dueInDays: 5, slaHours: 24, checklist: ['Verify KYC', 'Verify bank', 'Verify education'] },
      { title: 'Role & Permission Assignment', type: 'setup', order: 7, assignedRole: 'hr', dueInDays: 5, slaHours: 24, checklist: ['Assign role', 'Apply RBAC permissions'] },
      { title: 'Asset Allocation', type: 'setup', order: 8, assignedRole: 'it', dueInDays: 6, slaHours: 48, checklist: ['Laptop', 'Email account', 'ID card'] },
      { title: 'Payroll Setup', type: 'setup', order: 9, assignedRole: 'hr', dueInDays: 6, slaHours: 48, checklist: ['Salary template', 'CTC', 'Effective date'] },
      { title: 'Final Activation', type: 'approval', order: 10, assignedRole: 'hr', dueInDays: 7, slaHours: 24, checklist: ['Activate employee account'] },
    ],
    meta: { systemDefault: true },
  };

  // 1. Try finding by code
  let template = await models.OnboardingTemplate.findOne({
    tenant: tenantId,
    code,
  });

  // 2. Fallback: try finding by name
  if (!template) {
    template = await models.OnboardingTemplate.findOne({
      tenant: tenantId,
      name,
    });
  }

  if (template) {
    let needsUpdate = false;
    if (!template.code) {
      template.code = code;
      needsUpdate = true;
    }
    if (!template.steps || template.steps.length === 0) {
      template.steps = defaultData.steps;
      needsUpdate = true;
    }
    if (needsUpdate) {
      await template.save();
    }
    return template.toObject();
  }

  // 3. Create if still not found
  template = await models.OnboardingTemplate.create({
    ...defaultData,
    tenant: tenantId,
    createdBy: actorId || null,
  });

  return template.toObject();
}

async function generateOnboardingToken({ instance, tenantId, employee, email }) {
  const secret = process.env.JWT_SECRET || 'hrms_secret_key_123';
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({
    scope: ONBOARDING_TOKEN_SCOPE,
    onboardingId: String(instance._id),
    tenantId: String(tenantId),
    employeeId: String(employee?._id || instance.employee),
    email,
    jti,
  }, secret, { expiresIn: ONBOARDING_TOKEN_TTL });

  const decoded = jwt.decode(token);
  instance.onboardingTokenHash = getTokenHash(token);
  instance.onboardingTokenExpiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null;
  instance.invitedAt = instance.invitedAt || new Date();
  await instance.save();
  return token;
}

async function resolvePublicOnboarding(token) {
  if (!token || !ONBOARDING_TOKEN_REGEX.test(String(token))) {
    const err = new Error('invalid_onboarding_token');
    err.status = 401;
    throw err;
  }

  const secret = process.env.JWT_SECRET || 'hrms_secret_key_123';
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (_err) {
    const err = new Error('onboarding_token_expired_or_invalid');
    err.status = 401;
    throw err;
  }

  if (decoded.scope !== ONBOARDING_TOKEN_SCOPE || !decoded.tenantId || !decoded.onboardingId) {
    const err = new Error('invalid_onboarding_scope');
    err.status = 401;
    throw err;
  }

  const tenantDB = await getTenantDB(decoded.tenantId);
  const pseudoReq = { tenantDB, tenantId: decoded.tenantId, user: { id: decoded.employeeId, role: 'employee', email: decoded.email } };
  const models = getModels(pseudoReq);
  const instance = await models.OnboardingInstance.findOne({
    _id: decoded.onboardingId,
    tenant: decoded.tenantId,
  });

  if (!instance) {
    const err = new Error('onboarding_invite_not_found');
    err.status = 404;
    throw err;
  }

  // Optional: Check hash if present to support revocation, but don't fail if it changed (due to re-generation)
  // unless we want strict single-session tokens.
  // if (instance.onboardingTokenHash && instance.onboardingTokenHash !== getTokenHash(token)) { ... }

  if (instance.onboardingTokenExpiresAt && instance.onboardingTokenExpiresAt < new Date()) {
    const err = new Error('onboarding_invite_expired');
    err.status = 401;
    throw err;
  }

  return { decoded, tenantDB, models, instance };
}

async function createOrResolveDraftEmployee({ models, tenantId, applicant, candidate, payload }) {
  const providedEmployeeId = payload.employeeId || applicant?.employeeId;
  if (providedEmployeeId && mongoose.Types.ObjectId.isValid(String(providedEmployeeId))) {
    const existing = await models.Employee.findOne({
      _id: providedEmployeeId,
      $or: [{ tenant: tenantId }, { mainCompanyId: tenantId }],
    });
    if (existing) {
      const gId = payload.gradeId || applicant?.gradeSnapshot?.id || applicant?.gradeId || applicant?.requirementId?.gradeId;
      if (gId) existing.gradeId = gId;
      const gName = payload.grade || applicant?.gradeSnapshot?.name || applicant?.requirementId?.grade;
      if (gName) existing.grade = gName;
      const bId = payload.bandId || applicant?.bandId || applicant?.requirementId?.bandId;
      if (bId) existing.bandId = bId;
      const bName = payload.band || applicant?.band || applicant?.requirementId?.band;
      if (bName) existing.band = bName;
      const lPolicy = payload.leavePolicy || applicant?.leavePolicy;
      if (lPolicy) existing.leavePolicy = lPolicy;

      if (existing.isModified()) await existing.save();

      if (applicant && String(applicant.employeeId || '') !== String(existing._id)) {
        applicant.employeeId = existing._id;
        await applicant.save();
      }
      return existing;
    }
  }

  const email = String(payload.email || applicant?.email || candidate?.email || '').trim().toLowerCase();
  if (!email) {
    const err = new Error('candidate_email_required');
    err.status = 400;
    throw err;
  }

  const existingByEmail = await models.Employee.findOne({
    email,
    $or: [{ tenant: tenantId }, { mainCompanyId: tenantId }],
  });
  if (existingByEmail) {
    const gId = payload.gradeId || applicant?.gradeSnapshot?.id || applicant?.gradeId || applicant?.requirementId?.gradeId;
    if (gId) existingByEmail.gradeId = gId;
    const gName = payload.grade || applicant?.gradeSnapshot?.name || applicant?.requirementId?.grade;
    if (gName) existingByEmail.grade = gName;
    const bId = payload.bandId || applicant?.bandId || applicant?.requirementId?.bandId;
    if (bId) existingByEmail.bandId = bId;
    const bName = payload.band || applicant?.band || applicant?.requirementId?.band;
    if (bName) existingByEmail.band = bName;
    const lPolicy = payload.leavePolicy || applicant?.leavePolicy;
    if (lPolicy) existingByEmail.leavePolicy = lPolicy;

    if (existingByEmail.isModified()) await existingByEmail.save();

    if (applicant && String(applicant.employeeId || '') !== String(existingByEmail._id)) {
      applicant.employeeId = existingByEmail._id;
      await applicant.save();
    }
    return existingByEmail;
  }

  const isIntern = payload.jobType && ['Intern', 'Internship'].includes(payload.jobType);
  const entityType = isIntern ? 'INTN' : 'EMPLOYEE';

  const generatedId = await companyIdConfig.generateIdInternal({
    tenantId,
    entityType: entityType,
    increment: true,
    extraReplacements: { DEPT: (payload.department || applicant?.department || 'GEN').substring(0, 3).toUpperCase() },
  }).then((result) => result?.id).catch(() => `${isIntern ? 'INTN' : 'EMP'}-${Date.now()}`);

  const tempPassword = applicant?.meta?.onboardingTempPassword || crypto.randomBytes(6).toString('base64url');
  const hashedPassword = applicant?.password || await bcrypt.hash(tempPassword, 10);

  const displayName = payload.name || applicant?.name || candidate?.name || email;
  const { firstName, lastName } = splitName(displayName);

  const employee = await models.Employee.create({
    mainCompanyId: mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(String(tenantId)) : tenantId,
    tenant: mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(String(tenantId)) : tenantId,
    employeeId: generatedId,
    firstName: payload.firstName || firstName,
    lastName: payload.lastName || lastName,
    email,
    contactNo: payload.mobile || applicant?.mobile || candidate?.mobile || '',
    department: payload.department || applicant?.department || applicant?.requirementId?.department || '',
    designation: payload.designation || applicant?.requirementId?.jobTitle || applicant?.currentDesignation || '',
    gradeId: payload.gradeId || applicant?.gradeSnapshot?.id || applicant?.gradeId || applicant?.requirementId?.gradeId || null,
    grade: payload.grade || applicant?.gradeSnapshot?.name || applicant?.requirementId?.grade || '',
    bandId: payload.bandId || applicant?.bandId || applicant?.requirementId?.bandId || null,
    band: payload.band || applicant?.band || applicant?.requirementId?.band || '',
    leavePolicy: payload.leavePolicy || applicant?.leavePolicy || null,
    joiningDate: payload.joiningDate || applicant?.joiningDate || new Date(),
    employeeType: isIntern ? 'Internship' : (payload.employeeType || 'Full-Time'),
    role: normalizeRole(payload.role || 'employee'),
    salaryTemplateId: payload.salaryTemplateId || applicant?.salaryTemplateId || null,
    status: 'Draft',
    isActive: false,
    password: hashedPassword,
    meta: {
      onboardingDraft: true,
      onboardingTempPassword: tempPassword,
      source: 'onboarding_invite',
      applicantId: applicant?._id || null,
      candidateId: candidate?._id || applicant?.candidateId || null,
      ...(applicant?.meta || {}),
    },
  });

  if (applicant && !applicant.employeeId) {
    applicant.employeeId = employee._id;
    await applicant.save();
  }

  return employee;
}

exports.autoStartOnboardingForApplicant = async ({
  req,
  applicant,
  actor = null,
  hrOwnerId = null,
  forceReinvite = false,
  ensurePortalLink = false,
  notifyCandidate = true,
  source = 'joining_letter_signed',
} = {}) => {
  const applicantId = applicant?._id || applicant;
  if (!applicantId) {
    const err = new Error('applicant_required');
    err.status = 400;
    throw err;
  }

  const tenantId = req?.tenantId || req?.user?.tenantId || req?.candidate?.tenantId || applicant?.tenant;
  if (!tenantId) {
    const err = new Error('tenant_required');
    err.status = 400;
    throw err;
  }

  const tenantDB = req?.tenantDB || await getTenantDB(tenantId);
  const automationReq = {
    ...req,
    tenantId,
    tenantDB,
    user: req?.user || {
      id: actor?.id || hrOwnerId || null,
      role: actor?.role || 'hr',
      tenantId,
      name: actor?.name || 'Hiring Automation',
      email: actor?.email || '',
    },
  };

  const models = getModels(automationReq);
  const now = new Date();
  let applicantDoc = applicant && typeof applicant.save === 'function'
    ? applicant
    : await models.Applicant.findOne({ _id: applicantId, tenant: tenantId });

  if (!applicantDoc) {
    const err = new Error('applicant_not_found');
    err.status = 404;
    throw err;
  }

  const [linkedInstance, linkedEmployee] = applicantDoc.onboardingInstanceId
    ? await Promise.all([
      models.OnboardingInstance.findOne({ _id: applicantDoc.onboardingInstanceId, tenant: tenantId }),
      applicantDoc.employeeId ? models.Employee.findById(applicantDoc.employeeId).catch(() => null) : Promise.resolve(null),
    ])
    : [null, null];

  if (applicantDoc.isOnboarded && linkedInstance && !ensurePortalLink && !forceReinvite) {
    return {
      success: true,
      created: false,
      invited: false,
      link: null,
      instance: linkedInstance,
      employee: linkedEmployee,
      applicant: applicantDoc,
    };
  }

  let requirement = null;
  if (applicantDoc.requirementId && mongoose.Types.ObjectId.isValid(String(applicantDoc.requirementId))) {
    try {
      if (!tenantDB.models.Requirement) {
        tenantDB.model('Requirement', require('../models/Requirement'));
      }
      const Requirement = tenantDB.model('Requirement');
      requirement = await Requirement.findById(applicantDoc.requirementId)
        .select('jobTitle department location createdBy')
        .lean();
    } catch (error) {
      console.warn('[onboarding auto-start] requirement lookup skipped:', error.message);
    }
  }

  const candidate = applicantDoc.candidateId
    ? await models.Candidate.findById(applicantDoc.candidateId).lean().catch(() => null)
    : null;

  const departmentName = typeof requirement?.department === 'object'
    ? requirement?.department?.name
    : requirement?.department;
  const designation = requirement?.jobTitle || applicantDoc.currentDesignation || '';
  const joiningDate = applicantDoc.joiningDate || now;
  const workLocation = applicantDoc.workLocation || applicantDoc.location || requirement?.location || '';
  const effectiveHrOwnerId = hrOwnerId || requirement?.createdBy || null;

  const employee = await createOrResolveDraftEmployee({
    models,
    tenantId,
    applicant: applicantDoc,
    candidate,
    payload: {
      applicantId: applicantDoc._id,
      name: applicantDoc.name,
      email: applicantDoc.email,
      mobile: applicantDoc.mobile,
      department: departmentName || applicantDoc.department || 'General',
      jobType: requirement?.jobType || applicantDoc.jobType || 'Full-Time',
      designation,
      joiningDate,
      role: 'employee',
      salaryTemplateId: applicantDoc.salaryTemplateId || null,
    },
  });

  const template = await ensureDefaultTemplate({
    models,
    tenantId,
    actorId: actor?.id || effectiveHrOwnerId || null,
  });

  let instance = linkedInstance || await models.OnboardingInstance.findOne({
    tenant: tenantId,
    $or: [
      { applicant: applicantDoc._id },
      { employee: employee._id },
    ],
    status: { $nin: ['completed', 'cancelled'] },
  }).sort({ createdAt: -1 });

  const created = !instance;
  if (!instance) {
    instance = await createTasksFromTemplate({
      req: automationReq,
      template,
      employee,
      hrOwner: effectiveHrOwnerId || actor?.id || null,
      managerOwner: employee.manager || null,
    });
    instance = await models.OnboardingInstance.findById(instance._id);
  }

  if (!instance) {
    const err = new Error('onboarding_instance_creation_failed');
    err.status = 500;
    throw err;
  }

  instance.candidate = candidate?._id || applicantDoc.candidateId || instance.candidate || null;
  instance.applicant = applicantDoc._id;
  instance.employee = employee._id;
  if (effectiveHrOwnerId && !instance.hrOwner) instance.hrOwner = effectiveHrOwnerId;
  instance.jobDetails = {
    ...(instance.jobDetails || {}),
    designation: instance.jobDetails?.designation || designation,
    department: instance.jobDetails?.department || departmentName || applicantDoc.department || '',
    joiningDate: instance.jobDetails?.joiningDate || joiningDate,
    workLocation: instance.jobDetails?.workLocation || workLocation,
  };
  instance.roleAssignment = {
    ...(instance.roleAssignment || {}),
    role: normalizeRole(instance.roleAssignment?.role || employee.role || 'employee'),
    roleId: instance.roleAssignment?.roleId || null,
    permissions: Array.isArray(instance.roleAssignment?.permissions) ? instance.roleAssignment.permissions : [],
  };
  instance.assetAllocation = {
    ...(instance.assetAllocation || {}),
    items: Array.isArray(instance.assetAllocation?.items) && instance.assetAllocation.items.length > 0
      ? instance.assetAllocation.items
      : [
        { name: 'Laptop', status: 'pending' },
        { name: 'Email Account', status: 'pending' },
        { name: 'ID Card', status: 'pending' },
      ],
  };
  instance.payrollSetup = {
    ...(instance.payrollSetup || {}),
    salaryTemplateId: instance.payrollSetup?.salaryTemplateId || employee.salaryTemplateId || applicantDoc.salaryTemplateId || null,
    salarySnapshotId: instance.payrollSetup?.salarySnapshotId || applicantDoc.salarySnapshotId || null,
    ctcAnnual: Number(instance.payrollSetup?.ctcAnnual || applicantDoc?.salarySnapshot?.ctcYearly || 0),
    effectiveFrom: instance.payrollSetup?.effectiveFrom || joiningDate,
    status: instance.payrollSetup?.status || 'pending',
  };
  instance.verification = {
    ...(instance.verification || {}),
    status: instance.verification?.status || 'pending',
    remarks: instance.verification?.remarks || '',
    rejectedFields: Array.isArray(instance.verification?.rejectedFields) ? instance.verification.rejectedFields : [],
  };
  instance.meta = {
    ...(instance.meta || {}),
    autoStartedFrom: source,
    autoStartedAt: instance.meta?.autoStartedAt || now,
    lastAutoInviteAt: instance.meta?.lastAutoInviteAt || null,
  };

  if (created || !instance.status || instance.status === 'not_started') {
    setWorkflowStatus(instance, 'invited');
  }

  const tokenIsValid = Boolean(
    instance.onboardingTokenHash &&
    instance.onboardingTokenExpiresAt &&
    instance.onboardingTokenExpiresAt > now
  );
  const shouldSendInvite = notifyCandidate && (forceReinvite || created || !instance.invitedAt || !tokenIsValid);
  const shouldGeneratePortalLink = shouldSendInvite || ensurePortalLink;

  let token = null;
  let link = null;
  if (shouldGeneratePortalLink) {
    token = await generateOnboardingToken({
      instance,
      tenantId,
      employee,
      email: employee.email,
    });
    link = `${getClientBaseUrl(automationReq)}/onboarding?token=${token}`;
    if (shouldSendInvite) {
      instance.meta.lastAutoInviteAt = now;
    }
  }

  await instance.save();

  applicantDoc.employeeId = employee._id;
  applicantDoc.onboardingInstanceId = instance._id;
  applicantDoc.onboardingStatus = instance.status;
  applicantDoc.onboardingStartedAt = applicantDoc.onboardingStartedAt || now;
  applicantDoc.onboardingAutoStarted = true;
  if (shouldSendInvite) applicantDoc.onboardingInvitedAt = now;

  const hasStartedEntry = Array.isArray(applicantDoc.timeline) &&
    applicantDoc.timeline.some((item) => String(item?.status || '').toLowerCase() === 'onboarding started');

  if (created && !hasStartedEntry) {
    applicantDoc.timeline = [
      ...(applicantDoc.timeline || []),
      {
        status: 'Onboarding Started',
        message: 'Onboarding started automatically after joining letter signing.',
        updatedBy: actor?.name || 'System',
        timestamp: now,
      },
    ];
  } else if (shouldSendInvite) {
    applicantDoc.timeline = [
      ...(applicantDoc.timeline || []),
      {
        status: 'Onboarding Invite Sent',
        message: 'Onboarding invite was sent automatically to the candidate.',
        updatedBy: actor?.name || 'System',
        timestamp: now,
      },
    ];
  }
  await applicantDoc.save();

  employee.meta = {
    ...(employee.meta || {}),
    onboardingDraft: employee.meta?.onboardingDraft !== false,
    onboardingInstanceId: instance._id,
    onboardingApplicantId: applicantDoc._id,
    onboardingStartedAt: employee.meta?.onboardingStartedAt || now,
    onboardingInviteSentAt: shouldSendInvite ? now : employee.meta?.onboardingInviteSentAt,
    onboardingAutoStartedFrom: source,
  };
  await employee.save();

  if (shouldSendInvite) {
    await appendActivity({
      models,
      instanceId: instance._id,
      actor: actor || { id: effectiveHrOwnerId || null, name: 'Hiring Automation', role: 'hr', email: '' },
      action: created ? 'AUTO_ONBOARDING_STARTED' : 'ONBOARDING_INVITE_SENT',
      message: created
        ? 'Joining letter signed. Onboarding started automatically and invite sent.'
        : 'Onboarding invite sent automatically.',
      meta: { source, applicantId: applicantDoc._id, employeeId: employee._id },
    });

    await createAuditLog({
      models,
      tenantId,
      entity: 'OnboardingInstance',
      entityId: instance._id,
      action: created ? 'ONBOARDING_AUTO_STARTED' : 'ONBOARDING_INVITE_SENT',
      performedBy: actor?.id || effectiveHrOwnerId || null,
      before: null,
      after: { status: instance.status, applicantId: applicantDoc._id, employeeId: employee._id },
      meta: { source },
    });

    await createInAppNotification({
      models,
      tenantId,
      receiverId: effectiveHrOwnerId || instance.hrOwner,
      receiverRole: 'hr',
      entityType: 'OnboardingInstance',
      entityId: instance._id,
      title: created ? 'Onboarding started automatically' : 'Onboarding invite sent',
      message: created
        ? `${applicantDoc.name} signed the joining letter. Onboarding invite was sent automatically.`
        : `${applicantDoc.name} received the onboarding invite again.`,
    });

    const tempPassword = employee.meta?.onboardingTempPassword;
    const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.email;
    const loginLink = `${getClientBaseUrl(automationReq)}/login`;

    await sendEmailSafe({
      to: employee.email,
      subject: 'Welcome to the Team - Complete Your Onboarding',
      text: `Hello ${employeeName},\n\nYour joining letter has been finalized! You can now login to the Employee Portal to complete your onboarding formalities.\n\nLogin Link: ${loginLink}\nUsername: ${employee.email}\nTemporary Password: ${tempPassword}\n\nPlease change your password after your first login.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4F46E5;">Welcome to the Team!</h2>
          <p>Hello <strong>${employeeName}</strong>,</p>
          <p>Your joining letter has been officially signed and sealed by HR. We are excited to have you onboard!</p>
          <p>Please login to the Employee Portal to fill out your onboarding details and upload required documents.</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Login Credentials:</p>
            <p style="margin: 5px 0; font-weight: bold;">Link: <a href="${loginLink}">${loginLink}</a></p>
            <p style="margin: 5px 0;">Username: ${employee.email}</p>
            <p style="margin: 5px 0;">Temporary Password: <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          <p style="font-size: 13px; color: #94a3b8;">* Please update your password immediately after logging in for the first time.</p>
        </div>
      `,
    });
  }

  return {
    success: true,
    created,
    invited: shouldSendInvite,
    link,
    instance,
    employee,
    applicant: applicantDoc,
  };
};

async function completeTaskByMatcher({ models, instanceId, matcher, payload = {} }) {
  const task = await models.OnboardingTask.findOne({
    onboardingInstance: instanceId,
    status: { $ne: 'completed' },
  }).sort({ stepOrder: 1 });

  const targetedTask = await models.OnboardingTask.findOne({
    onboardingInstance: instanceId,
    status: { $ne: 'completed' },
    ...matcher,
  }).sort({ stepOrder: 1 });

  const taskToUpdate = targetedTask || task;
  if (!taskToUpdate) return null;

  taskToUpdate.status = 'completed';
  taskToUpdate.completedAt = new Date();
  taskToUpdate.completionPayload = { ...(taskToUpdate.completionPayload || {}), ...payload };
  await taskToUpdate.save();
  return taskToUpdate;
}

function serializePortal({ instance, employee, documents }) {
  const plainInstance = typeof instance.toObject === 'function' ? instance.toObject() : { ...instance };
  const plainEmployee = employee && typeof employee.toObject === 'function' ? employee.toObject() : (employee ? { ...employee } : null);

  // Security: apply sanitizeOnboarding to strip tokenHash, tempPassword, __v etc.
  const safeInstance = sanitizeOnboarding(plainInstance);
  // Additionally strip token expiry from the instance object — it is surfaced in the token field below
  delete safeInstance.onboardingTokenExpiresAt;

  // Security: strip password, banking account numbers, internal meta from employee
  const safeEmployee = plainEmployee ? sanitizeEmployee(plainEmployee) : null;

  return {
    success: true,
    instance: safeInstance,
    employee: safeEmployee,
    documents: sanitizeData(documents),
    formSchema: onboardingFormSchema(),
    token: {
      expiresAt: plainInstance.onboardingTokenExpiresAt,
      status: plainInstance.status,
    },
  };
}

async function applyPortalPayload({ models, instance, payload }) {
  const employee = await models.Employee.findById(instance.employee);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.status = 404;
    throw err;
  }

  instance.personalDetails = { ...(instance.personalDetails || {}), ...(payload.personalInfo || {}) };
  instance.jobDetails = { ...(instance.jobDetails || {}), ...(payload.jobDetails || {}) };
  instance.bankDetails = { ...(instance.bankDetails || {}), ...(payload.bankDetails || {}) };
  instance.policyAcceptance = { ...(instance.policyAcceptance || {}), ...(payload.policyAcceptance || {}) };
  instance.stepsCompleted = mergeUniqueSteps(instance.stepsCompleted, payload.stepsCompleted || []);

  if (payload.personalInfo) {
    const info = payload.personalInfo;
    if (info.firstName !== undefined) employee.firstName = info.firstName;
    if (info.lastName !== undefined) employee.lastName = info.lastName;
    if (info.mobile !== undefined) employee.contactNo = info.mobile;
    if (info.dob !== undefined) employee.dob = info.dob || null;
    if (info.gender !== undefined) employee.gender = info.gender || undefined;
    if (info.fatherName !== undefined) employee.fatherName = info.fatherName;
    if (info.emergencyContactName !== undefined) employee.emergencyContactName = info.emergencyContactName;
    if (info.emergencyContactNumber !== undefined) employee.emergencyContactNumber = info.emergencyContactNumber;
    if (info.currentAddress !== undefined) employee.tempAddress = { ...(employee.tempAddress || {}), line1: info.currentAddress };
    if (info.permanentAddress !== undefined) employee.permAddress = { ...(employee.permAddress || {}), line1: info.permanentAddress };
  }
  if (payload.jobDetails) {
    if (payload.jobDetails.department !== undefined) employee.department = payload.jobDetails.department;
    if (payload.jobDetails.designation !== undefined) employee.designation = payload.jobDetails.designation;
    if (payload.jobDetails.joiningDate !== undefined) employee.joiningDate = payload.jobDetails.joiningDate || employee.joiningDate;
    if (payload.jobDetails.employeeType !== undefined) employee.employeeType = payload.jobDetails.employeeType;
    if (payload.jobDetails.workMode !== undefined) employee.workMode = payload.jobDetails.workMode;
  }
  if (payload.bankDetails) employee.bankDetails = { ...(employee.bankDetails || {}), ...payload.bankDetails };

  employee.meta = { ...(employee.meta || {}), onboardingProgressUpdatedAt: new Date() };
  await employee.save();
  await instance.save();
  return employee;
}

exports.getPublicPortal = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;
    const { models, instance } = await resolvePublicOnboarding(token);
    const [employee, documents] = await Promise.all([
      models.Employee.findById(instance.employee).select('-password').lean(),
      models.OnboardingDocument.find({ onboardingInstance: instance._id }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json(serializePortal({ instance, employee, documents }));
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.savePublicProgress = async (req, res) => {
  try {
    const { models, instance } = await resolvePublicOnboarding(req.body?.token);
    const payload = req.body?.payload || {};
    const employee = await applyPortalPayload({ models, instance, payload });
    if (['invited', 'not_started'].includes(instance.status)) {
      setWorkflowStatus(instance, 'in_progress');
      await instance.save();
    }

    const documents = await models.OnboardingDocument.find({ onboardingInstance: instance._id }).sort({ createdAt: -1 }).lean();
    res.json(serializePortal({ instance, employee, documents }));
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.submitPublicPortal = async (req, res) => {
  try {
    const token = req.body?.token;
    const payload = req.body?.payload ? JSON.parse(req.body.payload) : {};
    const documentTypes = req.body?.documentTypes ? JSON.parse(req.body.documentTypes) : [];
    const { models, instance, decoded } = await resolvePublicOnboarding(token);
    const actor = {
      id: instance.employee,
      name: decoded.email || 'Employee',
      role: 'employee',
      email: decoded.email,
    };

    const employee = await applyPortalPayload({ models, instance, payload });
    const files = Array.isArray(req.files) ? req.files : [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const docMeta = documentTypes[index] || {};
      const storedFile = await storeOnboardingFile({ file, instance });
      const latest = await models.OnboardingDocument.findOne({
        tenant: instance.tenant,
        onboardingInstance: instance._id,
        employee: instance.employee,
        type: docMeta.type || 'DOCUMENT',
      }).sort({ version: -1 }).lean();

      await models.OnboardingDocument.create({
        tenant: instance.tenant,
        company: instance.company,
        onboardingInstance: instance._id,
        employee: instance.employee,
        type: docMeta.type || 'DOCUMENT',
        label: docMeta.label || docMeta.type || 'Document',
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: storedFile.path,
        storageProvider: storedFile.storageProvider,
        storageKey: storedFile.storageKey,
        secureUrl: storedFile.secureUrl,
        status: latest ? 'resubmitted' : 'pending',
        uploadedByRole: 'employee',
        version: Number(latest?.version || 0) + 1,
      });
    }

    const completed = [];
    if (payload.personalInfo) completed.push('personalInfo');
    if (payload.jobDetails) completed.push('jobDetails');
    if (payload.bankDetails) completed.push('bankDetails');
    if (payload.policyAcceptance) completed.push('policyAcceptance');
    if (files.length > 0) completed.push('documents');
    instance.stepsCompleted = mergeUniqueSteps(instance.stepsCompleted, completed);
    instance.formSubmittedAt = new Date();
    instance.offerAcceptedAt = instance.offerAcceptedAt || new Date();
    setWorkflowStatus(instance, files.length > 0 ? 'verification' : 'docs_pending');
    instance.verification = { ...(instance.verification || {}), status: 'pending', remarks: '', rejectedFields: [] };

    await completeTaskByMatcher({ models, instanceId: instance._id, matcher: { type: 'offer' }, payload: { accepted: true } });
    await completeTaskByMatcher({ models, instanceId: instance._id, matcher: { type: 'form', title: /Personal/i }, payload: payload.personalInfo || {} });
    if (files.length > 0) await completeTaskByMatcher({ models, instanceId: instance._id, matcher: { type: 'document' }, payload: { documentsUploaded: files.length } });
    if (payload.bankDetails) await completeTaskByMatcher({ models, instanceId: instance._id, matcher: { type: 'form', title: /Bank/i }, payload: payload.bankDetails });
    if (payload.policyAcceptance) await completeTaskByMatcher({ models, instanceId: instance._id, matcher: { title: /Policy/i }, payload: payload.policyAcceptance });

    await appendActivity({
      models,
      instanceId: instance._id,
      actor,
      action: 'FORM_SUBMITTED',
      message: `${employee?.firstName || decoded.email || 'Employee'} submitted onboarding form`,
      meta: { documentsUploaded: files.length },
    });

    await createAuditLog({
      models,
      tenantId: instance.tenant,
      entity: 'OnboardingInstance',
      entityId: instance._id,
      action: 'ONBOARDING_FORM_SUBMITTED',
      performedBy: null,
      before: null,
      after: { status: instance.status, stepsCompleted: instance.stepsCompleted },
      meta: { employee: instance.employee },
    });

    await instance.save();
    // console.log(`[ONB_SUBMIT] Recalculating metrics for ${instance._id}`);
    await refreshInstanceMetrics({ models, instanceId: instance._id });
    
    // console.log(`[ONB_SUBMIT] Final status update for ${instance._id} -> verification`);
    setWorkflowStatus(instance, files.length > 0 ? 'verification' : 'docs_pending');
    await instance.save();

    const documents = await models.OnboardingDocument.find({ onboardingInstance: instance._id }).sort({ createdAt: -1 }).lean();
    // console.log(`[ONB_SUBMIT] SUCCESS for ${instance._id}. Document count: ${documents.length}`);
    res.json(serializePortal({ instance, employee, documents }));
  } catch (error) {
    console.error('[ONB_SUBMIT] CRITICAL_ERROR:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.inviteCandidate = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;

  try {
    const models = getModels(req);
    const actor = await resolveActorUser(req, models);
    const payload = req.body || {};
    let applicant = null;
    let candidate = null;

    if (payload.applicantId && mongoose.Types.ObjectId.isValid(String(payload.applicantId))) {
      applicant = await models.Applicant.findById(payload.applicantId).populate('requirementId', 'jobTitle department location jobType').exec();
    }

    if (!applicant && payload.candidateId && mongoose.Types.ObjectId.isValid(String(payload.candidateId))) {
      applicant = await models.Applicant.findOne({ candidateId: payload.candidateId }).sort({ updatedAt: -1 }).populate('requirementId', 'jobTitle department location jobType').exec();
    }

    const candidateId = payload.candidateId || applicant?.candidateId;
    if (candidateId && mongoose.Types.ObjectId.isValid(String(candidateId))) {
      candidate = await models.Candidate.findById(candidateId).lean();
    }

    const employee = await createOrResolveDraftEmployee({ models, tenantId, applicant, candidate, payload });
    const template = payload.templateId
      ? await models.OnboardingTemplate.findById(payload.templateId).lean()
      : await ensureDefaultTemplate({ models, tenantId, actorId: actor.id });

    if (!template) return res.status(404).json({ success: false, message: 'template_not_found' });

    let instance = await models.OnboardingInstance.findOne({
      tenant: tenantId,
      employee: employee._id,
      status: { $nin: ['completed', 'cancelled'] },
    });

    if (!instance) {
      instance = await createTasksFromTemplate({
        req,
        template,
        employee,
        hrOwner: actor.id,
        managerOwner: payload.managerOwner || employee.manager || null,
      });
      instance = await models.OnboardingInstance.findById(instance._id);
    }

    setWorkflowStatus(instance, 'invited');
    instance.candidate = candidate?._id || applicant?.candidateId || null;
    instance.applicant = applicant?._id || null;
    instance.hrOwner = actor.id || instance.hrOwner;
    instance.jobDetails = {
      ...(instance.jobDetails || {}),
      designation: payload.designation || applicant?.requirementId?.jobTitle || employee.designation || '',
      department: payload.department || applicant?.requirementId?.department || employee.department || '',
      joiningDate: payload.joiningDate || applicant?.joiningDate || employee.joiningDate || null,
      workLocation: payload.workLocation || applicant?.workLocation || applicant?.requirementId?.location || '',
    };
    instance.roleAssignment = {
      role: normalizeRole(payload.role || employee.role || 'employee'),
      permissions: payload.permissions || [],
      roleId: payload.roleId || null,
    };
    instance.assetAllocation = {
      items: payload.assets || [
        { name: 'Laptop', status: 'pending' },
        { name: 'Email Account', status: 'pending' },
        { name: 'ID Card', status: 'pending' },
      ],
    };
    instance.payrollSetup = {
      salaryTemplateId: payload.salaryTemplateId || employee.salaryTemplateId || applicant?.salaryTemplateId || null,
      salarySnapshotId: applicant?.salarySnapshotId || null,
      ctcAnnual: Number(payload.ctcAnnual || applicant?.salarySnapshot?.ctcYearly || 0),
      effectiveFrom: payload.effectiveFrom || payload.joiningDate || employee.joiningDate || new Date(),
      status: 'pending',
    };
    instance.verification = { ...(instance.verification || {}), status: 'pending' };

    const token = await generateOnboardingToken({
      instance,
      tenantId,
      employee,
      email: employee.email,
    });
    const link = `${getClientBaseUrl(req)}/onboarding?token=${token}`;

    await appendActivity({
      models,
      instanceId: instance._id,
      actor,
      action: 'INVITE_SENT',
      message: `${actor.name} invited ${employee.firstName || employee.email} to onboarding`,
      meta: { linkExpiresAt: instance.onboardingTokenExpiresAt },
    });

    await createAuditLog({
      models,
      tenantId,
      entity: 'OnboardingInstance',
      entityId: instance._id,
      action: 'ONBOARDING_INVITE_SENT',
      performedBy: actor.id,
      before: null,
      after: { employee: employee._id, status: instance.status },
      meta: { applicantId: applicant?._id || null, candidateId: candidate?._id || null },
    });

    await sendEmailSafe({
      to: employee.email,
      subject: 'Complete your employee onboarding',
      text: `Please complete your onboarding using this secure link: ${link}`,
      html: `<p>Hello ${employee.firstName || employee.email},</p><p>Your HR onboarding is ready.</p><p><a href="${link}">Open secure onboarding portal</a></p><p>This link expires on ${instance.onboardingTokenExpiresAt ? instance.onboardingTokenExpiresAt.toLocaleString() : 'the configured expiry date'}.</p>`,
    });

    res.status(201).json({ success: true, instance, employee: { ...employee.toObject(), password: undefined }, token, link });
  } catch (error) {
    console.error('[onboarding invite]', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getPipeline = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;

  const models = getModels(req);
  const instances = await models.OnboardingInstance.find({ tenant: tenantId })
    .sort({ updatedAt: -1 })
    .populate('employee', 'firstName lastName email employeeId department designation status isActive')
    .populate('candidate', 'name email mobile')
    .populate('applicant', 'name email mobile')
    .populate('template', 'name code')
    .lean();

  const columns = [
    { key: 'invited', label: 'Invited' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'docs_pending', label: 'Docs Pending' },
    { key: 'verification', label: 'Verification' },
    { key: 'completed', label: 'Completed' },
  ];

  const grouped = columns.reduce((acc, column) => ({ ...acc, [column.key]: [] }), {});
  for (const instance of instances) {
    const key = instance.status === 'form_submitted' || instance.status === 'verified' ? 'verification' : instance.status;
    if (grouped[key]) grouped[key].push(instance);
    else if (instance.status === 'blocked') grouped.docs_pending.push(instance);
    else grouped.in_progress.push(instance);
  }

  res.json({
    success: true,
    columns,
    grouped,
    instances,
    summary: {
      total: instances.length,
      invited: grouped.invited.length,
      inProgress: grouped.in_progress.length,
      docsPending: grouped.docs_pending.length,
      verification: grouped.verification.length,
      completed: grouped.completed.length,
    },
  });
};

exports.updatePipelineStatus = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const allowed = ONBOARDING_STATUSES;
  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({ success: false, message: 'invalid_onboarding_status' });
  }

  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const instance = await models.OnboardingInstance.findOne({ _id: req.params.id, tenant: tenantId });
  if (!instance) return res.status(404).json({ success: false, message: 'instance_not_found' });

  const before = { status: instance.status };
  setWorkflowStatus(instance, req.body.status);
  await instance.save();

  await appendActivity({
    models,
    instanceId: instance._id,
    actor,
    action: 'STATUS_CHANGED',
    message: `${actor.name} moved onboarding to ${instance.status}`,
    meta: { before: before.status, after: instance.status },
  });

  await createAuditLog({
    models,
    tenantId,
    entity: 'OnboardingInstance',
    entityId: instance._id,
    action: 'ONBOARDING_STATUS_CHANGED',
    performedBy: actor.id,
    before,
    after: { status: instance.status },
    meta: {},
  });

  res.json({ success: true, instance });
};

exports.verifyOnboarding = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;

  try {
    const models = getModels(req);
    const actor = await resolveActorUser(req, models);
    const { onboardingId, status, remarks, rejectedFields = [], documentIds = [] } = req.body || {};
    if (!onboardingId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'onboarding_status_required' });
    }

    const instance = await models.OnboardingInstance.findOne({ _id: onboardingId, tenant: tenantId });
    if (!instance) return res.status(404).json({ success: false, message: 'instance_not_found' });

    const docQuery = { onboardingInstance: instance._id, tenant: tenantId };
    if (documentIds.length) docQuery._id = { $in: documentIds };
    await models.OnboardingDocument.updateMany(docQuery, {
      $set: {
        status,
        rejectionReason: status === 'rejected' ? (remarks || 'Rejected by HR verification') : '',
        verifiedBy: actor.id,
        verifiedAt: new Date(),
      },
    });

    instance.verification = { status, remarks: remarks || '', rejectedFields };
    setWorkflowStatus(instance, status === 'approved' ? 'verified' : 'docs_pending');
    instance.verifiedBy = status === 'approved' ? actor.id : null;
    instance.verifiedAt = status === 'approved' ? new Date() : null;
    instance.stepsCompleted = status === 'approved'
      ? mergeUniqueSteps(instance.stepsCompleted, ['verification'])
      : instance.stepsCompleted;
    await instance.save();

    let syncedDocuments = [];
    if (status === 'approved') {
      const employee = await models.Employee.findById(instance.employee);
      if (employee) syncedDocuments = await syncApprovedDocumentsToEmployee({ models, instance, employee });
      
      // SYNC: Update OnboardingSubmission status so candidate portal knows it's verified
      if (employee?.email) {
        await models.OnboardingSubmission.updateMany(
          { tenant: tenantId, 'responses.value': employee.email.toLowerCase() },
          { $set: { status: 'VERIFICATION' } }
        );
      }
    }

    const verificationTask = await models.OnboardingTask.findOne({
      onboardingInstance: instance._id,
      assignedRole: 'hr',
      type: 'approval',
      title: /Verification/i,
    });
    if (verificationTask) {
      verificationTask.status = status === 'approved' ? 'completed' : 'rejected';
      verificationTask.notes = remarks || '';
      verificationTask.completedAt = status === 'approved' ? new Date() : null;
      await verificationTask.save();
    }

    await appendActivity({
      models,
      instanceId: instance._id,
      actor,
      action: 'HR_VERIFICATION',
      message: `${actor.name} ${status} onboarding verification`,
      meta: { remarks, rejectedFields, documentsSynced: syncedDocuments.length },
    });

    await createAuditLog({
      models,
      tenantId,
      entity: 'OnboardingInstance',
      entityId: instance._id,
      action: 'ONBOARDING_VERIFIED',
      performedBy: actor.id,
      before: null,
      after: { status: instance.status, verification: instance.verification },
      meta: {},
    });

    await refreshInstanceMetrics({ models, instanceId: instance._id });
    setWorkflowStatus(instance, status === 'approved' ? 'verified' : 'docs_pending');
    await instance.save();

    res.json({ success: true, instance });
  } catch (error) {
    console.error('[onboarding verify]', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.activateOnboarding = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;

  try {
    const models = getModels(req);
    const actor = await resolveActorUser(req, models);
    const { onboardingId, role, permissions, assets, payroll } = req.body || {};
    if (!onboardingId) return res.status(400).json({ success: false, message: 'onboarding_id_required' });

    const instance = await models.OnboardingInstance.findOne({ _id: onboardingId, tenant: tenantId });
    if (!instance) return res.status(404).json({ success: false, message: 'instance_not_found' });
    const canAutoApprove = ['verification', 'form_submitted', 'docs_pending'].includes(String(instance.status || '').toLowerCase());
    if (!['verified', 'completed'].includes(instance.status) && req.body?.force !== true && !canAutoApprove) {
      return res.status(400).json({ success: false, message: 'verify_before_activation' });
    }

    const employee = await models.Employee.findById(instance.employee);
    if (!employee) return res.status(404).json({ success: false, message: 'employee_not_found' });

    let autoVerifiedDocuments = 0;
    if (canAutoApprove && req.body?.skipAutoVerify !== true) {
      const docResult = await models.OnboardingDocument.updateMany(
        { onboardingInstance: instance._id, tenant: tenantId, status: { $in: ['pending', 'resubmitted'] } },
        {
          $set: {
            status: 'approved',
            verifiedBy: actor.id,
            verifiedAt: new Date(),
            rejectionReason: '',
          },
        }
      );
      autoVerifiedDocuments = docResult.modifiedCount || docResult.nModified || 0;
      instance.verification = {
        ...(instance.verification || {}),
        status: 'approved',
        remarks: req.body?.verificationRemarks || 'Auto-approved during activation',
        rejectedFields: [],
      };
      instance.verifiedBy = actor.id;
      instance.verifiedAt = new Date();
      instance.stepsCompleted = mergeUniqueSteps(instance.stepsCompleted, ['verification']);
      setWorkflowStatus(instance, 'verified');
      await instance.save();
    }

    const finalRole = normalizeRole(role || instance.roleAssignment?.role || employee.role || 'employee');
    employee.role = finalRole;
    employee.status = 'active';
    employee.isActive = true;
    employee.meta = {
      ...(employee.meta || {}),
      onboardingDraft: false,
      onboardingActivatedAt: new Date(),
      onboardingInstanceId: instance._id,
    };
    if (instance.personalDetails) {
      if (instance.personalDetails.firstName) employee.firstName = instance.personalDetails.firstName;
      if (instance.personalDetails.lastName) employee.lastName = instance.personalDetails.lastName;
      if (instance.personalDetails.mobile) employee.contactNo = instance.personalDetails.mobile;
      if (instance.personalDetails.fatherName) employee.fatherName = instance.personalDetails.fatherName;
      if (instance.personalDetails.motherName) employee.motherName = instance.personalDetails.motherName;
      if (instance.personalDetails.spouseDetails) employee.spouseDetails = instance.personalDetails.spouseDetails;
      if (instance.personalDetails.bloodGroup) employee.bloodGroup = instance.personalDetails.bloodGroup;
      if (instance.personalDetails.maritalStatus) employee.maritalStatus = instance.personalDetails.maritalStatus;
      if (instance.personalDetails.languages) employee.languages = instance.personalDetails.languages;
      if (instance.personalDetails.education) employee.education = instance.personalDetails.education;
      if (instance.personalDetails.emergencyContact) employee.emergencyContact = instance.personalDetails.emergencyContact;
      if (instance.personalDetails.panNumber) employee.panNumber = instance.personalDetails.panNumber;
      if (instance.personalDetails.aadhaarNumber) employee.aadhaarNumber = instance.personalDetails.aadhaarNumber;
    }
    if (instance.jobDetails) {
      if (instance.jobDetails.department) employee.department = instance.jobDetails.department;
      if (instance.jobDetails.designation) employee.designation = instance.jobDetails.designation;
      if (instance.jobDetails.joiningDate) employee.joiningDate = instance.jobDetails.joiningDate;
      if (instance.jobDetails.grade) employee.grade = instance.jobDetails.grade;
      if (instance.jobDetails.gradeId) employee.gradeId = instance.jobDetails.gradeId;
      if (instance.jobDetails.band) employee.band = instance.jobDetails.band;
      if (instance.jobDetails.bandId) employee.bandId = instance.jobDetails.bandId;
      if (instance.jobDetails.leavePolicy) employee.leavePolicy = instance.jobDetails.leavePolicy;
      if (instance.jobDetails.employeeType) employee.employeeType = instance.jobDetails.employeeType;
      if (instance.jobDetails.workMode) employee.workMode = instance.jobDetails.workMode;
    }

    if (!employee.gradeId || !employee.bandId || !employee.leavePolicy) {
      if (instance.applicant && mongoose.Types.ObjectId.isValid(String(instance.applicant))) {
        const applicantData = await models.Applicant.findById(instance.applicant).lean();
        if (applicantData) {
          if (!employee.gradeId && applicantData.gradeId) employee.gradeId = applicantData.gradeId;
          if (!employee.grade && applicantData.gradeSnapshot?.name) employee.grade = applicantData.gradeSnapshot.name;
          if (!employee.bandId && applicantData.bandId) employee.bandId = applicantData.bandId;
          if (!employee.band && applicantData.band) employee.band = applicantData.band;
          if (!employee.leavePolicy && applicantData.leavePolicy) employee.leavePolicy = applicantData.leavePolicy;
        }
      }
    }
    await employee.save();
    const syncedDocuments = await syncApprovedDocumentsToEmployee({ models, instance, employee });

    let resolvedPermissions = Array.isArray(permissions) ? permissions : [];
    if (resolvedPermissions.length === 0) {
      const roleDoc = await models.Role.findOne({ tenant: tenantId, name: new RegExp(`^${finalRole}$`, 'i'), isActive: { $ne: false } }).lean();
      resolvedPermissions = roleDoc?.permissions || [];
    }

    const oneTimePassword = employee.meta?.onboardingTempPassword || null;
    const defaultPassword = oneTimePassword || employee.employeeId || crypto.randomBytes(6).toString('base64url');
    const userPassword = employee.password || await bcrypt.hash(defaultPassword, 10);
    await models.User.findOneAndUpdate(
      { mainCompanyId: tenantId, email: employee.email },
      {
        $set: {
          name: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.email,
          email: employee.email,
          password: userPassword,
          role: finalRole,
          permissions: resolvedPermissions,
          tenant: tenantId,
          mainCompanyId: tenantId,
          companyId: tenantId,
          employeeCode: employee.employeeId || employee.employeeCode || '',
          isActive: true,
          permVersion: Date.now(),
          permUpdatedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    instance.roleAssignment = {
      ...(instance.roleAssignment || {}),
      role: finalRole,
      permissions: resolvedPermissions,
      assignedAt: new Date(),
      assignedBy: actor.id,
    };
    instance.assetAllocation = {
      ...(instance.assetAllocation || {}),
      items: assets || instance.assetAllocation?.items || [],
      status: 'allocated',
      allocatedAt: new Date(),
      allocatedBy: actor.id,
    };
    instance.payrollSetup = {
      ...(instance.payrollSetup || {}),
      ...(payroll || {}),
      status: 'pending',
    };

    const payrollResult = await configurePayrollFromOnboarding({ req, models, tenantId, employee, instance, actor })
      .catch((error) => {
        console.warn('[onboarding payroll setup]', error.message);
        return { status: 'failed', reason: error.message };
      });
    instance.payrollSetup = {
      ...(instance.payrollSetup || {}),
      ...payrollResult,
      configuredAt: payrollResult.status === 'configured' ? new Date() : instance.payrollSetup?.configuredAt,
      configuredBy: payrollResult.status === 'configured' ? actor.id : instance.payrollSetup?.configuredBy,
    };

    setWorkflowStatus(instance, 'completed');
    instance.progressPercent = 100;
    instance.activatedAt = new Date();
    instance.activationBy = actor.id;
    instance.stepsCompleted = mergeUniqueSteps(instance.stepsCompleted, ['roleAssignment', 'assetAllocation', 'payrollSetup', 'activation']);
    await instance.save();

    const applicant = await markApplicantOnboardingComplete({ models, instance, employee, actor });

    // SYNC: Update OnboardingSubmission status to COMPLETED
    if (employee?.email) {
      await models.OnboardingSubmission.updateMany(
        { tenant: tenantId, 'responses.value': employee.email.toLowerCase() },
        { $set: { status: 'COMPLETED' } }
      );
    }

    await models.OnboardingTask.updateMany({ onboardingInstance: instance._id, status: { $ne: 'completed' } }, {
      $set: { status: 'completed', completedAt: new Date() },
    });

    await appendActivity({
      models,
      instanceId: instance._id,
      actor,
      action: 'EMPLOYEE_ACTIVATED',
      message: `${actor.name} activated employee account`,
      meta: { employeeId: employee._id, role: finalRole, documentsSynced: syncedDocuments.length, autoVerifiedDocuments, payrollStatus: payrollResult.status },
    });

    await createAuditLog({
      models,
      tenantId,
      entity: 'OnboardingInstance',
      entityId: instance._id,
      action: 'ONBOARDING_ACTIVATED',
      performedBy: actor.id,
      before: null,
      after: { status: instance.status, employeeStatus: employee.status, role: finalRole },
      meta: { employeeId: employee._id, applicantId: applicant?._id || null, autoVerifiedDocuments, payrollStatus: payrollResult.status },
    });

    await sendEmailSafe({
      to: employee.email,
      subject: 'Your employee account is active',
      text: oneTimePassword
        ? `Your HRMS employee account is active. Employee ID: ${employee.employeeId}. One-time password: ${oneTimePassword}. Please change it after login.`
        : `Your HRMS employee account is active. Employee ID: ${employee.employeeId}. Please use your existing password or contact HR for a reset.`,
      html: oneTimePassword
        ? `<p>Hello ${employee.firstName || employee.email},</p><p>Your HRMS employee account is now active.</p><p><strong>Employee ID:</strong> ${employee.employeeId}</p><p><strong>One-time password:</strong> ${oneTimePassword}</p><p>Please change this password after login.</p>`
        : `<p>Hello ${employee.firstName || employee.email},</p><p>Your HRMS employee account is now active.</p><p><strong>Employee ID:</strong> ${employee.employeeId}</p><p>Please use your existing password or contact HR for a reset.</p>`,
    });

    if (oneTimePassword && employee.meta) {
      delete employee.meta.onboardingTempPassword;
      employee.markModified('meta');
      await employee.save();
    }

    res.json({ success: true, instance, employee: { ...employee.toObject(), password: undefined } });
  } catch (error) {
    console.error('[onboarding activate]', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.listTemplates = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const query = {
    isActive: true,
    $or: [{ tenant: tenantId }, { isGlobal: true }],
  };

  if (normalizeRole(req.user?.role) === 'psa' && req.query.scope === 'all') delete query.$or;

  const templates = await models.OnboardingTemplate.find(query).sort({ isGlobal: -1, updatedAt: -1 }).lean();
  res.json({ success: true, templates });
};

exports.createTemplate = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const role = normalizeRole(req.user?.role);
  const payload = req.body || {};
  const steps = Array.isArray(payload.steps) ? payload.steps : [];

  if (!payload.name || !payload.code || steps.length === 0) {
    return res.status(400).json({ success: false, message: 'name_code_steps_required' });
  }

  const template = await models.OnboardingTemplate.create({
    tenant: role === 'psa' && payload.isGlobal ? null : tenantId,
    name: payload.name,
    code: String(payload.code).trim().toUpperCase(),
    description: payload.description || '',
    targetRoles: payload.targetRoles || ['employee'],
    isGlobal: role === 'psa' && payload.isGlobal === true,
    isActive: payload.isActive !== false,
    createdBy: actor.id,
    version: 1,
    steps: steps.map((step, index) => ({
      title: step.title,
      description: step.description || '',
      type: step.type || 'form',
      order: Number(step.order || index + 1),
      assignedRole: normalizeRole(step.assignedRole || 'employee'),
      assignedUser: step.assignedUser || null,
      dueInDays: Number(step.dueInDays || 0),
      slaHours: Number(step.slaHours || 24),
      requiresDocument: step.requiresDocument === true,
      documentType: step.documentType || '',
      checklist: Array.isArray(step.checklist) ? step.checklist : [],
      instructions: step.instructions || '',
      isBlocking: step.isBlocking !== false,
    })),
    meta: payload.meta || {},
  });

  await createAuditLog({
    models,
    tenantId,
    entity: 'OnboardingTemplate',
    entityId: template._id,
    action: 'TEMPLATE_CREATED',
    performedBy: actor.id,
    before: null,
    after: { name: template.name, code: template.code },
    meta: { isGlobal: template.isGlobal },
  });

  res.status(201).json({ success: true, template });
};

exports.updateTemplate = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const template = await models.OnboardingTemplate.findById(req.params.id);

  if (!template) return res.status(404).json({ success: false, message: 'template_not_found' });
  if (!template.isGlobal && String(template.tenant) !== String(tenantId)) {
    return res.status(403).json({ success: false, message: 'forbidden_template_scope' });
  }

  const before = template.toObject();
  const payload = req.body || {};
  if (payload.name !== undefined) template.name = payload.name;
  if (payload.description !== undefined) template.description = payload.description;
  if (payload.targetRoles !== undefined) template.targetRoles = payload.targetRoles;
  if (payload.isActive !== undefined) template.isActive = payload.isActive === true;
  if (Array.isArray(payload.steps)) {
    template.steps = payload.steps.map((step, index) => ({
      title: step.title,
      description: step.description || '',
      type: step.type || 'form',
      order: Number(step.order || index + 1),
      assignedRole: normalizeRole(step.assignedRole || 'employee'),
      assignedUser: step.assignedUser || null,
      dueInDays: Number(step.dueInDays || 0),
      slaHours: Number(step.slaHours || 24),
      requiresDocument: step.requiresDocument === true,
      documentType: step.documentType || '',
      checklist: Array.isArray(step.checklist) ? step.checklist : [],
      instructions: step.instructions || '',
      isBlocking: step.isBlocking !== false,
    }));
  }
  template.version += 1;
  await template.save();

  await createAuditLog({
    models,
    tenantId,
    entity: 'OnboardingTemplate',
    entityId: template._id,
    action: 'TEMPLATE_UPDATED',
    performedBy: actor.id,
    before: { name: before.name, version: before.version },
    after: { name: template.name, version: template.version },
    meta: {},
  });

  res.json({ success: true, template });
};

exports.startOnboarding = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const { employeeId, templateId, managerOwner } = req.body || {};

  if (!employeeId || !templateId) {
    return res.status(400).json({ success: false, message: 'employee_template_required' });
  }

  const [employee, template] = await Promise.all([
    models.Employee.findById(employeeId).lean(),
    models.OnboardingTemplate.findById(templateId).lean(),
  ]);

  if (!employee) return res.status(404).json({ success: false, message: 'employee_not_found' });
  if (!template) return res.status(404).json({ success: false, message: 'template_not_found' });

  const existing = await models.OnboardingInstance.findOne({
    tenant: tenantId,
    employee: employeeId,
    status: { $in: ['not_started', 'in_progress', 'blocked'] },
  }).lean();

  if (existing) {
    return res.status(409).json({ success: false, message: 'active_onboarding_already_exists' });
  }

  const instance = await createTasksFromTemplate({
    req,
    template,
    employee,
    hrOwner: req.user?.id,
    managerOwner,
  });

  res.status(201).json({ success: true, instance });
};

exports.listInstances = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const role = normalizeRole(req.user?.role);
  const query = { tenant: tenantId };

  if (req.query.status) query.status = req.query.status;
  if (req.query.employeeId) query.employee = req.query.employeeId;
  if (role === 'employee' || role === 'manager') query.employee = req.user.id;

  const instances = await models.OnboardingInstance.find(query)
    .sort({ createdAt: -1 })
    .populate('template', 'name code')
    .populate('employee', 'firstName lastName email employeeId department designation')
    .lean();

  res.json({ success: true, instances });
};

exports.getInstanceDetail = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const instance = await models.OnboardingInstance.findOne({ _id: req.params.id, tenant: tenantId })
    .populate('template', 'name code description steps')
    .populate('employee', 'firstName lastName email employeeId department designation manager joiningDate grade gradeId band bandId leavePolicy fatherName motherName education languages spouseDetails bloodGroup maritalStatus emergencyContact panNumber aadhaarNumber status isActive')
    .populate('candidate', 'name email mobile')
    .populate('applicant', 'name email mobile')
    .lean();

  if (!instance) return res.status(404).json({ success: false, message: 'instance_not_found' });

  let [tasks, documents] = await Promise.all([
    models.OnboardingTask.find({ onboardingInstance: instance._id }).sort({ stepOrder: 1 }).lean(),
    models.OnboardingDocument.find({ onboardingInstance: instance._id }).sort({ createdAt: -1 }).lean(),
  ]);

  // AUTO-SYNC: If documents are missing but a dynamic submission exists, pull them in
  if (instance.status !== 'cancelled') {
    try {
      const employeeEmail = instance.employee?.email;
      if (employeeEmail) {
        // Find candidate by email first to be safe (since instance.candidate might be null)
        const candidate = await models.Candidate.findOne({ 
          tenant: tenantId, 
          email: employeeEmail.toLowerCase() 
        }).lean();

        if (candidate) {
          let submission = await models.OnboardingSubmission.findOne({ 
            tenant: tenantId, 
            candidateId: candidate._id,
            status: { $in: ['VERIFICATION', 'COMPLETED'] }
          }).lean();

          // Fallback: search by email if candidateId search failed (sometimes IDs get mismatched)
          if (!submission) {
            submission = await models.OnboardingSubmission.findOne({
              tenant: tenantId,
              'responses.value': employeeEmail.toLowerCase(),
              status: { $in: ['VERIFICATION', 'COMPLETED'] }
            }).lean();
          }

          if (submission) {
            let syncNeeded = false;

            // 1. Sync Documents if missing
            if (documents.length === 0 && submission.documents && submission.documents.length > 0) {
              const docsToCreate = submission.documents.map(d => ({
                tenant: tenantId,
                company: tenantId,
                onboardingInstance: instance._id,
                employee: instance.employee?._id || instance.employee,
                type: d.fieldId.toUpperCase().includes('AADHAAR') ? 'AADHAAR' : 
                      d.fieldId.toUpperCase().includes('PAN') ? 'PAN' : 
                      d.fieldId.toUpperCase().includes('BANK') ? 'BANK_PROOF' : 'OTHER',
                label: d.fieldName || d.fieldId,
                fileName: d.fileName || 'document',
                originalName: d.fileName || 'document',
                path: d.path,
                secureUrl: d.path,
                status: (d.status || 'PENDING').toLowerCase(),
                uploadedByRole: 'candidate',
                createdAt: d.uploadedAt
              }));
              
              await models.OnboardingDocument.insertMany(docsToCreate);
              
              // Force refresh of documentSummary after insertion
              const updatedDocs = await models.OnboardingDocument.find({ onboardingInstance: instance._id }).lean();
              documents = updatedDocs;
              syncNeeded = true;
            }

            // 2. Sync Personal/Bank details if empty on instance
            const instanceDoc = await models.OnboardingInstance.findById(instance._id);
            if (instanceDoc) {
              let updated = false;
              
              // Map responses to map for easy lookup
              const resMap = {};
              (submission.responses || []).forEach(r => { resMap[r.fieldId] = r.value; });

              if (!instanceDoc.personalDetails?.firstName && resMap.full_name) {
                const parts = String(resMap.full_name).split(' ');
                instanceDoc.personalDetails = {
                  ...instanceDoc.personalDetails,
                  firstName: parts[0],
                  lastName: parts.slice(1).join(' ')
                };
                updated = true;
              }
              if (!instanceDoc.bankDetails?.accountNumber && resMap.acc_no) {
                instanceDoc.bankDetails = {
                  ...instanceDoc.bankDetails,
                  bankName: resMap.bank_name,
                  accountNumber: resMap.acc_no,
                  ifsc: resMap.ifsc
                };
                updated = true;
              }

              if (updated) {
                await instanceDoc.save();
                syncNeeded = true;
              }
            }

            if (syncNeeded) {
              // Re-fetch everything to ensure consistent return
              const [newDocs, refreshedInstance] = await Promise.all([
                models.OnboardingDocument.find({ onboardingInstance: instance._id }).sort({ createdAt: -1 }).lean(),
                models.OnboardingInstance.findById(instance._id).populate('template').populate('employee').lean()
              ]);
              documents = newDocs;
              Object.assign(instance, refreshedInstance);
              await refreshInstanceMetrics({ models, instanceId: instance._id });
            }
          }
        }
      }
    } catch (syncError) {
      console.error('[onboarding sync error]', syncError);
    }
  }

  res.json({ success: true, instance: { ...instance, tasks, documents } });
};

exports.getDashboard = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const role = normalizeRole(req.user?.role);

  const [instances, tasks] = await Promise.all([
    models.OnboardingInstance.find({ tenant: tenantId }).lean(),
    models.OnboardingTask.find({ tenant: tenantId }).lean(),
  ]);

  const myTasks = role === 'employee'
    ? tasks.filter((task) => String(task.employee) === String(req.user.id))
    : tasks.filter((task) => canWorkTask(role, task.assignedRole));

  res.json({
    success: true,
    summary: {
      totalInstances: instances.length,
      inProgress: instances.filter((item) => item.status === 'in_progress').length,
      completed: instances.filter((item) => item.status === 'completed').length,
      blocked: instances.filter((item) => item.status === 'blocked').length,
      pendingTasks: tasks.filter((item) => ['pending', 'in_progress', 'overdue'].includes(item.status)).length,
      myTasks: myTasks.filter((item) => ['pending', 'in_progress', 'overdue'].includes(item.status)).length,
      avgCompletion: instances.length ? Math.round(instances.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / instances.length) : 0,
      slaBreached: instances.filter((item) => item.slaBreached).length,
    },
    tasks: myTasks.filter((item) => ['pending', 'in_progress', 'overdue'].includes(item.status)).slice(0, 8),
  });
};

exports.getTaskBoard = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const role = normalizeRole(req.user?.role);
  const tasks = await models.OnboardingTask.find({ tenant: tenantId }).sort({ dueDate: 1 }).lean();

  const filtered = tasks.filter((task) => {
    if (role === 'employee') return String(task.employee) === String(req.user.id);
    if (['manager', 'it'].includes(role)) return canWorkTask(role, task.assignedRole);
    return true;
  });

  res.json({ success: true, tasks: filtered });
};

exports.updateTask = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const task = await models.OnboardingTask.findOne({ _id: req.params.id, tenant: tenantId });

  if (!task) return res.status(404).json({ success: false, message: 'task_not_found' });
  if (!canWorkTask(req.user?.role, task.assignedRole)) {
    return res.status(403).json({ success: false, message: 'forbidden_task_role' });
  }

  const before = task.toObject();
  if (req.body?.status) task.status = req.body.status;
  if (req.body?.notes !== undefined) task.notes = req.body.notes;
  if (req.body?.completionPayload && typeof req.body.completionPayload === 'object') {
    task.completionPayload = { ...(task.completionPayload || {}), ...req.body.completionPayload };
  }
  if (task.status === 'completed') task.completedAt = new Date();
  if (task.status === 'in_progress' && !task.startedAt) task.startedAt = new Date();
  await task.save();

  await appendActivity({
    models,
    instanceId: task.onboardingInstance,
    actor,
    action: 'TASK_UPDATED',
    message: `${actor.name} marked "${task.title}" as ${task.status}`,
    meta: { taskId: task._id, status: task.status },
  });

  await createAuditLog({
    models,
    tenantId,
    entity: 'OnboardingTask',
    entityId: task._id,
    action: 'TASK_UPDATED',
    performedBy: actor.id,
    before: { status: before.status, notes: before.notes },
    after: { status: task.status, notes: task.notes },
    meta: {},
  });

  await refreshInstanceMetrics({ models, instanceId: task.onboardingInstance });
  if (task.status === 'completed') {
    await activatePendingTasks({ models, instanceId: task.onboardingInstance });
  }

  res.json({ success: true, task });
};

exports.uploadDocument = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const { instanceId, taskId, employeeId, type, label } = req.body || {};

  if (!req.file) return res.status(400).json({ success: false, message: 'file_required' });
  if (!instanceId || !employeeId || !type) {
    return res.status(400).json({ success: false, message: 'instance_employee_type_required' });
  }

  const instance = await models.OnboardingInstance.findOne({ _id: instanceId, tenant: tenantId });
  if (!instance) return res.status(404).json({ success: false, message: 'instance_not_found' });

  const latest = await models.OnboardingDocument.findOne({
    tenant: tenantId,
    onboardingInstance: instanceId,
    employee: employeeId,
    type,
  }).sort({ version: -1 }).lean();
  const storedFile = await storeOnboardingFile({ file: req.file, instance });

  const document = await models.OnboardingDocument.create({
    tenant: tenantId,
    company: tenantId,
    onboardingInstance: instanceId,
    task: taskId || null,
    employee: employeeId,
    type,
    label: label || type,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    path: storedFile.path,
    storageProvider: storedFile.storageProvider,
    storageKey: storedFile.storageKey,
    secureUrl: storedFile.secureUrl,
    status: latest ? 'resubmitted' : 'pending',
    uploadedByRole: actor.role || 'employee',
    version: Number(latest?.version || 0) + 1,
  });

  if (taskId) {
    await models.OnboardingTask.findByIdAndUpdate(taskId, {
      $set: {
        'completionPayload.lastDocumentId': document._id,
        'completionPayload.lastDocumentStatus': document.status,
      },
    });
  }

  await appendActivity({
    models,
    instanceId,
    actor,
    action: 'DOCUMENT_UPLOADED',
    message: `${actor.name} uploaded ${document.type}`,
    meta: { documentId: document._id, taskId: taskId || null },
  });

  await refreshInstanceMetrics({ models, instanceId });
  res.status(201).json({ success: true, document });
};

exports.verifyDocument = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const document = await models.OnboardingDocument.findOne({ _id: req.params.id, tenant: tenantId });

  if (!document) return res.status(404).json({ success: false, message: 'document_not_found' });
  const status = req.body?.status;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'invalid_verification_status' });
  }

  document.status = status;
  document.rejectionReason = status === 'rejected' ? (req.body?.reason || 'Document does not meet validation criteria') : '';
  document.verifiedBy = actor.id;
  document.verifiedAt = new Date();
  await document.save();

  const task = document.task ? await models.OnboardingTask.findById(document.task) : null;
  if (task) {
    task.completionPayload = {
      ...(task.completionPayload || {}),
      lastDocumentId: document._id,
      lastDocumentStatus: document.status,
      rejectionReason: document.rejectionReason,
    };
    task.status = status === 'approved' ? 'completed' : 'in_progress';
    task.completedAt = status === 'approved' ? new Date() : null;
    await task.save();
  }

  await appendActivity({
    models,
    instanceId: document.onboardingInstance,
    actor,
    action: 'DOCUMENT_VERIFIED',
    message: `${actor.name} ${status} ${document.type}`,
    meta: { documentId: document._id, status },
  });

  await createInAppNotification({
    models,
    tenantId,
    receiverId: document.employee,
    receiverRole: 'employee',
    entityType: 'OnboardingDocument',
    entityId: document._id,
    title: `Document ${status}`,
    message: status === 'approved' ? `${document.type} has been approved.` : `${document.type} was rejected. ${document.rejectionReason}`,
  });

  await refreshInstanceMetrics({ models, instanceId: document.onboardingInstance });
  if (task && status === 'approved') await activatePendingTasks({ models, instanceId: document.onboardingInstance });

  res.json({ success: true, document });
};

exports.getMyPortal = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const instance = await models.OnboardingInstance.findOne({
    tenant: tenantId,
    $or: [
      { employee: req.user.id },
      { candidate: req.user.id }
    ],
    status: { $in: ['invited', 'in_progress', 'form_submitted', 'docs_pending', 'verification', 'verified', 'completed', 'blocked'] },
  }).sort({ createdAt: -1 }).lean();

  if (!instance) return res.json({ success: true, instance: null, tasks: [], documents: [] });

  const [tasks, documents, employee] = await Promise.all([
    models.OnboardingTask.find({ onboardingInstance: instance._id }).sort({ stepOrder: 1 }).lean(),
    models.OnboardingDocument.find({ onboardingInstance: instance._id }).sort({ createdAt: -1 }).lean(),
    models.Employee.findById(req.user.id).lean(),
  ]);

  res.json({ success: true, instance, tasks, documents, employee });
};

exports.updateMyProfile = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const employee = await models.Employee.findById(req.user.id);

  if (!employee) return res.status(404).json({ success: false, message: 'employee_not_found' });

  const patch = req.body || {};
  const allowedFields = ['contactNo', 'dob', 'bloodGroup', 'gender', 'fatherName', 'motherName', 'maritalStatus', 'nationality', 'emergencyContactName', 'emergencyContactNumber'];
  for (const field of allowedFields) {
    if (patch[field] !== undefined) employee[field] = patch[field];
  }
  if (patch.tempAddress) employee.tempAddress = { ...(employee.tempAddress || {}), ...patch.tempAddress };
  if (patch.permAddress) employee.permAddress = { ...(employee.permAddress || {}), ...patch.permAddress };
  if (patch.bankDetails) employee.bankDetails = { ...(employee.bankDetails || {}), ...patch.bankDetails };
  employee.meta = { ...(employee.meta || {}), onboardingProfileUpdatedAt: new Date() };
  await employee.save();

  const instance = await models.OnboardingInstance.findOne({ tenant: tenantId, employee: employee._id }).sort({ createdAt: -1 });
  if (instance) {
    instance.personalDetails = { ...(instance.personalDetails || {}), ...patch };
    await instance.save();
    await appendActivity({
      models,
      instanceId: instance._id,
      actor,
      action: 'PROFILE_UPDATED',
      message: `${actor.name} updated personal details`,
      meta: {},
    });
  }

  res.json({ success: true, employee });
};

exports.acceptOffer = async (req, res) => {
  const tenantId = ensureTenant(req, res);
  if (!tenantId) return;
  const models = getModels(req);
  const actor = await resolveActorUser(req, models);
  const instance = await models.OnboardingInstance.findOne({ tenant: tenantId, employee: req.user.id }).sort({ createdAt: -1 });

  if (!instance) return res.status(404).json({ success: false, message: 'instance_not_found' });

  instance.offerAcceptedAt = new Date();
  await instance.save();

  const offerTask = await models.OnboardingTask.findOne({
    onboardingInstance: instance._id,
    employee: req.user.id,
    type: 'offer',
  }).sort({ stepOrder: 1 });

  if (offerTask) {
    offerTask.status = 'completed';
    offerTask.completedAt = new Date();
    offerTask.completionPayload = { ...(offerTask.completionPayload || {}), accepted: true, acceptedAt: new Date() };
    await offerTask.save();
    await activatePendingTasks({ models, instanceId: instance._id });
  }

  await appendActivity({
    models,
    instanceId: instance._id,
    actor,
    action: 'OFFER_ACCEPTED',
    message: `${actor.name} accepted the offer`,
    meta: {},
  });

  res.json({ success: true, instance });
};

exports.superAdminOverview = async (_req, res) => {
  const OnboardingInstance = mongoose.connection.models.OnboardingInstance;
  const OnboardingTask = mongoose.connection.models.OnboardingTask;
  const OnboardingTemplate = mongoose.connection.models.OnboardingTemplate;
  const Tenant = mongoose.model('Tenant');

  const [companies, totals, templates] = await Promise.all([
    Tenant.find({ status: { $ne: 'deleted' } }).select('companyName code status').lean(),
    Promise.all([
      OnboardingInstance.countDocuments({}),
      OnboardingTask.countDocuments({ status: { $in: ['pending', 'in_progress', 'overdue'] } }),
      OnboardingInstance.countDocuments({ status: 'completed' }),
    ]),
    OnboardingTemplate.find({ isGlobal: true }).sort({ updatedAt: -1 }).lean(),
  ]);

  res.json({
    success: true,
    summary: {
      companies: companies.length,
      activeOnboardings: totals[0],
      pendingTasks: totals[1],
      completedOnboardings: totals[2],
    },
    companies,
    globalTemplates: templates,
  });
};
