const emailService = require('./email.service');
const { getBGVModels } = require('../utils/bgvModels');

/**
 * 🔐 BGV Email Service
 * 
 * Handles all BGV-related email communications
 * Features:
 * - Template-based emails with variable injection
 * - Automatic recipient resolution
 * - Comprehensive audit logging
 * - Legal compliance tracking
 * 
 * CRITICAL: All BGV emails must be logged for legal traceability
 */
class BGVEmailService {

    /**
     * Send BGV Email
     * @param {Object} params - Email parameters
     * @param {String} params.tenantId - Tenant ID
     * @param {String} params.caseId - BGV Case ID
     * @param {String} params.emailType - Type of email
     * @param {String} params.recipientType - CANDIDATE, VERIFIER, HR_ADMIN, etc.
     * @param {String} params.customMessage - Optional custom message
     * @param {Object} params.user - User sending the email
     * @param {String} params.ipAddress - IP address
     * @param {String} params.userAgent - User agent
     * @returns {Promise<Object>} - Email send result
     */
    async sendBGVEmail(params) {
        const {
            tenantId,
            caseId,
            emailType,
            recipientType,
            customMessage,
            user,
            ipAddress,
            userAgent,
            checkId,
            customRecipientEmail,
            customRecipientName,
            additionalRecipients
        } = params;

        try {
            // Get models
            const models = await getBGVModels(tenantId);
            const { BGVCase, BGVEmailTemplate, BGVEmailLog } = models;

            // 1. Get BGV Case
            const bgvCase = await BGVCase.findById(caseId)
                .populate('candidateId')
                .populate('applicationId');

            if (!bgvCase) {
                throw new Error('BGV Case not found');
            }

            // 2. Get Email Template
            let template = await BGVEmailTemplate.findOne({
                tenant: tenantId,
                emailType,
                isActive: true
            }).sort({ version: -1 }); // Get latest version

            if (!template) {
                // Use default template
                const defaultTemplates = BGVEmailTemplate.schema.statics.getDefaultTemplates();
                const defaultTemplate = defaultTemplates.find(t => t.emailType === emailType);

                if (!defaultTemplate) {
                    throw new Error(`No template found for email type: ${emailType}`);
                }

                // IMPORTANT: Do not persist defaults here. Some Mongo providers (e.g. Cosmos DB)
                // enforce a hard collection/container limit; creating new collections breaks emailing.
                template = defaultTemplate;
            }

            // 3. Resolve Recipient
            let recipientInfo;

            if (recipientType === 'CUSTOM') {
                const customEmails = this.parseEmailList(customRecipientEmail);
                recipientInfo = {
                    email: customEmails.join(', '),
                    name: customRecipientName || (customEmails.length > 1 ? 'Custom Recipients' : 'Custom Recipient'),
                    userId: null
                };
            } else {
                recipientInfo = await this.resolveRecipient(
                    recipientType,
                    bgvCase,
                    checkId,
                    models
                );
            }

            if (!recipientInfo || !recipientInfo.email) {
                throw new Error(`Could not resolve recipient email for type: ${recipientType}`);
            }

            recipientInfo.type = recipientType;

            const baseEmails = this.parseEmailList(recipientInfo.email);
            const extraEmails = this.parseEmailList(additionalRecipients);
            const allToEmails = this.mergeEmailLists(baseEmails, extraEmails);
            const toHeader = allToEmails.join(', ');

            const templateSource = template?._id ? 'DB' : 'DEFAULT';
            const templateVersion = template?.version ?? 'DEFAULT';

            // 4. Prepare Template Variables
            const variables = await this.prepareTemplateVariables(
                bgvCase,
                recipientInfo,
                emailType,
                models,
                checkId
            );

            // 5. Inject Variables into Template
            let subject = this.injectVariables(template.subject, variables);
            let htmlBody = this.injectVariables(template.htmlBody, variables);

            // Add custom message if provided
            if (customMessage) {
                htmlBody = htmlBody.replace(
                    '</div>',
                    `<div style="background-color: #f0f8ff; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: bold; color: #333;">Additional Message:</p>
                        <p style="margin: 10px 0 0; color: #555;">${customMessage}</p>
                    </div></div>`
                );
            }

            // 6. Send Email
            try {
                const result = await emailService.sendEmail(
                    toHeader,
                    subject,
                    htmlBody
                );

                // Create the master email log entry (CRITICAL for Global Email History)
                let emailLogId = null;
                try {
                    const emailLog = await BGVEmailLog.create({
                        tenant: tenantId,
                        caseId: bgvCase._id,
                        checkId,
                        candidateId: bgvCase.candidateId?._id,
                        emailType,
                        recipientType: recipientInfo.type,
                        recipientEmail: toHeader,
                        recipientName: recipientInfo.name,
                        recipientUserId: recipientInfo.userId,
                        subject,
                        htmlBody,
                        templateId: template?._id || null,
                        templateVersion: template?.version || 1,
                        variablesInjected: variables,
                        customMessage,
                        sentBy: {
                            userId: user?._id || user?.id,
                            userName: user?.name || user?.email,
                            userRole: user?.role
                        },
                        sentBySystem: !user,
                        status: 'SENT',
                        sentAt: new Date(),
                        messageId: result.messageId,
                        ipAddress,
                        userAgent
                    });
                    emailLogId = emailLog._id;
                } catch (logErr) {
                    console.error('[BGV_EMAIL_LOG_CREATE_ERROR]', logErr);
                }

                // Create audit trail entries (best-effort; don't block a successful send)
                try {
                    await this.createEmailTimelineEntry(models, {
                        tenantId,
                        caseId: bgvCase._id,
                        checkId,
                        emailType,
                        eventType: 'EMAIL_SENT',
                        recipientInfo: { ...recipientInfo, email: toHeader },
                        user,
                        subject,
                        messageId: result.messageId,
                        to: allToEmails,
                        customMessage,
                        templateSource,
                        templateVersion,
                        ipAddress,
                        userAgent
                    });
                } catch (auditErr) {
                    console.error('[BGV_EMAIL_TIMELINE_ERROR]', auditErr);
                }

                try {
                    await BGVCase.updateOne(
                        { _id: bgvCase._id },
                        {
                            $push: {
                                logs: {
                                    action: 'EMAIL_SENT',
                                    performedBy: user?.name || user?.email || 'System',
                                    performedById: user?._id || user?.id || null,
                                    oldStatus: null,
                                    newStatus: null,
                                    remarks: `Email sent (${emailType}) to ${toHeader}`,
                                    timestamp: new Date(),
                                    ip: ipAddress || null,
                                    userAgent: userAgent || null,
                                    metadata: {
                                        emailType,
                                        recipientType: recipientInfo.type,
                                        subject,
                                        messageId: result.messageId,
                                        to: allToEmails,
                                        additionalRecipients: extraEmails,
                                        templateSource,
                                        templateVersion,
                                        variablesInjected: variables,
                                        customMessage: customMessage || null
                                    }
                                }
                            }
                        }
                    );
                } catch (auditErr) {
                    console.error('[BGV_EMAIL_CASELOG_ERROR]', auditErr);
                }

                console.log(`✅ [BGV_EMAIL_SERVICE] Email sent successfully: ${emailType} to ${toHeader}`);

                return {
                    success: true,
                    emailLogId: emailLogId,
                    messageId: result.messageId,
                    recipientEmail: toHeader
                };

            } catch (sendError) {
                // Best-effort logging for failed attempt in master log
                try {
                    await BGVEmailLog.create({
                        tenant: tenantId,
                        caseId: bgvCase._id,
                        checkId,
                        candidateId: bgvCase.candidateId?._id,
                        emailType,
                        recipientType: recipientInfo.type,
                        recipientEmail: toHeader,
                        recipientName: recipientInfo.name,
                        recipientUserId: recipientInfo.userId,
                        subject,
                        htmlBody,
                        templateId: template?._id || null,
                        templateVersion: template?.version || 1,
                        variablesInjected: variables,
                        customMessage,
                        sentBy: {
                            userId: user?._id || user?.id,
                            userName: user?.name || user?.email,
                            userRole: user?.role
                        },
                        sentBySystem: !user,
                        status: 'FAILED',
                        failureReason: sendError.message,
                        ipAddress,
                        userAgent
                    });
                } catch (logErr) {
                    console.error('[BGV_EMAIL_LOG_CREATE_FAILED_ERROR]', logErr);
                }

                // Best-effort logging for failed attempt in timeline
                try {
                    await this.createEmailTimelineEntry(models, {
                        tenantId,
                        caseId: bgvCase._id,
                        checkId,
                        emailType,
                        eventType: 'EMAIL_FAILED',
                        recipientInfo: { ...recipientInfo, email: toHeader },
                        user,
                        subject,
                        to: allToEmails,
                        customMessage,
                        templateSource,
                        templateVersion,
                        errorMessage: sendError.message,
                        ipAddress,
                        userAgent
                    });
                } catch (auditErr) {
                    console.error('[BGV_EMAIL_TIMELINE_ERROR]', auditErr);
                }

                try {
                    await BGVCase.updateOne(
                        { _id: bgvCase._id },
                        {
                            $push: {
                                logs: {
                                    action: 'EMAIL_FAILED',
                                    performedBy: user?.name || user?.email || 'System',
                                    performedById: user?._id || user?.id || null,
                                    oldStatus: null,
                                    newStatus: null,
                                    remarks: `Email failed (${emailType}) to ${toHeader}: ${sendError.message}`,
                                    timestamp: new Date(),
                                    ip: ipAddress || null,
                                    userAgent: userAgent || null,
                                    metadata: {
                                        emailType,
                                        recipientType: recipientInfo.type,
                                        subject,
                                        to: allToEmails,
                                        additionalRecipients: extraEmails,
                                        templateSource,
                                        templateVersion,
                                        variablesInjected: variables,
                                        customMessage: customMessage || null,
                                        errorMessage: sendError.message
                                    }
                                }
                            }
                        }
                    );
                } catch (auditErr) {
                    console.error('[BGV_EMAIL_CASELOG_ERROR]', auditErr);
                }

                throw sendError;
            }

        } catch (error) {
            console.error('[BGV_EMAIL_SERVICE] Error:', error);
            throw error;
        }
    }

