const mongoose = require('mongoose');

/**
 * 🔐 BGV Email Template Model
 * 
 * Stores predefined email templates for BGV communications
 * Templates are versioned, role-restricted, and support variable injection
 * 
 * CRITICAL: BGV emails are legal communication and must be traceable
 */
const BGVEmailTemplateSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Template Identification
    emailType: {
        type: String,
        enum: [
            'DOCUMENT_PENDING',           // Candidate: Upload pending documents
            'BGV_IN_PROGRESS',            // Candidate: BGV has started
            'DISCREPANCY_RAISED',         // Candidate: Issue found in verification
            'BGV_COMPLETED_VERIFIED',     // Candidate: BGV passed
            'BGV_COMPLETED_FAILED',       // Candidate: BGV failed
            'SLA_REMINDER_VERIFIER',      // Verifier: SLA approaching
            'ESCALATION_HR_ADMIN',        // HR Admin: Escalation needed
            'VERIFICATION_SUBMITTED',     // Checker: Approval needed
            'VERIFICATION_APPROVED',      // Verifier: Your work was approved
            'VERIFICATION_REJECTED'       // Verifier: Your work was rejected
        ],
        required: true,
        index: true
    },

    // Template Content
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    subject: {
        type: String,
        required: true
    },
    htmlBody: {
        type: String,
        required: true
    },

    // Supported Variables
    supportedVariables: [{
        type: String,
        // e.g., 'candidate_name', 'bgv_case_id', 'job_title', etc.
    }],

    // Recipient Configuration
    defaultRecipientType: {
        type: String,
        enum: ['CANDIDATE', 'VERIFIER', 'HR_ADMIN', 'CHECKER', 'CUSTOM'],
        required: true
    },

    // Access Control
    allowedRoles: [{
        type: String,
        enum: ['hr', 'admin', 'company_admin', 'user', 'SYSTEM']
    }],
    canEdit: {
        type: Boolean,
        default: false // Only admins can edit by default
    },

    // Template Status
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false // System default template
    },

    // Versioning
    version: {
        type: Number,
        default: 1
    },
    previousVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BGVEmailTemplate'
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    collection: 'bgv_email_templates'
});

// Indexes
BGVEmailTemplateSchema.index({ tenant: 1, emailType: 1, isActive: 1 });
BGVEmailTemplateSchema.index({ tenant: 1, isDefault: 1 });

