const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { appendHiringLog } = require('../utils/hiringLogger');
const onboardingCtrl = require('./onboarding.controller');

function getModels(db) {
  if (!db) throw new Error('Tenant database not available');
  const Application = db.models?.Application || db.model('Application', require('../models/Application'));
  const OfferLetter = db.models?.OfferLetter || db.model('OfferLetter', require('../models/OfferLetter'));
  const Joining = db.models?.Joining || db.model('Joining', require('../models/Joining'));
  const Applicant = db.models?.Applicant || db.model('Applicant', require('../models/Applicant'));
  const Grade = db.models?.Grade || db.model('Grade', require('../models/Grade'));
  return { Application, OfferLetter, Joining, Applicant, Grade };
}

async function resolveGradeSnapshot(Grade, tenantId, gradeId) {
  if (!gradeId) return null;
  if (!mongoose.Types.ObjectId.isValid(String(gradeId))) throw new Error('Invalid gradeId');
  const grade = await Grade.findOne({ _id: gradeId, tenant: tenantId, isDeleted: false, isActive: true }).lean();
  if (!grade) throw new Error('Grade not found or inactive');
  return { id: grade._id, name: grade.name, code: grade.code, level: grade.level };
}

async function resolveTenantDbFromCandidate(req) {
  if (req.tenantDB || req.db) return req.tenantDB || req.db;
  const tenantId = req.candidate?.tenantId;
  if (!tenantId) throw new Error('Tenant not found');
  return await getTenantDB(tenantId);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: OFFER
// ─────────────────────────────────────────────────────────────────────────────

exports.issueOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const db = req.tenantDB || req.db;
    const tenantId = req.tenantId || req.user?.tenantId;
    const user = req.user;

    const { applicationId, candidateId, position, salary, documentUrl, gradeId } = req.body || {};

    if (!applicationId || !candidateId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'applicationId and candidateId are required' });
    }

    const { Application, OfferLetter, Grade } = getModels(db);

    const application = await Application.findOne({ _id: applicationId, tenant: tenantId }).session(session);
    if (!application) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (String(application.candidateId) !== String(candidateId)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Candidate does not match this application' });
    }

    // Only allowed if application status = INTERVIEW
    if (application.status !== 'INTERVIEW') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Offer can only be issued from INTERVIEW. Current: ${application.status}` });
    }

    const existing = await OfferLetter.findOne({ tenant: tenantId, applicationId: application._id }).session(session);
    if (existing) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: 'Offer already issued for this application' });
    }

    const gradeSnapshot = await resolveGradeSnapshot(Grade, tenantId, gradeId || application.gradeId);

    const offer = await OfferLetter.create(
      [
        {
          tenant: tenantId,
          candidateId,
          applicationId: application._id,
          position: position || '',
          gradeId: gradeSnapshot?.id || null,
          gradeSnapshot: gradeSnapshot || undefined,
          salary: Number(salary || 0),
          status: 'PENDING',
          issuedBy: user?._id,
          issuedAt: new Date(),
          documentUrl: documentUrl || '',
        },
      ],
      { session }
    );

    application.changeStatus('OFFER_PENDING', user?._id, user?.name || user?.email || 'HR', 'Offer issued');
    await application.save({ session });

    await session.commitTransaction();
    appendHiringLog(`[OFFER_ISSUED] tenant=${tenantId} app=${applicationId} offer=${offer[0]._id} by=${user?._id || 'N/A'}`);

    return res.json({ success: true, message: 'Offer issued', data: offer[0] });
  } catch (error) {
    await session.abortTransaction();
    console.error('Issue Offer Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to issue offer' });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CANDIDATE: OFFER
// ─────────────────────────────────────────────────────────────────────────────

exports.getCandidateOfferByApplication = async (req, res) => {
  try {
    const db = await resolveTenantDbFromCandidate(req);
    const tenantId = req.candidate.tenantId;
    const candidateId = req.candidate.id;
    const { applicationId } = req.params;

    // IMPORTANT: In current production UI, "applicationId" refers to Applicant._id (candidate portal),
    // and HR generates letters against Applicant documents. So we use Applicant as the source of truth.
    const { Applicant } = getModels(db);

    const applicant = await Applicant.findOne({ _id: applicationId, tenant: tenantId, candidateId });
    if (!applicant) return res.status(404).json({ success: false, message: 'Application not found' });

    // Auto-expire (Offer)
    const now = new Date();
    if (applicant.offerStatus === 'SENT' && applicant.offerExpiryAt && now > new Date(applicant.offerExpiryAt)) {
      applicant.offerStatus = 'EXPIRED';
      applicant.status = 'Offer Expired';
      if (!applicant.timeline) applicant.timeline = [];
      applicant.timeline.push({
        status: 'Offer Expired',
        message: 'Offer expired automatically (system).',
        updatedBy: 'System',
        timestamp: now,
      });
      await applicant.save();
    }

    return res.json({
      success: true,
      message: 'Offer fetched',
      data: {
        applicationId: applicant._id,
        candidateId: applicant.candidateId,
        status: applicant.offerStatus || null, // SENT/EXPIRED/ACCEPTED/REJECTED/REQUESTED/REVISED
        version: applicant.offerVersion || 1,
        expiresAt: (applicant.offerStatus === 'PENDING_APPROVAL') ? null : (applicant.offerExpiryAt || null),
        issuedAt: (applicant.offerStatus === 'PENDING_APPROVAL') ? null : (applicant.timeline?.slice().reverse().find(t => t?.status === 'Offer Issued')?.timestamp || null),
        documentUrl: (applicant.offerStatus === 'PENDING_APPROVAL') ? null : (applicant.offerLetterPath ? `/uploads/offers/${applicant.offerLetterPath}` : null),
        signedDocumentUrl: (applicant.offerStatus === 'PENDING_APPROVAL') ? null : (applicant.signedOfferPath ? `/uploads/offers/${applicant.signedOfferPath}` : null),
        refNo: (applicant.offerStatus === 'PENDING_APPROVAL') ? null : (applicant.offerRefCode || null),
      }
    });
  } catch (error) {
    console.error('Get Candidate Offer Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch offer' });
  }
};

exports.respondToOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const db = await resolveTenantDbFromCandidate(req);
    const tenantId = req.candidate.tenantId;
    const candidateId = req.candidate.id;
    const { applicationId, action } = req.body || {};

    if (!applicationId || !['ACCEPT', 'REJECT'].includes(String(action || '').toUpperCase())) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'applicationId and action (ACCEPT|REJECT) are required' });
    }

    const { Applicant } = getModels(db);
    const applicant = await Applicant.findOne({ _id: applicationId, tenant: tenantId, candidateId }).session(session);
    if (!applicant) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const now = new Date();
    if (applicant.offerStatus === 'SENT' && applicant.offerExpiryAt && now > new Date(applicant.offerExpiryAt)) {
      applicant.offerStatus = 'EXPIRED';
      applicant.status = 'Offer Expired';
    }

    if (applicant.offerStatus !== 'SENT') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Offer is not pending response. Current: ${applicant.offerStatus || 'N/A'}` });
    }

    const upper = String(action).toUpperCase();
    if (upper === 'ACCEPT') {
      applicant.offerStatus = 'ACCEPTED';
      applicant.status = 'Offer Accepted – Awaiting Company Approval';
      if (!applicant.timeline) applicant.timeline = [];
      applicant.timeline.push({
        status: 'Offer Accepted',
        message: 'Offer accepted by candidate.',
        updatedBy: 'Candidate',
        timestamp: now,
      });
      appendHiringLog(`[OFFER_ACCEPTED] tenant=${tenantId} applicant=${applicationId} candidate=${candidateId}`);
    } else {
      applicant.offerStatus = 'REJECTED';
      applicant.offerRejectedAt = now;
      applicant.status = 'Offer Rejected';
      if (!applicant.timeline) applicant.timeline = [];
      applicant.timeline.push({
        status: 'Offer Rejected',
        message: 'Offer rejected by candidate.',
        updatedBy: 'Candidate',
        timestamp: now,
      });
      appendHiringLog(`[OFFER_REJECTED] tenant=${tenantId} applicant=${applicationId} candidate=${candidateId}`);
    }

    await applicant.save({ session });

    await session.commitTransaction();
    return res.json({
      success: true,
      message: 'Offer response recorded',
      data: {
        offerStatus: applicant.offerStatus,
        applicantStatus: applicant.status,
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Respond Offer Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to respond to offer' });
  } finally {
    session.endSession();
  }
};

exports.signOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const db = await resolveTenantDbFromCandidate(req);
    const tenantId = req.candidate.tenantId;
    const candidateId = req.candidate.id;
    const { applicationId } = req.body || {};

    if (!applicationId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'applicationId is required' });
    }

    const { Applicant } = getModels(db);
    const applicant = await Applicant.findOne({ _id: applicationId, tenant: tenantId, candidateId }).session(session);
    if (!applicant) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Auto-expire before sign attempt
    const now = new Date();
    if (applicant.offerStatus === 'SENT' && applicant.offerExpiryAt && now > new Date(applicant.offerExpiryAt)) {
      applicant.offerStatus = 'EXPIRED';
      applicant.status = 'Offer Expired';
    }

    if (applicant.offerStatus !== 'SENT' && applicant.offerStatus !== 'ACCEPTED') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Offer can only be signed when pending response or accepted' });
    }

    applicant.offerStatus = 'SIGNED';
    applicant.isSigned = true;
    applicant.status = 'Fully Signed';
    if (!applicant.timeline) applicant.timeline = [];
    applicant.timeline.push({
      status: 'Fully Signed',
      message: 'Offer signed by candidate.',
      updatedBy: 'Candidate',
      timestamp: now,
    });

    await applicant.save({ session });

    await session.commitTransaction();
    appendHiringLog(`[OFFER_SIGNED] tenant=${tenantId} applicant=${applicationId} candidate=${candidateId}`);
    return res.json({
      success: true,
      message: 'Offer signed',
      data: { offerStatus: applicant.offerStatus, applicantStatus: applicant.status }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Sign Offer Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to sign offer' });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: JOINING
// ─────────────────────────────────────────────────────────────────────────────

exports.issueJoining = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const db = req.tenantDB || req.db;
    const tenantId = req.tenantId || req.user?.tenantId;
    const user = req.user;

    const { applicationId, candidateId, joiningDate } = req.body || {};
    if (!applicationId || !candidateId || !joiningDate) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'applicationId, candidateId and joiningDate are required' });
    }

    const { Application, Joining } = getModels(db);

    const application = await Application.findOne({ _id: applicationId, tenant: tenantId }).session(session);
    if (!application) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (String(application.candidateId) !== String(candidateId)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Candidate does not match this application' });
    }

    // Only if application status = OFFER_SIGNED
    if (application.status !== 'OFFER_SIGNED') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Joining can only be issued from OFFER_SIGNED. Current: ${application.status}` });
    }

    const existing = await Joining.findOne({ tenant: tenantId, applicationId: application._id }).session(session);
    if (existing) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: 'Joining already issued for this application' });
    }

    const joining = await Joining.create(
      [
        {
          tenant: tenantId,
          candidateId,
          applicationId: application._id,
          joiningDate: new Date(joiningDate),
          status: 'PENDING',
          issuedAt: new Date(),
        },
      ],
      { session }
    );

    application.changeStatus('JOINING_ISSUED', user?._id, user?.name || user?.email || 'HR', 'Joining issued');
    await application.save({ session });

    await session.commitTransaction();
    appendHiringLog(`[JOINING_ISSUED] tenant=${tenantId} app=${applicationId} joining=${joining[0]._id} by=${user?._id || 'N/A'}`);
    return res.json({ success: true, message: 'Joining issued', data: joining[0] });
  } catch (error) {
    await session.abortTransaction();
    console.error('Issue Joining Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to issue joining' });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CANDIDATE: JOINING
// ─────────────────────────────────────────────────────────────────────────────

exports.getCandidateJoiningByApplication = async (req, res) => {
  try {
    const db = await resolveTenantDbFromCandidate(req);
    const tenantId = req.candidate.tenantId;
    const candidateId = req.candidate.id;
    const { applicationId } = req.params;

    const { Applicant } = getModels(db);
    const applicant = await Applicant.findOne({ _id: applicationId, tenant: tenantId, candidateId });
    if (!applicant) return res.status(404).json({ success: false, message: 'Application not found' });

    const now = new Date();
    if (applicant.joiningLetterStatus === 'SENT' && applicant.joiningLetterExpiryAt && now > new Date(applicant.joiningLetterExpiryAt)) {
      applicant.joiningLetterStatus = 'EXPIRED';
      if (!applicant.timeline) applicant.timeline = [];
      applicant.timeline.push({
        status: 'Joining Letter Expired',
        message: 'Joining letter expired automatically (system).',
        updatedBy: 'System',
        timestamp: now,
      });
      await applicant.save();
    }

    return res.json({
      success: true,
      message: 'Joining fetched',
      data: {
        applicationId: applicant._id,
        candidateId: applicant.candidateId,
        status: applicant.joiningLetterStatus || null,
        expiresAt: applicant.joiningLetterExpiryAt || null,
        joiningDate: applicant.joiningDate || null,
        documentUrl: applicant.joiningLetterPath ? (applicant.joiningLetterPath.startsWith('uploads') ? `/${applicant.joiningLetterPath}` : `/uploads/${applicant.joiningLetterPath}`) : null,
      }
    });
  } catch (error) {
    console.error('Get Candidate Joining Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch joining' });
  }
};

exports.confirmJoining = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const db = await resolveTenantDbFromCandidate(req);
    const tenantId = req.candidate.tenantId;
    const candidateId = req.candidate.id;
    const { applicationId } = req.body || {};

    if (!applicationId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'applicationId is required' });
    }

    const { Applicant } = getModels(db);
    const applicant = await Applicant.findOne({ _id: applicationId, tenant: tenantId, candidateId }).session(session);
    if (!applicant) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const now = new Date();
    if (applicant.joiningLetterStatus === 'SENT' && applicant.joiningLetterExpiryAt && now > new Date(applicant.joiningLetterExpiryAt)) {
      applicant.joiningLetterStatus = 'EXPIRED';
    }

    if (!['SENT', 'ACCEPTED', 'SIGNED'].includes(applicant.joiningLetterStatus)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Joining letter is not pending confirmation. Current: ${applicant.joiningLetterStatus || 'N/A'}` });
    }

    // Candidate-side confirmation should not bypass HR onboarding.
    applicant.joiningLetterStatus = 'SIGNED';
    applicant.status = 'Joining Letter Signed';
    if (!applicant.timeline) applicant.timeline = [];
    applicant.timeline.push({
      status: 'Joining Letter Signed',
      message: 'Candidate completed joining letter signing. Onboarding automation is starting.',
      updatedBy: 'Candidate',
      timestamp: now,
    });

    await applicant.save({ session });

    await session.commitTransaction();
    appendHiringLog(`[JOINING_CONFIRMED] tenant=${tenantId} applicant=${applicationId} candidate=${candidateId}`);

    let onboardingResult = null;
    try {
      onboardingResult = await onboardingCtrl.autoStartOnboardingForApplicant({
        req: { ...req, tenantId, tenantDB: db },
        applicant: applicant._id,
        actor: {
          id: null,
          name: 'Candidate Portal',
          role: 'candidate',
          email: '',
        },
        source: 'joining_confirmation',
      });
    } catch (autoStartErr) {
      console.error('[JOINING_CONFIRMED][AUTO_ONBOARDING] Failed to auto-start onboarding:', autoStartErr);
    }

    return res.json({
      success: true,
      message: onboardingResult?.invited
        ? 'Joining letter signing confirmed. Onboarding invite sent automatically.'
        : onboardingResult?.instance
          ? 'Joining letter signing confirmed. Onboarding is already active.'
          : 'Joining letter signing confirmed. Awaiting HR onboarding.',
      data: {
        joiningStatus: applicant.joiningLetterStatus,
        applicantStatus: applicant.status,
        onboardingStatus: onboardingResult?.instance?.status || null,
        onboardingInstanceId: onboardingResult?.instance?._id || null,
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Confirm Joining Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to confirm joining' });
  } finally {
    session.endSession();
  }
};