    /**
     * Parse a list of emails coming from UI or model
     * Accepts: string (comma/semicolon separated) or array of strings.
     * Returns: de-duplicated list in original order.
     */
    parseEmailList(raw) {
        if (!raw) return [];

        const items = Array.isArray(raw)
            ? raw
            : String(raw).split(/[;,]/);

        const emails = items
            .map(e => String(e || '').trim())
            .filter(Boolean);

        const invalid = [];
        const valid = [];

        for (const email of emails) {
            // Prevent header injection & obvious bad inputs
            if (email.includes('\n') || email.includes('\r')) {
                invalid.push(email);
                continue;
            }

            const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            if (!ok) invalid.push(email);
            else valid.push(email);
        }

        if (invalid.length > 0) {
            const err = new Error(`Invalid email address(es): ${invalid.join(', ')}`);
            err.status = 400;
            err.error = 'invalid_email';
            throw err;
        }

        const seen = new Set();
        const unique = [];
        for (const email of valid) {
            const key = email.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(email);
        }

        if (unique.length > 10) {
            const err = new Error('Too many recipient emails (max 10).');
            err.status = 400;
            err.error = 'too_many_recipients';
            throw err;
        }

        return unique;
    }

    mergeEmailLists(primary = [], extra = []) {
        const seen = new Set();
        const out = [];

        for (const email of [...primary, ...extra]) {
            const key = String(email).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(email);
        }

        return out;
    }

