const crypto = require('crypto');
const mongoose = require('mongoose');

function getModels(req) {
  const db = req.tenantDB || req.db;
  if (!db) throw new Error('Tenant database connection not available');
  const model = (name, path = name) => db.models[name] || db.model(name, require(`../models/${path}`));
  return {
    Applicant: model('Applicant'),
    CandidateDocumentRequest: model('CandidateDocumentRequest'),
    ExternalEmployeeRecord: model('ExternalEmployeeRecord'),
    Employee: model('Employee'),
    AuditLog: model('AuditLog'),
    Notification: model('Notification'),
  };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function actorName(req) {
  return req.user?.name || req.user?.fullName || req.user?.email || req.candidate?.name || 'System';
}

async function writeAudit(req, { module, action, entityId, before = null, after = null, meta = {} }) {
  try {
    const { AuditLog } = getModels(req);
    await AuditLog.create({
      tenant: req.tenantId || req.user?.tenantId || req.candidate?.tenantId,
      entity: module,
      entityId,
      action,
      performedBy: req.user?._id || null,
      changes: { before, after },
      meta: {
        ...meta,
        performedBy: actorName(req),
        ipAddress: req.ip,
        date: new Date(),
      },
    });
  } catch (err) {
    console.warn('[EXTERNAL_RECORD_AUDIT] failed:', err.message);
  }
}

async function resolveRequestByToken(req, token) {
  const { CandidateDocumentRequest, Applicant, ExternalEmployeeRecord } = getModels(req);
  const request = await CandidateDocumentRequest.findOne({ token: hashToken(token) });
  if (!request) {
    const err = new Error('Invalid document upload link');
    err.statusCode = 404;
    throw err;
  }
  if (request.expiresAt && new Date(request.expiresAt).getTime() < Date.now()) {
    const err = new Error('Document upload link has expired');
    err.statusCode = 410;
    throw err;
  }

  const applicant = await Applicant.findById(request.applicantId).populate('requirementId').lean();
  if (!applicant) {
    const err = new Error('Candidate application not found');
    err.statusCode = 404;
    throw err;
  }

  const externalRecord = await ExternalEmployeeRecord.findOne({ applicantId: applicant._id }).lean();
  return { request, applicant, externalRecord };
}

function nameParts(applicant) {
  const parts = String(applicant?.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function prefillEmployee(applicant, externalRecord) {
  const names = nameParts(applicant);
  return {
    ...(externalRecord?.rawEmployeePayload || {}),
    firstName: externalRecord?.rawEmployeePayload?.firstName || names.firstName,
    lastName: externalRecord?.rawEmployeePayload?.lastName || names.lastName,
    email: externalRecord?.rawEmployeePayload?.email || applicant.email,
    personalEmail: externalRecord?.rawEmployeePayload?.personalEmail || applicant.email,
    contactNo: externalRecord?.rawEmployeePayload?.contactNo || applicant.mobile,
    gender: externalRecord?.rawEmployeePayload?.gender || applicant.gender || '',
    dob: externalRecord?.rawEmployeePayload?.dob || applicant.dob || '',
    department: externalRecord?.rawEmployeePayload?.department || applicant.department || applicant.requirementId?.department || '',
    designation: externalRecord?.rawEmployeePayload?.designation || applicant.requirementId?.jobTitle || '',
    employeeType: externalRecord?.rawEmployeePayload?.employeeType || (applicant.jobCategory === 'Intern' ? 'Intern' : 'Full-time'),
    status: 'Draft',
    lastStep: externalRecord?.rawEmployeePayload?.lastStep || 1,
  };
}

function computeCompletionPercentage(payload = {}) {
  const groups = [
    ['firstName', 'lastName', 'email', 'contactNo', 'gender', 'dob'],
    ['fatherName', 'motherName', 'emergencyContactName', 'emergencyContactNumber'],
    ['tempAddress', 'permAddress', 'commAddress'],
    ['academicQualifications', 'education', 'highestQualification'],
    ['experience'],
    ['documents'],
    ['bankDetails'],
    ['salaryTemplateId', 'payrollTemplateId', 'salary', 'grade', 'band'],
  ];
  const completed = groups.filter((keys) => keys.some((key) => {
    const value = payload[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.values(value).some(Boolean);
    return Boolean(value);
  })).length;
  return Math.round((completed / groups.length) * 100);
}

function splitRecordPayload(payload = {}) {
  return {
    personalDetails: {
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      gender: payload.gender,
      dob: payload.dob,
      email: payload.email,
      contactNo: payload.contactNo,
      bloodGroup: payload.bloodGroup,
      maritalStatus: payload.maritalStatus,
      nationality: payload.nationality,
      profilePic: payload.profilePic,
    },
    familyDetails: {
      fatherName: payload.fatherName,
      motherName: payload.motherName,
      spouseDetails: payload.spouseDetails,
      children: payload.children,
      brothers: payload.brothers,
      sisters: payload.sisters,
      references: payload.references,
    },
    communicationDetails: {
      tempAddress: payload.tempAddress,
      permAddress: payload.permAddress,
      commAddress: payload.commAddress,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactNumber: payload.emergencyContactNumber,
    },
    educationDetails: {
      education: payload.education,
      academicQualifications: payload.academicQualifications,
      highestQualification: payload.highestQualification,
      languages: payload.languages,
    },
    experienceDetails: {
      experience: payload.experience,
      jobHistoryAnnexure: payload.jobHistoryAnnexure,
      previousInterview: payload.previousInterview,
    },
    documentDetails: payload.documents || {},
    bankDetails: payload.bankDetails || {},
    statutoryDetails: {
      aadharNumber: payload.documents?.aadharNumber,
      panNumber: payload.documents?.panNumber,
      physicalDisabilityOrSickness: payload.physicalDisabilityOrSickness,
      physicalDisabilityDetails: payload.physicalDisabilityDetails,
    },
    salaryDetails: {
      salary: payload.salary,
      salaryTemplateId: payload.salaryTemplateId,
      payrollTemplateId: payload.payrollTemplateId,
      gradeId: payload.gradeId,
      grade: payload.grade,
      band: payload.band,
    },
  };
}

exports.getByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { request, applicant, externalRecord } = await resolveRequestByToken(req, token);
    return res.json({
      success: true,
      data: {
        request: {
          id: request._id,
          status: request.status,
          expiresAt: request.expiresAt,
          submittedAt: request.submittedAt,
        },
        applicant,
        externalRecord,
        employee: prefillEmployee(applicant, externalRecord),
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

async function upsertExternal(req, submit = false) {
  const { token } = req.params;
  const payload = req.body || {};
  const { CandidateDocumentRequest, ExternalEmployeeRecord, Applicant } = getModels(req);
  const { request, applicant } = await resolveRequestByToken(req, token);
  const split = splitRecordPayload(payload);
  const update = {
    tenant: request.tenant,
    candidateId: request.candidateId,
    applicantId: request.applicantId,
    jobId: request.jobId,
    documentRequestId: request._id,
    ...split,
    rawEmployeePayload: payload,
    completionPercentage: computeCompletionPercentage(payload),
    status: submit ? 'Submitted' : 'Pending',
    createdBy: request.candidateId,
    ...(submit ? { submittedAt: new Date() } : {}),
  };

  const record = await ExternalEmployeeRecord.findOneAndUpdate(
    { applicantId: request.applicantId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  request.status = submit ? 'Submitted' : request.status;
  if (submit) request.submittedAt = new Date();
  await request.save();

  const nextStatus = submit ? 'Profile Submitted' : 'Document Draft Saved';
  await Applicant.updateOne(
    { _id: applicant._id },
    {
      $set: { status: nextStatus, customData: { ...(applicant.customData || {}), employeeData: payload } },
      $push: {
        timeline: {
          status: nextStatus,
          message: submit ? 'Candidate submitted employment profile.' : 'Candidate saved employment profile draft.',
          updatedBy: 'Candidate',
          timestamp: new Date(),
        },
      },
    }
  );

  await writeAudit(req, {
    module: 'ExternalEmployeeRecord',
    action: submit ? 'Profile Submitted' : 'Profile Draft Saved',
    entityId: record._id,
    after: record.toObject(),
  });

  return record;
}

exports.saveDraftByToken = async (req, res) => {
  try {
    const record = await upsertExternal(req, false);
    return res.json({ success: true, message: 'Draft saved', data: record });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.submitByToken = async (req, res) => {
  try {
    const record = await upsertExternal(req, true);
    return res.json({ success: true, message: 'Profile submitted', data: record });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { ExternalEmployeeRecord } = getModels(req);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const filter = { tenant: req.tenantId };
    if (status && status !== 'All') filter.status = status;

    const query = ExternalEmployeeRecord.find(filter)
      .populate('applicantId', 'name email mobile applicationId status requirementId profilePic')
      .populate('jobId', 'jobTitle department')
      .sort({ submittedAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    let [items, total] = await Promise.all([
      query.lean(),
      ExternalEmployeeRecord.countDocuments(filter),
    ]);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((item) =>
        [item.applicantId?.name, item.applicantId?.email, item.jobId?.jobTitle]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
      total = items.length;
    }

    return res.json({ success: true, data: items, total, page, limit });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.approve = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { ExternalEmployeeRecord, Applicant, Employee, CandidateDocumentRequest } = getModels(req);
    const record = await ExternalEmployeeRecord.findOne({ _id: req.params.id, tenant: req.tenantId }).session(session);
    if (!record) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'External record not found' });
    }
    if (record.status !== 'Submitted') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Only submitted external records can be approved' });
    }

    const applicant = await Applicant.findById(record.applicantId).session(session);
    const raw = record.rawEmployeePayload || {};
    const names = nameParts(applicant);
    const draftCode = raw.employeeId || `DRFT-${Date.now()}`;
    const employee = await Employee.create([{
      ...raw,
      tenant: req.tenantId,
      mainCompanyId: req.tenantId,
      firstName: raw.firstName || names.firstName,
      lastName: raw.lastName || names.lastName,
      email: raw.email || applicant.email,
      personalEmail: raw.personalEmail || applicant.email,
      contactNo: raw.contactNo || applicant.mobile,
      employeeId: draftCode,
      employeeCode: draftCode,
      status: 'Draft',
      lastStep: raw.lastStep || 10,
      meta: {
        ...(raw.meta || {}),
        externalRecordId: record._id,
        applicantId: applicant._id,
        candidateId: applicant.candidateId,
        hiringConversionStatus: 'EXTERNAL_APPROVED_DRAFT',
      },
    }], { session });

    const draftEmployee = employee[0];
    record.status = 'Approved';
    record.approvedAt = new Date();
    record.approvedBy = req.user?._id || null;
    record.draftEmployeeId = draftEmployee._id;
    await record.save({ session });

    await CandidateDocumentRequest.updateOne(
      { _id: record.documentRequestId },
      { $set: { status: 'Approved', approvedAt: new Date() } },
      { session }
    );

    applicant.employeeId = draftEmployee._id;
    applicant.status = 'Draft Employee';
    applicant.timeline.push({
      status: 'Draft Created',
      message: 'External profile approved and draft employee record created.',
      updatedBy: actorName(req),
      timestamp: new Date(),
    });
    await applicant.save({ session });

    await session.commitTransaction();
    await writeAudit(req, {
      module: 'ExternalEmployeeRecord',
      action: 'Profile Approved / Draft Created',
      entityId: record._id,
      after: { recordId: record._id, draftEmployeeId: draftEmployee._id },
    });

    return res.json({ success: true, message: 'Profile approved and draft employee created', data: { record, employee: draftEmployee } });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

exports.reject = async (req, res) => {
  try {
    const { ExternalEmployeeRecord, CandidateDocumentRequest, Applicant } = getModels(req);
    const remarks = req.body?.remarks || '';
    const record = await ExternalEmployeeRecord.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: { status: 'Rejected', rejectedAt: new Date(), rejectedBy: req.user?._id || null, remarks } },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'External record not found' });
    await CandidateDocumentRequest.updateOne({ _id: record.documentRequestId }, { $set: { status: 'Rejected', rejectedAt: new Date(), remarks } });
    await Applicant.updateOne(
      { _id: record.applicantId },
      { $set: { status: 'Profile Rejected' }, $push: { timeline: { status: 'Profile Rejected', message: remarks || 'HR rejected external profile.', updatedBy: actorName(req), timestamp: new Date() } } }
    );
    await writeAudit(req, { module: 'ExternalEmployeeRecord', action: 'Profile Rejected', entityId: record._id, after: record.toObject() });
    return res.json({ success: true, message: 'Profile rejected', data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.requestChanges = async (req, res) => {
  try {
    const { ExternalEmployeeRecord, CandidateDocumentRequest, Applicant } = getModels(req);
    const remarks = req.body?.remarks || '';
    const record = await ExternalEmployeeRecord.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: { status: 'Pending', remarks } },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'External record not found' });
    await CandidateDocumentRequest.updateOne({ _id: record.documentRequestId }, { $set: { status: 'Pending', remarks } });
    await Applicant.updateOne(
      { _id: record.applicantId },
      { $set: { status: 'Re-upload Required' }, $push: { timeline: { status: 'Changes Requested', message: remarks || 'HR requested changes in external profile.', updatedBy: actorName(req), timestamp: new Date() } } }
    );
    await writeAudit(req, { module: 'ExternalEmployeeRecord', action: 'Profile Changes Requested', entityId: record._id, after: record.toObject() });
    return res.json({ success: true, message: 'Changes requested', data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