// Static method to get default templates
BGVEmailTemplateSchema.statics.getDefaultTemplates = function () {
    return [
        {
            emailType: 'DOCUMENT_PENDING',
            name: 'Document Pending Reminder',
            description: 'Remind candidate to upload pending documents',
            subject: 'Action Required: Upload Pending BGV Documents',
            defaultRecipientType: 'CANDIDATE',
            allowedRoles: ['hr', 'admin', 'company_admin', 'SYSTEM'],
            supportedVariables: ['candidate_name', 'bgv_case_id', 'job_title', 'pending_documents', 'sla_date'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #e67e22; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">⚠️ Action Required: BGV Documents Pending</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{candidate_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            Your Background Verification (BGV) process for the position of <strong>{{job_title}}</strong> is currently on hold due to pending documents.
                        </p>

                        <div style="background-color: #fff3e0; border-left: 5px solid #e67e22; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>SLA Date:</strong> {{sla_date}}</p>
                        </div>

                        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">Pending Documents:</p>
                            <div style="color: #555;">{{pending_documents}}</div>
                        </div>

                        <p style="color: #e74c3c; font-weight: bold; margin-top: 20px;">
                            ⏰ Please upload the required documents at the earliest to avoid delays in your onboarding process.
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            HR Team
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            `,
            isDefault: true
        },
        {
            emailType: 'BGV_IN_PROGRESS',
            name: 'BGV In Progress Notification',
            description: 'Notify candidate that BGV verification has started',
            subject: 'Your Background Verification is In Progress',
            defaultRecipientType: 'CANDIDATE',
            allowedRoles: ['hr', 'admin', 'company_admin', 'SYSTEM'],
            supportedVariables: ['candidate_name', 'bgv_case_id', 'job_title', 'bgv_status', 'sla_date'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #3498db; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">🔍 Background Verification In Progress</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{candidate_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            We are pleased to inform you that your Background Verification (BGV) for the position of <strong>{{job_title}}</strong> is now in progress.
                        </p>

                        <div style="background-color: #e3f2fd; border-left: 5px solid #3498db; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Current Status:</strong> {{bgv_status}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Expected Completion:</strong> {{sla_date}}</p>
                        </div>

                        <p style="color: #555; line-height: 1.6;">
                            Our verification team is currently reviewing your submitted documents and conducting necessary checks. We will keep you updated on the progress.
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            HR Team
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            `,
            isDefault: true
        },
        {
            emailType: 'DISCREPANCY_RAISED',
            name: 'Discrepancy Raised Notification',
            description: 'Notify candidate about discrepancy found during verification',
            subject: '⚠️ Discrepancy Found in Your Background Verification',
            defaultRecipientType: 'CANDIDATE',
            allowedRoles: ['hr', 'admin', 'company_admin'],
            supportedVariables: ['candidate_name', 'bgv_case_id', 'job_title', 'discrepancy_details'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #f39c12; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">⚠️ Discrepancy Found in BGV</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{candidate_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            During the background verification process for the position of <strong>{{job_title}}</strong>, we have identified a discrepancy that requires your attention.
                        </p>

                        <div style="background-color: #fff8e1; border-left: 5px solid #f39c12; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 10px 0 5px 0; font-weight: bold; color: #333;">Discrepancy Details:</p>
                            <div style="color: #555;">{{discrepancy_details}}</div>
                        </div>

                        <p style="color: #e74c3c; font-weight: bold;">
                            Please contact our HR team at the earliest to clarify this matter.
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            HR Team
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            `,
            isDefault: true
        },
        {
            emailType: 'BGV_COMPLETED_VERIFIED',
            name: 'BGV Completed - Verified',
            description: 'Notify candidate that BGV has been successfully completed',
            subject: '✅ Your Background Verification is Complete',
            defaultRecipientType: 'CANDIDATE',
            allowedRoles: ['hr', 'admin', 'company_admin', 'SYSTEM'],
            supportedVariables: ['candidate_name', 'bgv_case_id', 'job_title', 'completion_date'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #27ae60; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">✅ Background Verification Complete</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{candidate_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            Congratulations! We are pleased to inform you that your Background Verification (BGV) for the position of <strong>{{job_title}}</strong> has been successfully completed.
                        </p>

                        <div style="background-color: #e8f5e9; border-left: 5px solid #27ae60; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">VERIFIED ✓</span></p>
                            <p style="margin: 5px 0; color: #555;"><strong>Completion Date:</strong> {{completion_date}}</p>
                        </div>

                        <p style="color: #555; line-height: 1.6;">
                            All verification checks have been completed successfully. Our HR team will contact you shortly regarding the next steps in your onboarding process.
                        </p>

                        <p style="color: #27ae60; font-weight: bold; margin-top: 20px;">
                            Welcome to the team!
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            HR Team
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            `,
            isDefault: true
        },
        {
            emailType: 'BGV_COMPLETED_FAILED',
            name: 'BGV Completed - Failed',
            description: 'Notify candidate that BGV verification has failed',
            subject: 'Background Verification Status Update',
            defaultRecipientType: 'CANDIDATE',
            allowedRoles: ['hr', 'admin', 'company_admin'],
            supportedVariables: ['candidate_name', 'bgv_case_id', 'job_title', 'completion_date'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #e74c3c; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Background Verification Status</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{candidate_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            We regret to inform you that your Background Verification (BGV) for the position of <strong>{{job_title}}</strong> could not be completed successfully.
                        </p>

                        <div style="background-color: #ffebee; border-left: 5px solid #e74c3c; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Completion Date:</strong> {{completion_date}}</p>
                        </div>

                        <p style="color: #555; line-height: 1.6;">
                            Our HR team will contact you separately to discuss this matter further.
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            HR Team
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            `,
            isDefault: true
        },
        {
            emailType: 'SLA_REMINDER_VERIFIER',
            name: 'SLA Reminder to Verifier',
            description: 'Remind verifier about approaching SLA deadline',
            subject: '⏰ SLA Reminder: BGV Case Pending Verification',
            defaultRecipientType: 'VERIFIER',
            allowedRoles: ['SYSTEM'],
            supportedVariables: ['verifier_name', 'bgv_case_id', 'candidate_name', 'job_title', 'sla_date', 'days_remaining'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #e67e22; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">⏰ SLA Reminder: Action Required</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{verifier_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            This is a reminder that the following BGV case is approaching its SLA deadline and requires your attention.
                        </p>

                        <div style="background-color: #fff3e0; border-left: 5px solid #e67e22; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Candidate:</strong> {{candidate_name}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Position:</strong> {{job_title}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>SLA Date:</strong> {{sla_date}}</p>
                            <p style="margin: 5px 0; color: #e74c3c; font-weight: bold;"><strong>Days Remaining:</strong> {{days_remaining}}</p>
                        </div>

                        <p style="color: #e74c3c; font-weight: bold;">
                            Please complete the verification process before the SLA deadline to avoid escalation.
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            BGV System
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated system email.</p>
                    </div>
                </div>
            `,
            isDefault: true
        },
        {
            emailType: 'ESCALATION_HR_ADMIN',
            name: 'Escalation to HR Admin',
            description: 'Escalate overdue BGV case to HR Admin',
            subject: '🚨 Escalation: BGV Case Overdue - Immediate Action Required',
            defaultRecipientType: 'HR_ADMIN',
            allowedRoles: ['SYSTEM'],
            supportedVariables: ['admin_name', 'bgv_case_id', 'candidate_name', 'job_title', 'verifier_name', 'sla_date', 'days_overdue'],
            htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #c0392b; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">🚨 ESCALATION: BGV Case Overdue</h2>
                    </div>
                    <div style="padding: 25px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>{{admin_name}}</strong>,</p>
                        
                        <p style="color: #555; line-height: 1.6;">
                            The following BGV case has exceeded its SLA deadline and requires immediate attention.
                        </p>

                        <div style="background-color: #ffebee; border-left: 5px solid #c0392b; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>BGV Case ID:</strong> {{bgv_case_id}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Candidate:</strong> {{candidate_name}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Position:</strong> {{job_title}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Assigned Verifier:</strong> {{verifier_name}}</p>
                            <p style="margin: 5px 0; color: #555;"><strong>SLA Date:</strong> {{sla_date}}</p>
                            <p style="margin: 5px 0; color: #c0392b; font-weight: bold;"><strong>Days Overdue:</strong> {{days_overdue}}</p>
                        </div>

                        <p style="color: #c0392b; font-weight: bold;">
                            ⚠️ IMMEDIATE ACTION REQUIRED: Please review and reassign if necessary.
                        </p>

                        <p style="color: #888; font-size: 14px; margin-top: 30px;">
                            Best Regards,<br>
                            BGV System
                        </p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">This is an automated escalation email.</p>
                    </div>
                </div>
            `,
            isDefault: true
        }
    ];
};

module.exports = BGVEmailTemplateSchema;