    /**
     * Resolve recipient based on type
     */
    async resolveRecipient(recipientType, bgvCase, checkId, models) {
        const { BGVCheck } = models;

        switch (recipientType) {
            case 'CANDIDATE':
                const candidate = bgvCase.candidateId;
                return {
                    email: candidate?.email,
                    name: candidate?.name,
                    userId: candidate?._id
                };

            case 'VERIFIER':
                if (checkId) {
                    const check = await BGVCheck.findById(checkId).populate('assignedTo');
                    return {
                        email: check?.assignedTo?.email,
                        name: check?.assignedTo?.name,
                        userId: check?.assignedTo?._id
                    };
                }
                // If no specific check, use case assignedTo
                return {
                    email: bgvCase.assignedTo?.email,
                    name: bgvCase.assignedTo?.name,
                    userId: bgvCase.assignedTo?._id
                };

            case 'HR_ADMIN':
                // Get HR admin from tenant settings or default
                // For now, return the user who initiated the case
                return {
                    email: process.env.HR_ADMIN_EMAIL || process.env.SMTP_USER,
                    name: 'HR Admin',
                    userId: null
                };

            case 'CHECKER':
                // Get checker/approver
                if (checkId) {
                    const check = await BGVCheck.findById(checkId).populate('verificationWorkflow.approvedBy');
                    return {
                        email: check?.verificationWorkflow?.approvedBy?.email,
                        name: check?.verificationWorkflow?.approvedBy?.name,
                        userId: check?.verificationWorkflow?.approvedBy?._id
                    };
                }
                return null;

            default:
                return null;
        }
    }

