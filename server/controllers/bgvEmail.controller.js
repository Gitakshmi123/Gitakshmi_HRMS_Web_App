const { getBGVModels } = require('../utils/bgvModels');
const bgvEmailService = require('../services/bgvEmail.service');

/**
 * 🔐 BGV Email Controller
 * 
 * Handles BGV email-related API endpoints
 * All emails are logged for compliance and legal traceability
 */

/**
 * Send BGV Email
 * POST /api/bgv/:caseId/send-email
 */
exports.sendEmail = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const {
            emailType,
            recipientType,
            customMessage,
            checkId,
            customRecipientEmail,
            customRecipientName,
            additionalRecipients
        } = req.body;

        // Validate required fields
        if (!emailType) {
            return res.status(400).json({
                success: false,
                message: 'Email type is required'
            });
        }

        if (!recipientType) {
            return res.status(400).json({
                success: false,
                message: 'Recipient type is required'
            });
        }

        if (recipientType === 'CUSTOM' && !customRecipientEmail) {
            return res.status(400).json({
                success: false,
                message: 'Custom recipient email is required'
            });
        }

        // Get BGV Case to validate permissions
        const { BGVCase } = await getBGVModels(req);
        const bgvCase = await BGVCase.findById(caseId);

        if (!bgvCase) {
            return res.status(404).json({
                success: false,
                message: 'BGV Case not found'
            });
        }

        // Validate permissions
        try {
            bgvEmailService.validateEmailPermissions(
                emailType,
                req.user?.role || 'user',
                bgvCase
            );
        } catch (permError) {
            return res.status(403).json({
                success: false,
                message: permError.message
            });
        }

        // Send email
        const result = await bgvEmailService.sendBGVEmail({
            tenantId: req.tenantId,
            caseId,
            checkId,
            emailType,
            recipientType,
            customRecipientEmail,
            customRecipientName,
            additionalRecipients,
            customMessage,
            user: req.user,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Email sent successfully',
            data: result
        });

    } catch (err) {
        console.error('[BGV_SEND_EMAIL_ERROR]', err);
        next(err);
    }
};

/**
 * Get Email History for BGV Case
 * GET /api/bgv/:caseId/email-history
 */
exports.getEmailHistory = async (req, res, next) => {
    try {
        const { caseId } = req.params;

        const emails = await bgvEmailService.getEmailHistory(
            req.tenantId,
            caseId
        );

        res.json({
            success: true,
            data: emails
        });

    } catch (err) {
        console.error('[BGV_GET_EMAIL_HISTORY_ERROR]', err);
        next(err);
    }
};

/**
 * Get Global Email History for Tenant
 * GET /api/bgv/email-history-global
 */
