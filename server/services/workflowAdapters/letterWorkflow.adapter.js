const emailService = require('../email.service');
const path = require('path');
const fs = require('fs');

function resolveUploadedLetterPath(letter) {
  const relativePath = (letter.signedPdfPath || letter.pdfPath || '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
  const cleanPath = relativePath.startsWith('uploads/') ? relativePath.replace(/^uploads\//, '') : relativePath;
  return path.join(__dirname, '..', '..', 'uploads', cleanPath);
}

async function notifyCandidate({ tenantDB, tenantId, letter, applicant, isOffer, status, comment }) {
  try {
    const CompanyProfile = tenantDB.model('CompanyProfile');
    const company = await CompanyProfile.findOne({ tenantId });
    const companyName = company?.companyName || 'Gitakshmi Technologies';
    const jobTitle = applicant.requirementId?.jobTitle || 'Role';

    if (status === 'APPROVED') {
      const attachmentPath = resolveUploadedLetterPath(letter);

      if (isOffer) {
        if (applicant.email) {
          await emailService.sendOfferLetterEmail(
            applicant.email,
            applicant.name,
            jobTitle,
            companyName,
            attachmentPath,
            null, // customHtml
            applicant, // applicant
            tenantId // tenantId
          );
        }

        if (applicant.candidateId) {
          const Notification = tenantDB.model('Notification');
          if (Notification) {
            await Notification.create({
              tenant: tenantId,
              receiverId: applicant.candidateId,
              receiverRole: 'candidate',
              entityType: 'OfferLetter',
              entityId: letter._id,
              title: 'Offer Letter Issued',
              message: `Congratulations! Your offer letter for ${jobTitle} has been issued. Please check your email or download it from here.`,
              isRead: false
            });
          }
        }
      } else {
        // Joining letter
        if (applicant.email) {
          const joiningDateStr = applicant.customData?.joiningDate || letter.snapshotData?.get?.('joiningDate') || 'N/A';
          await emailService.sendJoiningLetterEmail(
            applicant.email,
            applicant.name,
            jobTitle,
            companyName,
            joiningDateStr,
            attachmentPath,
            tenantId
          );
        }

        if (applicant.candidateId) {
          const Notification = tenantDB.model('Notification');
          if (Notification) {
            await Notification.create({
              tenant: tenantId,
              receiverId: applicant.candidateId,
              receiverRole: 'candidate',
              entityType: 'JoiningLetter',
              entityId: letter._id,
              title: 'Joining Letter Issued',
              message: `Congratulations! Your joining letter for ${jobTitle} has been issued. Please check your email or download it from here.`,
              isRead: false
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('⚠️ [LETTER ADAPTER] Email/Notification dispatch failed:', err.message);
  }
}

async function finalizeLetterWorkflow({
  tenantDB,
  tenantId,
  entityId,
  status,
  actorEmployeeId,
  actorUserId,
  comment = '',
}) {
  const GeneratedLetter = tenantDB.model('GeneratedLetter');
  const Applicant = tenantDB.model('Applicant');

  const letter = await GeneratedLetter.findOne({ _id: entityId, tenant: tenantId });
  if (!letter) {
    throw new Error('Generated letter not found for workflow finalization.');
  }

  // Update letter tracking fields
  letter.workflowStatus = status;
  letter.approvalStatus = status;

  if (status === 'APPROVED') {
    letter.status = 'approved';
    letter.companyApproval = {
      approvedBy: actorUserId || null,
      approvedAt: new Date(),
      isApproved: true,
      signatureImage: '',
      stampImage: ''
    };
  } else if (status === 'REJECTED') {
    letter.status = 'rejected';
  }

  await letter.save();

  // If there is an associated applicant, update candidate/applicant state
  if (letter.applicantId) {
    const applicant = await Applicant.findById(letter.applicantId).populate('requirementId');
    if (applicant) {
      const isOffer = String(letter.letterType).toLowerCase().includes('offer');

      if (status === 'APPROVED') {
        if (isOffer) {
          applicant.status = 'Offer Issued';
          applicant.offerStatus = 'SENT';
        } else {
          applicant.status = 'Joining Letter Approved';
          applicant.joiningLetterStatus = 'pending'; // Candidate needs to sign/accept it
        }

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
          status: isOffer ? 'Offer Issued' : 'Joining Letter Approved',
          message: `${isOffer ? 'Offer' : 'Joining'} Letter approved via recruitment workflow engine and issued to candidate.`,
          updatedBy: 'Workflow Engine',
          timestamp: new Date()
        });

        await applicant.save();

        // Send email and notifications in the background
        setImmediate(async () => {
          await notifyCandidate({
            tenantDB,
            tenantId,
            letter,
            applicant,
            isOffer,
            status,
            comment
          });
        });

      } else if (status === 'REJECTED') {
        if (isOffer) {
          applicant.status = 'Offer Rejected';
          applicant.offerStatus = 'REJECTED';
        } else {
          applicant.status = 'Joining Letter Rejected';
          applicant.joiningLetterStatus = 'rejected';
        }

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
          status: isOffer ? 'Offer Rejected' : 'Joining Letter Rejected',
          message: `❌ ${isOffer ? 'Offer' : 'Joining'} Letter rejected via recruitment workflow engine. Reason: ${comment || 'No reason provided'}.`,
          updatedBy: 'Workflow Engine',
          timestamp: new Date()
        });

        await applicant.save();
      }
    }
  }

  return letter;
}

module.exports = {
  finalizeLetterWorkflow,
};