    /**
     * Prepare template variables
     */
    async prepareTemplateVariables(bgvCase, recipientInfo, emailType, models, checkId) {
        const { BGVCheck, BGVDocument } = models;

        const variables = {
            candidate_name: bgvCase.candidateId?.name || 'Candidate',
            bgv_case_id: bgvCase.caseId || bgvCase._id.toString(),
            job_title: bgvCase.applicationId?.jobTitle || 'Position',
            bgv_status: bgvCase.overallStatus || 'IN_PROGRESS',
            sla_date: bgvCase.slaDate ? new Date(bgvCase.slaDate).toLocaleDateString('en-GB') : 'N/A',
            completion_date: bgvCase.completedAt ? new Date(bgvCase.completedAt).toLocaleDateString('en-GB') : 'N/A'
        };

        // Add recipient-specific variables
        if (recipientInfo) {
            variables.verifier_name = recipientInfo.name || 'Verifier';
            variables.admin_name = recipientInfo.name || 'Admin';
        }

        // Add email-type specific variables
        if (emailType === 'DOCUMENT_PENDING') {
            // Get pending documents
            const checks = await BGVCheck.find({ caseId: bgvCase._id });
            const pendingDocs = [];

            for (const check of checks) {
                if (check.evidenceStatus?.missingDocumentTypes?.length > 0) {
                    pendingDocs.push(`<strong>${check.type}:</strong> ${check.evidenceStatus.missingDocumentTypes.join(', ')}`);
                }
            }

            variables.pending_documents = pendingDocs.length > 0
                ? pendingDocs.join('<br>')
                : 'Please check the BGV portal for details';
        }

        if (emailType === 'DISCREPANCY_RAISED' && checkId) {
            const check = await BGVCheck.findById(checkId);
            variables.discrepancy_details = check?.internalRemarks || 'Please contact HR for details';
        }

        if (emailType === 'SLA_REMINDER_VERIFIER' || emailType === 'ESCALATION_HR_ADMIN') {
            const slaDate = new Date(bgvCase.slaDate);
            const today = new Date();
            const daysRemaining = Math.ceil((slaDate - today) / (1000 * 60 * 60 * 24));

            variables.days_remaining = daysRemaining > 0 ? daysRemaining : 0;
            variables.days_overdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;
        }

        return variables;
    }

