/**
 * EMAIL NOTIFICATION SERVICE
 * 
 * Handles professional, legally-safe email notifications for:
 * - Offer letter assignment
 * - Offer letter revocation
 * - Letter status updates
 * 
 * Features:
 * ✅ Template-based emails (professional, compliant)
 * ✅ Retry logic for failed deliveries
 * ✅ Email logging and tracking
 * ✅ Multi-tenant support
 * ✅ Dynamic placeholders
 */

const nodemailer = require('nodemailer');

class EmailNotificationService {
    constructor(config = {}) {
        this.config = config || {};
        this.transporter = this.initializeTransporter();
        this.maxRetries = 3;
        this.retryDelayMs = 2000;
    }

    /**
     * Initialize email transporter
     */
    initializeTransporter() {
        if (!this.config.emailService) {
            console.warn('⚠️ [EMAIL] Email service not configured - notifications will be logged only');
            return null;
        }

        try {
            return nodemailer.createTransport(this.config.emailService);
        } catch (error) {
            console.error('❌ [EMAIL] Failed to initialize transporter:', error.message);
            return null;
        }
    }

    /**
     * SEND OFFER ASSIGNMENT EMAIL
     * Professional notification when offer is assigned to candidate
     */
    async sendOfferAssignmentEmail(recipientData) {
        const emailData = {
            to: recipientData.email,
            subject: 'Your Offer Letter - Action Required',
            template: 'offer_assignment',
            context: {
                recipientName: recipientData.name,
                positionTitle: recipientData.positionTitle || 'Position',
                companyName: recipientData.companyName || 'Our Company',
                offerValidUntil: recipientData.offerValidUntil || 'As specified',
                ctcAmount: recipientData.ctcAmount || 'N/A',
                joiningDate: recipientData.joiningDate || 'To be advised',
                hrContactName: recipientData.hrContactName || 'HR Team',
                hrContactEmail: recipientData.hrContactEmail || 'hr@company.com',
                offerLink: recipientData.offerLink || '#',
                accessToken: recipientData.accessToken || '',
                actionUrl: recipientData.actionUrl || '#'
            }
        };

        return this.sendEmailWithRetry(emailData, recipientData.tenantId);
    }

    /**
     * SEND OFFER REVOCATION EMAIL
     * Professional notification when offer is revoked
     * Legally safe, non-accusatory wording
     */
    async sendOfferRevocationEmail(recipientData) {
        const emailData = {
            to: recipientData.email,
            subject: 'Important Update - Your Offer Letter',
            template: 'offer_revocation',
            context: {
                recipientName: recipientData.name,
                positionTitle: recipientData.positionTitle || 'Position',
                companyName: recipientData.companyName || 'Our Company',
                revocationDate: new Date().toLocaleDateString('en-IN'),
                revocationReason: this.mapRevocationReasonToMessage(recipientData.revocationReason),
                revocationDetails: recipientData.revocationDetails || '',
                hrContactName: recipientData.hrContactName || 'HR Team',
                hrContactEmail: recipientData.hrContactEmail || 'hr@company.com',
                supportTeamPhone: recipientData.supportTeamPhone || ''
            }
        };

        return this.sendEmailWithRetry(emailData, recipientData.tenantId);
    }

    /**
     * SEND LETTER STATUS UPDATE EMAIL
     * Generic notification for any status change
     */
    async sendStatusUpdateEmail(recipientData) {
        const emailData = {
            to: recipientData.email,
            subject: 'Letter Status Update',
            template: 'status_update',
            context: {
                recipientName: recipientData.name,
                letterType: recipientData.letterType || 'Letter',
                oldStatus: recipientData.oldStatus,
                newStatus: recipientData.newStatus,
                updateDate: new Date().toLocaleDateString('en-IN'),
                updateReason: recipientData.updateReason || '',
                companyName: recipientData.companyName || 'Our Company',
                hrContactEmail: recipientData.hrContactEmail || 'hr@company.com'
            }
        };

        return this.sendEmailWithRetry(emailData, recipientData.tenantId);
    }

