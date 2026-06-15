require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { getModels } = require('../utils/tenantUtils');
const { getWorkflowModels } = require('../services/workflowRuntimeCore.service');
const emailService = require('../services/email.service');
const path = require('path');

async function testFinalApproval() {
    await mongoose.connect(process.env.MONGO_URI);
    const tenantId = '6a0c43ab3245aa33f5c2a410';
    const tenantDB = await getTenantDB(tenantId);
    
    // Simulate req
    const req = { tenantDB };
    const token = '6a0c43ab3245aa33f5c2a410_2272bc785aba4da49acaabbd2205eed7';
    
    const { WorkflowAssignment, WorkflowInstance } = getWorkflowModels(req.tenantDB);
    const { GeneratedLetter, Applicant } = getModels(req);

    const assignment = await WorkflowAssignment.findOne({ magicToken: token });
    if (!assignment) {
        console.log('Assignment not found');
        return;
    }
    console.log('Found assignment for step:', assignment.stepName);
    
    const instance = await WorkflowInstance.findById(assignment.instanceId);
    const letter = await GeneratedLetter.findById(instance.entityId);
    
    // Let's run the CEO approval block
    console.log('Running final approval block...');
    
    try {
        instance.status = 'APPROVED';
        await instance.save();

        letter.workflowStatus = 'APPROVED';
        letter.approvalStatus = 'APPROVED';
        letter.status = 'generated';
        await letter.save();

        const applicant = await Applicant.findById(instance.contextSnapshot.applicantId).populate('requirementId');
        if (applicant) {
            applicant.status = 'Offer Issued';
            applicant.offerStatus = 'SENT';
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
                status: 'Offer Issued',
                message: 'Offer letter has been approved by CEO and sent to candidate.',
                updatedBy: 'System',
                timestamp: new Date()
            });
            await applicant.save();

            const { CompanyProfile, Notification } = getModels(req);
            const companyProfile = await CompanyProfile.findOne({ tenantId: instance.tenantId });
            const companyName = companyProfile?.companyName || 'Gitakshmi Technologies';
            
            const pdfPath = path.isAbsolute(letter.pdfPath) ? letter.pdfPath : path.join(__dirname, '../uploads', letter.pdfPath);

            console.log('Sending email...');
            if (applicant.email) {
                await emailService.sendOfferLetterEmail(
                    applicant.email,
                    applicant.name,
                    applicant.requirementId?.jobTitle || 'Role',
                    companyName,
                    pdfPath
                );
            }
            console.log('Email sent successfully');

            if (applicant.candidateId && Notification) {
                await Notification.create({
                    tenant: instance.tenantId,
                    receiverId: applicant.candidateId,
                    receiverRole: 'candidate',
                    entityType: 'OfferLetter',
                    entityId: letter._id,
                    title: 'Offer Letter Issued',
                    message: `Congratulations! Your offer letter for ${applicant.requirementId?.jobTitle || 'Role'} has been issued.`,
                    isRead: false
                });
            }
            console.log('SUCCESS!');
        }
    } catch (e) {
        console.error('ERROR CAUGHT:', e);
    }
    
    await mongoose.disconnect();
}

testFinalApproval().catch(console.error);