    /**
     * Inject variables into template
     */
    injectVariables(template, variables) {
        let result = template;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || '');
        }

        return result;
    }

    /**
     * Create immutable audit timeline entry for BGV email
     */
    async createEmailTimelineEntry(models, params) {
        const { BGVTimeline } = models;
        const {
            tenantId,
            caseId,
            checkId,
            emailType,
            eventType,
            recipientInfo,
            user,
            subject,
            messageId,
            to,
            customMessage,
            templateSource,
            templateVersion,
            errorMessage,
            ipAddress,
            userAgent
        } = params || {};

        const emailTypeLabels = {
            DOCUMENT_PENDING: 'Document Pending Reminder',
            BGV_IN_PROGRESS: 'BGV In Progress Notification',
            DISCREPANCY_RAISED: 'Discrepancy Notification',
            BGV_COMPLETED_VERIFIED: 'BGV Completed - Verified',
            BGV_COMPLETED_FAILED: 'BGV Completed - Failed',
            SLA_REMINDER_VERIFIER: 'SLA Reminder',
            ESCALATION_HR_ADMIN: 'Escalation Email',
            VERIFICATION_SUBMITTED: 'Verification Submitted',
            VERIFICATION_APPROVED: 'Verification Approved',
            VERIFICATION_REJECTED: 'Verification Rejected'
        };

        const label = emailTypeLabels[emailType] || emailType;
        const isFailed = eventType === 'EMAIL_FAILED';
        const baseDescription = `${isFailed ? 'Email failed' : 'Email sent'} to ${recipientInfo?.name || recipientInfo?.email || 'Recipient'} (${recipientInfo?.email || 'N/A'})`;
        const description = isFailed && errorMessage
            ? `${baseDescription} - ${errorMessage}`
            : baseDescription;

        const toList = Array.isArray(to)
            ? to
            : (to ? [String(to)] : []);

        await BGVTimeline.create({
            tenant: tenantId,
            caseId,
            checkId,
            eventType: eventType || 'EMAIL_SENT',
            title: `${isFailed ? 'Email Failed' : 'Email Sent'}: ${label}`,
            description,
            performedBy: {
                userId: user?._id || user?.id,
                userName: user?.name || user?.email || 'System',
                userRole: user?.role || 'SYSTEM',
                userEmail: user?.email || null
            },
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            metadata: {
                emailType,
                subject: subject || null,
                messageId: messageId || null,
                to: toList,
                recipientEmail: recipientInfo?.email || null,
                recipientName: recipientInfo?.name || null,
                recipientType: recipientInfo?.type || null,
                customMessage: customMessage || null,
                templateSource: templateSource || null,
                templateVersion: templateVersion ?? null,
                errorMessage: errorMessage || null
            }
        });
    }

    /**
     * Get email history for a BGV case
     */
    async getEmailHistory(tenantId, caseId) {
        const models = await getBGVModels(tenantId);
        const { BGVEmailLog, BGVTimeline, BGVCase } = models;

        // Prefer the dedicated email log collection if it exists and has data.
        // If the environment enforces a collection/container limit, we fall back to timeline/case logs.
        try {
            const emails = await BGVEmailLog.find({ caseId })
                .sort({ createdAt: -1 })
                .populate('sentBy.userId', 'name email')
                .lean();

            if (emails && emails.length > 0) return emails;
        } catch (err) {
            console.error('[BGV_EMAIL_HISTORY_LOG_ERROR]', err);
        }

        try {
            const timeline = await BGVTimeline.find({
                caseId,
                eventType: { $in: ['EMAIL_SENT', 'EMAIL_FAILED'] }
            })
                .sort({ timestamp: -1 })
                .lean();

            if (timeline && timeline.length > 0) {
                return timeline.map(ev => ({
                    _id: ev._id,
                    emailType: ev.metadata?.emailType,
                    recipientType: ev.metadata?.recipientType,
                    recipientEmail: Array.isArray(ev.metadata?.to) ? ev.metadata.to.join(', ') : ev.metadata?.recipientEmail,
                    subject: ev.metadata?.subject,
                    status: ev.eventType === 'EMAIL_FAILED' ? 'FAILED' : 'SENT',
                    sentAt: ev.timestamp,
                    failureReason: ev.metadata?.errorMessage,
                    messageId: ev.metadata?.messageId,
                    customMessage: ev.metadata?.customMessage,
                    metadata: ev.metadata
                }));
            }
        } catch (err) {
            console.error('[BGV_EMAIL_HISTORY_TIMELINE_ERROR]', err);
        }

        try {
            const bgvCase = await BGVCase.findById(caseId).select('logs').lean();
            const logs = Array.isArray(bgvCase?.logs) ? bgvCase.logs : [];
            const emailLogs = logs
                .filter(l => ['EMAIL_SENT', 'EMAIL_FAILED'].includes(l.action))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return emailLogs.map(l => ({
                emailType: l.metadata?.emailType,
                recipientType: l.metadata?.recipientType,
                recipientEmail: Array.isArray(l.metadata?.to) ? l.metadata.to.join(', ') : null,
                subject: l.metadata?.subject,
                status: l.action === 'EMAIL_FAILED' ? 'FAILED' : 'SENT',
                sentAt: l.timestamp,
                failureReason: l.metadata?.errorMessage,
                messageId: l.metadata?.messageId,
                customMessage: l.metadata?.customMessage,
                metadata: l.metadata
            }));
        } catch (err) {
            console.error('[BGV_EMAIL_HISTORY_CASELOG_ERROR]', err);
        }

        return [];
    }

    /**
     * Validate email permissions
     */
    validateEmailPermissions(emailType, userRole, bgvCase) {
        // CANDIDATE emails cannot be sent after BGV closure (except final status)
        if (bgvCase.isClosed && !['BGV_COMPLETED_VERIFIED', 'BGV_COMPLETED_FAILED'].includes(emailType)) {
            throw new Error('Cannot send emails to candidate after BGV case is closed');
        }

        // SLA emails are system-triggered only
        if (['SLA_REMINDER_VERIFIER', 'ESCALATION_HR_ADMIN'].includes(emailType) && userRole !== 'SYSTEM') {
            throw new Error('SLA emails can only be triggered by the system');
        }

        // Custom emails allowed only for HR Admin
        if (emailType === 'CUSTOM' && !['admin', 'company_admin'].includes(userRole)) {
            throw new Error('Custom emails are restricted to HR Admins');
        }

        return true;
    }
}

module.exports = new BGVEmailService();