    /**
     * SEND EMAIL WITH RETRY LOGIC
     * Fail-safe retry mechanism with exponential backoff
     */
    async sendEmailWithRetry(emailData, tenantId, retryCount = 0) {
        try {
            if (!this.transporter) {
                console.log(`📧 [EMAIL] Would send (no transporter): To=${emailData.to}, Subject=${emailData.subject}`);
                return { success: true, method: 'logged', tenantId };
            }

            const html = this.renderEmailTemplate(emailData.template, emailData.context);
            const mailOptions = {
                from: this.config.fromEmail || 'noreply@company.com',
                to: emailData.to,
                subject: emailData.subject,
                html
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            console.log(`✅ [EMAIL] Sent successfully to ${emailData.to}`);
            return {
                success: true,
                messageId: result.messageId,
                tenantId,
                sentAt: new Date()
            };
        } catch (error) {
            console.error(`❌ [EMAIL] Error (attempt ${retryCount + 1}):`, error.message);

            // Retry logic with exponential backoff
            if (retryCount < this.maxRetries) {
                const delayMs = this.retryDelayMs * Math.pow(2, retryCount);
                console.log(`⏳ [EMAIL] Retrying after ${delayMs}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.sendEmailWithRetry(emailData, tenantId, retryCount + 1);
            }

            console.error(`❌ [EMAIL] Failed after ${this.maxRetries} retries`);
            return {
                success: false,
                error: error.message,
                tenantId,
                failedAt: new Date(),
                retries: retryCount
            };
        }
    }

    /**
     * RENDER EMAIL TEMPLATE
     * Convert template name + context to HTML
     */
    renderEmailTemplate(templateName, context) {
        const templates = {
            offer_assignment: this.templateOfferAssignment(context),
            offer_revocation: this.templateOfferRevocation(context),
            status_update: this.templateStatusUpdate(context)
        };

        return templates[templateName] || this.templateDefault(context);
    }

    /**
     * EMAIL TEMPLATE: OFFER ASSIGNMENT
     * Professional, friendly tone
     */
    templateOfferAssignment(ctx) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 5px; }
                    .content { padding: 20px; background-color: #f9fafb; margin: 20px 0; border-radius: 5px; }
                    .highlight { background-color: #fef3c7; padding: 2px 6px; border-radius: 3px; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
                    .cta-button { background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
                    .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    .details-table td { padding: 8px; border-bottom: 1px solid #ddd; }
                    .details-table .label { font-weight: bold; width: 40%; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🎉 Congratulations, ${ctx.recipientName}!</h2>
                    </div>
                    
                    <div class="content">
                        <p>Dear ${ctx.recipientName},</p>
                        
                        <p>We are delighted to extend you an offer for the position of <span class="highlight">${ctx.positionTitle}</span> at <strong>${ctx.companyName}</strong>.</p>
                        
                        <table class="details-table">
                            <tr>
                                <td class="label">Position:</td>
                                <td>${ctx.positionTitle}</td>
                            </tr>
                            <tr>
                                <td class="label">CTC:</td>
                                <td>${ctx.ctcAmount}</td>
                            </tr>
                            <tr>
                                <td class="label">Proposed Joining Date:</td>
                                <td>${ctx.joiningDate}</td>
                            </tr>
                            <tr>
                                <td class="label">Offer Valid Until:</td>
                                <td>${ctx.offerValidUntil}</td>
                            </tr>
                        </table>
                        
                        <p>Your complete offer letter is attached. Please review it carefully and confirm your acceptance.</p>
                        
                        <center>
                            <a href="${ctx.actionUrl}" class="cta-button">View Offer Letter</a>
                        </center>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ul>
                            <li>Review the attached offer letter</li>
                            <li>Contact us with any questions or clarifications needed</li>
                            <li>Confirm your acceptance before the offer validity date</li>
                        </ul>
                        
                        <p>For any questions or assistance, please reach out to:</p>
                        <p>
                            <strong>${ctx.hrContactName}</strong><br>
                            Email: <a href="mailto:${ctx.hrContactEmail}">${ctx.hrContactEmail}</a>
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} ${ctx.companyName}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * EMAIL TEMPLATE: OFFER REVOCATION
     * Professional, legally-safe wording - non-accusatory
     */
    templateOfferRevocation(ctx) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px; }
                    .content { padding: 20px; background-color: #fef2f2; margin: 20px 0; border-radius: 5px; }
                    .info-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 3px; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
                    .contact-info { background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Important Update</h2>
                    </div>
                    
                    <div class="content">
                        <p>Dear ${ctx.recipientName},</p>
                        
                        <p>We are writing to inform you of an important update regarding your offer for the position of <strong>${ctx.positionTitle}</strong> at <strong>${ctx.companyName}</strong>.</p>
                        
                        <div class="info-box">
                            <p><strong>Update Date:</strong> ${ctx.revocationDate}</p>
                            <p><strong>Reason:</strong> ${ctx.revocationReason}</p>
                            ${ctx.revocationDetails ? `<p><strong>Details:</strong> ${ctx.revocationDetails}</p>` : ''}
                        </div>
                        
                        <p>Unfortunately, we are unable to proceed with the previously extended offer at this time. We understand this may be disappointing news, and we appreciate your understanding and flexibility.</p>
                        
                        <p>Please note that this decision in no way reflects your qualifications or suitability for the role. Circumstances beyond our control have necessitated this update.</p>
                        
                        <p>If you have any questions or would like to discuss this matter further, we encourage you to reach out to our HR team:</p>
                        
                        <div class="contact-info">
                            <p><strong>${ctx.hrContactName}</strong><br>
                            Email: <a href="mailto:${ctx.hrContactEmail}">${ctx.hrContactEmail}</a>
                            ${ctx.supportTeamPhone ? `<br>Phone: ${ctx.supportTeamPhone}` : ''}
                            </p>
                        </div>
                        
                        <p>Thank you for your interest in ${ctx.companyName}. We wish you all the best in your career endeavors.</p>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} ${ctx.companyName}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * EMAIL TEMPLATE: STATUS UPDATE
     * Generic template for any status change
     */
    templateStatusUpdate(ctx) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px; }
                    .content { padding: 20px; background-color: #f0f9ff; margin: 20px 0; border-radius: 5px; }
                    .status-update { background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; border-radius: 3px; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Letter Status Update</h2>
                    </div>
                    
                    <div class="content">
                        <p>Dear ${ctx.recipientName},</p>
                        
                        <p>We are writing to inform you of a status update regarding your ${ctx.letterType}.</p>
                        
                        <div class="status-update">
                            <p><strong>Update Date:</strong> ${ctx.updateDate}</p>
                            <p><strong>Previous Status:</strong> ${ctx.oldStatus}</p>
                            <p><strong>Current Status:</strong> ${ctx.newStatus}</p>
                            ${ctx.updateReason ? `<p><strong>Reason:</strong> ${ctx.updateReason}</p>` : ''}
                        </div>
                        
                        <p>Please log in to your account to view the updated details and take any necessary action.</p>
                        
                        <p>If you have any questions or need assistance, please contact our HR team at ${ctx.hrContactEmail}.</p>
                        
                        <p>Thank you for your attention to this matter.</p>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} ${ctx.companyName}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * DEFAULT EMAIL TEMPLATE
     * Fallback if no specific template found
     */
    templateDefault(ctx) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            </head>
            <body>
                <p>Dear ${ctx.recipientName || 'User'},</p>
                <p>${ctx.message || 'This is an automated notification.'}</p>
                <p>Best regards,<br>HR Team</p>
            </body>
            </html>
        `;
    }

    /**
     * MAP REVOCATION REASON TO USER-FRIENDLY MESSAGE
     */
    mapRevocationReasonToMessage(reason) {
        const messages = {
            'duplicate_offer': 'Duplicate offer duplicate communication',
            'candidate_rejected': 'Position has been filled',
            'position_cancelled': 'Position has been cancelled',
            'business_decision': 'Business restructuring',
            'process_error': 'Process error correction',
            'compliance_issue': 'Compliance requirement',
            'other': 'Organizational update'
        };
        return messages[reason] || 'Business decision';
    }
}

module.exports = EmailNotificationService;