exports.getGlobalEmailHistory = async (req, res, next) => {
    try {
        const { BGVEmailLog, BGVTimeline } = await getBGVModels(req);

        // 1. Fetch from dedicated email logs first
        let emails = await BGVEmailLog.find({
            tenant: req.tenantId
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // 2. Fallback: If logs are empty (e.g. legacy data), aggregate from Timeline
        if (!emails || emails.length === 0) {
            // console.log('[DEBUG] Global Email Logs empty, falling back to Timeline aggregation...');
            const timelineEvents = await BGVTimeline.find({
                tenant: req.tenantId,
                eventType: { $in: ['EMAIL_SENT', 'EMAIL_FAILED'] }
            })
                .sort({ timestamp: -1 })
                .limit(100)
                .lean();

            emails = timelineEvents.map(ev => ({
                _id: ev._id,
                emailType: ev.metadata?.emailType || 'UKNOWN',
                recipientType: ev.metadata?.recipientType || 'N/A',
                recipientEmail: Array.isArray(ev.metadata?.to) ? ev.metadata.to.join(', ') : ev.metadata?.recipientEmail,
                subject: ev.metadata?.subject || ev.title,
                status: ev.eventType === 'EMAIL_FAILED' ? 'FAILED' : 'SENT',
                sentAt: ev.timestamp || ev.createdAt,
                failureReason: ev.metadata?.errorMessage,
                messageId: ev.metadata?.messageId,
                customMessage: ev.metadata?.customMessage,
                isLegacy: true // Internal flag
            }));
        }

        res.json({
            success: true,
            data: emails
        });

    } catch (err) {
        console.error('[BGV_GET_GLOBAL_EMAIL_HISTORY_ERROR]', err);
        next(err);
    }
};

/**
 * Get Available Email Templates
 * GET /api/bgv/email-templates
 */
exports.getEmailTemplates = async (req, res, next) => {
    try {
        const { BGVEmailTemplate } = await getBGVModels(req);

        const templates = await BGVEmailTemplate.find({
            tenant: req.tenantId,
            isActive: true
        }).sort({ emailType: 1, version: -1 });

        // Group by emailType and get latest version
        const templateMap = new Map();
        templates.forEach(template => {
            if (!templateMap.has(template.emailType)) {
                templateMap.set(template.emailType, template);
            }
        });

        const latestTemplates = Array.from(templateMap.values());

        res.json({
            success: true,
            data: latestTemplates
        });

    } catch (err) {
        console.error('[BGV_GET_EMAIL_TEMPLATES_ERROR]', err);
        next(err);
    }
};

/**
 * Get Email Template by Type
 * GET /api/bgv/email-template/:emailType
 */
exports.getEmailTemplateByType = async (req, res, next) => {
    try {
        const { emailType } = req.params;
        const { BGVEmailTemplate } = await getBGVModels(req);

        let template = await BGVEmailTemplate.findOne({
            tenant: req.tenantId,
            emailType,
            isActive: true
        }).sort({ version: -1 });

        // If no custom template, return default
        if (!template) {
            const defaultTemplates = BGVEmailTemplate.schema.statics.getDefaultTemplates();
            const defaultTemplate = defaultTemplates.find(t => t.emailType === emailType);

            if (defaultTemplate) {
                template = defaultTemplate;
            }
        }

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        res.json({
            success: true,
            data: template
        });

    } catch (err) {
        console.error('[BGV_GET_EMAIL_TEMPLATE_ERROR]', err);
        next(err);
    }
};

/**
 * Create/Update Email Template
 * POST /api/bgv/email-template
 * (Admin only)
 */
exports.createOrUpdateEmailTemplate = async (req, res, next) => {
    try {
        const { emailType, name, description, subject, htmlBody, supportedVariables } = req.body;

        // Only admins and HR can create/update templates
        const userRole = (req.user?.role || '').toLowerCase();
        if (!['hr', 'admin', 'company_admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Only HR or Admins can create or update email templates'
            });
        }

        const { BGVEmailTemplate } = await getBGVModels(req);

        // Check if template exists
        const existingTemplate = await BGVEmailTemplate.findOne({
            tenant: req.tenantId,
            emailType,
            isActive: true
        }).sort({ version: -1 });

        let newTemplate;

        if (existingTemplate) {
            // Create new version
            newTemplate = await BGVEmailTemplate.create({
                tenant: req.tenantId,
                emailType,
                name,
                description,
                subject,
                htmlBody,
                supportedVariables,
                defaultRecipientType: existingTemplate.defaultRecipientType,
                allowedRoles: existingTemplate.allowedRoles,
                version: existingTemplate.version + 1,
                previousVersionId: existingTemplate._id,
                isActive: true,
                isDefault: false,
                createdBy: req.user._id || req.user.id,
                updatedBy: req.user._id || req.user.id
            });

            // Deactivate old version
            existingTemplate.isActive = false;
            await existingTemplate.save();

        } else {
            // Create new template
            newTemplate = await BGVEmailTemplate.create({
                tenant: req.tenantId,
                emailType,
                name,
                description,
                subject,
                htmlBody,
                supportedVariables,
                defaultRecipientType: 'CANDIDATE',
                allowedRoles: ['hr', 'admin', 'company_admin'],
                version: 1,
                isActive: true,
                isDefault: false,
                createdBy: req.user._id || req.user.id,
                updatedBy: req.user._id || req.user.id
            });
        }

        res.json({
            success: true,
            message: 'Email template created/updated successfully',
            data: newTemplate
        });

    } catch (err) {
        console.error('[BGV_CREATE_EMAIL_TEMPLATE_ERROR]', err);
        next(err);
    }
};

/**
 * Delete Email Template
 * DELETE /api/bgv/email-template/:id
 */
exports.deleteEmailTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { BGVEmailTemplate } = await getBGVModels(req);

        const result = await BGVEmailTemplate.findOneAndDelete({
            _id: id,
            tenant: req.tenantId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        res.json({
            success: true,
            message: 'Template removed successfully'
        });

    } catch (err) {
        console.error('[BGV_DELETE_EMAIL_TEMPLATE_ERROR]', err);
        next(err);
    }
};

/**
 * Initialize Default Email Templates
 * POST /api/bgv/email-templates/initialize
 * (Admin only - run once per tenant)
 */
exports.initializeDefaultTemplates = async (req, res, next) => {
    try {
        // console.log('[DEBUG] Initializing templates for tenant:', req.tenantId);
        // Only HR/Admins can initialize templates
        if (!['hr', 'admin', 'company_admin'].includes(req.user?.role)) {
            console.warn('[DEBUG] Permission denied for role:', req.user?.role);
            return res.status(403).json({
                success: false,
                message: 'Only HR or Admins can initialize email templates'
            });
        }

        const { BGVEmailTemplate } = await getBGVModels(req);

        // Check if templates already exist
        const existingCount = await BGVEmailTemplate.countDocuments({
            tenant: req.tenantId,
            isActive: true
        });

        if (existingCount > 0) {
            // console.log('[DEBUG] Templates already exist:', existingCount);
            return res.status(400).json({
                success: false,
                message: 'Email templates already initialized for this tenant'
            });
        }

        // Get default templates
        // console.log('[DEBUG] Fetching default templates from schema...');
        const defaultTemplates = BGVEmailTemplate.getDefaultTemplates ?
            BGVEmailTemplate.getDefaultTemplates() :
            BGVEmailTemplate.schema.statics.getDefaultTemplates();

        if (!defaultTemplates || !Array.isArray(defaultTemplates)) {
            throw new Error('Default templates not found or invalid format');
        }

        // Create all default templates
        const createdTemplates = [];
        for (const template of defaultTemplates) {
            const newTemplate = await BGVEmailTemplate.create({
                tenant: req.tenantId,
                ...template,
                createdBy: req.user?._id || req.user?.id,
                updatedBy: req.user?._id || req.user?.id
            });
            createdTemplates.push(newTemplate);
        }

        // console.log(`[DEBUG] Successfully initialized ${createdTemplates.length} templates`);
        res.json({
            success: true,
            message: `${createdTemplates.length} default email templates initialized successfully`,
            data: createdTemplates
        });

    } catch (err) {
        console.error('[BGV_INITIALIZE_TEMPLATES_ERROR]', err);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize templates: ' + err.message
        });
    }
};

module.exports = {
    sendEmail: exports.sendEmail,
    getEmailHistory: exports.getEmailHistory,
    getGlobalEmailHistory: exports.getGlobalEmailHistory,
    getEmailTemplates: exports.getEmailTemplates,
    getEmailTemplateByType: exports.getEmailTemplateByType,
    createOrUpdateEmailTemplate: exports.createOrUpdateEmailTemplate,
    deleteEmailTemplate: exports.deleteEmailTemplate,
    initializeDefaultTemplates: exports.initializeDefaultTemplates
};
