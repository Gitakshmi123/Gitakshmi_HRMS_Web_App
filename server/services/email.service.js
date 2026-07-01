const nodemailer = require('nodemailer');
const dns = require('dns');

// Fallback DNS lookup to Google/Cloudflare DNS if default ISP DNS fails to resolve SMTP server
const customLookup = (hostname, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' ? options : {};
    dns.lookup(hostname, opts, (err, address, family) => {
        if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
            const resolver = new dns.Resolver();
            try {
                resolver.setServers(['8.8.8.8', '1.1.1.1']);
                resolver.resolve4(hostname, (fallbackErr, addresses) => {
                    if (fallbackErr || !addresses || addresses.length === 0) {
                        return cb(err);
                    }
                    cb(null, addresses[0], 4);
                });
            } catch (resolveErr) {
                cb(err);
            }
        } else {
            cb(err, address, family);
        }
    });
};

class EmailService {
    constructor() {
        this.transporterCache = new Map();
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const smtpSecure = process.env.SMTP_SECURE === 'true';
        const smtpUser = process.env.SMTP_USER?.trim();
        const rawPass = process.env.SMTP_PASS?.trim();

        // Gmail "App Password" logic: Remove all spaces if it looks like a Gmail app pass
        const smtpPass = (smtpHost.includes('gmail') && rawPass) ? rawPass.replace(/\s+/g, '') : rawPass;

        this.smtpUser = smtpUser;

        // Diagnostic: Check for hidden/non-ASCII characters in email
        const isAscii = (str) => /^[\x00-\x7F]*$/.test(str);
        if (smtpUser && !isAscii(smtpUser)) {
            console.warn('⚠️ [EmailService] Warning: SMTP_USER contains non-ASCII characters.');
        }

        const transportConfig = {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            lookup: customLookup,
            debug: false,
            logger: false,
            tls: { rejectUnauthorized: false }
        };

        // If explicitly using gmail service, nodemailer handles the host/port internally
        if (smtpHost.includes('gmail.com') && !smtpSecure) {
            delete transportConfig.host;
            delete transportConfig.port;
            transportConfig.service = 'gmail';
        }

        this.transporter = nodemailer.createTransport(transportConfig);

        console.log(`📡 [EmailService] Initializing SMTP: ${smtpHost}:${smtpPort} (User: ${smtpUser})`);

        // Non-blocking verification to prevent startup delay or crashes
        if (String(process.env.VERIFY_SMTP_ON_STARTUP || '').toLowerCase() === 'true') {
            this.transporter.verify().then(() => {
            // console.log('✅ [EmailService] SMTP Connection Verified');
            }).catch((err) => {
            console.error('❌ [EmailService] SMTP Connection Failed:', err.message);
            console.log('💡 TIP: If using Gmail, you MUST use an "App Password" (16 chars), not your regular password.');
            console.log('💡 TIP: Enable 2FA on your Google account first, then generate the App Password.');
            });
        }
    }




    async getTransporterAndSender(tenantId, customSmtp = null) {
        let selectedSmtp = customSmtp;

        if (!selectedSmtp && tenantId) {
            try {
                const mongoose = require('mongoose');
                const Tenant = mongoose.model('Tenant');
                const tenantQuery = mongoose.Types.ObjectId.isValid(tenantId) 
                    ? { _id: tenantId } 
                    : { tenantId: tenantId.toString() };
                const tenant = await Tenant.findOne(tenantQuery).lean();
                if (tenant && tenant.smtpConfig && tenant.smtpConfig.host && tenant.smtpConfig.user) {
                    selectedSmtp = tenant.smtpConfig;
                }
            } catch (err) {
                console.warn(`⚠️ [EmailService] Failed to load SMTP config for tenant ${tenantId}:`, err.message);
            }
        }

        if (selectedSmtp && selectedSmtp.host && selectedSmtp.user) {
            // Normalize SMTP configuration
            const host = String(selectedSmtp.host || '').trim();
            const port = Number(selectedSmtp.port || 587);
            let secure = selectedSmtp.secure === true || String(selectedSmtp.secure).toLowerCase() === 'true';
            if (port === 465) secure = true;
            else if (port === 587) secure = false;

            const user = selectedSmtp.user?.trim();
            const rawPass = (selectedSmtp.pass ?? selectedSmtp.password ?? '').toString().trim();
            const pass = (host.includes('gmail') && rawPass) ? rawPass.replace(/\s+/g, '') : rawPass;
            const fromEmail = selectedSmtp.fromEmail?.trim();
            const fromName = selectedSmtp.fromName?.trim();

            const cacheKey = `${tenantId || 'custom'}_${host}_${port}_${user}_${secure}_${pass}_${fromEmail}_${fromName}`;

            if (this.transporterCache.has(cacheKey)) {
                return this.transporterCache.get(cacheKey);
            }

            // Clean up old transporter instances for the same tenant to prevent connection leaks
            if (tenantId) {
                for (const [key, cached] of this.transporterCache.entries()) {
                    if (key.startsWith(`${tenantId}_`) && key !== cacheKey) {
                        try {
                            cached.transporter.close();
                        } catch (e) {
                            // ignore error
                        }
                        this.transporterCache.delete(key);
                    }
                }
            }

            console.log(`📡 [EmailService] Initializing tenant-specific SMTP: ${host}:${port} (User: ${user})`);

            const transportConfig = {
                host,
                port,
                secure,
                auth: {
                    user,
                    pass
                },
                lookup: customLookup,
                debug: false,
                logger: false,
                tls: { rejectUnauthorized: false }
            };

            if (host.includes('gmail.com') && !secure) {
                delete transportConfig.host;
                delete transportConfig.port;
                transportConfig.service = 'gmail';
            }

            const transporter = nodemailer.createTransport(transportConfig);

            // Resolve dynamic from address
            let fromAddress = process.env.EMAIL_FROM || `"Gitakshmi HR Team" <${this.smtpUser}>`;
            if (fromEmail) {
                fromAddress = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
            }

            const result = { transporter, from: fromAddress };
            this.transporterCache.set(cacheKey, result);
            return result;
        }

        // Fallback to default transporter
        return {
            transporter: this.transporter,
            from: process.env.EMAIL_FROM || `"Gitakshmi HR Team" <${this.smtpUser}>`
        };
    }

    /**
     * Send an email with options (generic interface)
     * @param {Object} options - Email options
     * @returns {Promise<Object>}
     */
    async sendMail(options) {
        const { to, subject, html, attachments = [], tenantId = null, customSmtp = null } = options || {};
        try {
            if (!to) {
                throw new Error("Recipient email address is required.");
            }
            const { transporter, from } = await this.getTransporterAndSender(tenantId, customSmtp);
            const mailOptions = {
                from,
                to,
                subject,
                html,
                attachments
            };
            const info = await transporter.sendMail(mailOptions);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ [EmailService] sendMail failed to ${to}:`, error.message);
            throw error;
        }
    }

    /**
     * Send an email to a specific recipient
     * @param {string} to - Recipient email address
     * @param {string} subject - Subject line
     * @param {string} html - HTML body content
     * @param {Array} attachments - Optional attachments array
     * @param {string} tenantId - Optional tenant ID for custom SMTP routing
     * @returns {Promise<Object>} - The result of the send operation
     */
    async sendEmail(to, subject, html, attachments = [], tenantId = null) {
        if (typeof attachments === 'string') {
            tenantId = attachments;
            attachments = [];
        }
        try {
            if (!to) {
                throw new Error("Recipient email address is required.");
            }

            const { transporter, from } = await this.getTransporterAndSender(tenantId);

            const mailOptions = {
                from,
                to: to,
                subject: subject,
                html: html,
                attachments
            };

            const info = await transporter.sendMail(mailOptions);
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error(`❌ [EmailService] Failed to send email to ${to}:`, error.message);

            if (error && (error.code === 'EAUTH' || error.responseCode === 535)) {
                const err = new Error(
                    'SMTP authentication failed (535). Check SMTP_USER/SMTP_PASS. ' +
                    'For Gmail, use an App Password (not your Gmail password) and ensure SMTP_PASS has no spaces.'
                );
                err.status = 500;
                err.error = 'smtp_auth_failed';
                throw err;
            }

            throw error;
        }
    }
    /**
     * Send Status Update Email (Standardized Template)
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Name of Candidate
     * @param {string} jobTitle - Job Title
     * @param {string} applicationId - Application ID
     * @param {string} status - New Status
     */
    /**
     * Send Status Update Email (Standardized Template)
     * ALIAS: sendStatusEmail (for backward compatibility)
     */
    async sendApplicationStatusEmail(to, candidateName, jobTitle, applicationId, status, feedback = null, rating = null, tenantId = null) {
        const subject = `Application Status Update - ${jobTitle}`;

        // Color coding for status
        let statusColor = '#3498db'; // Default Blue (Applied)
        if (status === 'Shortlisted') statusColor = '#f1c40f'; // Yellow
        if (status === 'Selected') statusColor = '#2ecc71'; // Green
        if (status === 'Rejected') statusColor = '#e74c3c'; // Red
        if (status === 'Under Review') statusColor = '#9b59b6'; // Purple

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Application Update</h2>
                </div>
                
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.5;">
                        The status of your application for the position of <strong>${jobTitle}</strong> has been updated.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid ${statusColor}; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0; font-size: 14px; color: #777;">Application ID:</p>
                        <p style="margin: 0; font-weight: bold; color: #333;">${applicationId}</p>
                        
                        <p style="margin: 15px 0 5px; font-size: 14px; color: #777;">Current Status:</p>
                        </span>
                    </div>

                    ${feedback ? `
                        <div style="margin: 20px 0; padding: 15px; background-color: #fcfcfc; border: 1px dashed #e0e0e0; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #7f8c8d; text-transform: uppercase;">Feedback / Assessment</p>
                            <p style="margin: 0; color: #34495e; font-style: italic; line-height: 1.6;">"${feedback}"</p>
                            ${rating ? `
                                <div style="margin-top: 10px; color: #f1c40f; font-size: 18px;">
                                    ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <p style="color: #555; font-size: 14px; margin-top: 20px;">
                        ${status === 'Selected'
                ? 'Congratulations! Our HR team will contact you shortly regarding the next steps.'
                : status === 'Rejected'
                    ? 'We appreciate your interest. Unfortunately, we will not be proceeding with your application at this time.'
                    : 'Your application is currently being reviewed by our recruitment team.'}
                    </p>
                </div>

                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;

        return this.sendEmail(to, subject, html, [], tenantId);
    }

    // Alias for backward compatibility
    async sendStatusEmail(to, candidateName, jobTitle, applicationId, status, tenantId = null) {
        return this.sendApplicationStatusEmail(to, candidateName, jobTitle, applicationId, status, null, null, tenantId);
    }

    // Helper function to dynamically replace placeholders (supporting user's custom templates like CEO template)
    replaceEmailPlaceholders(html, {
        candidateName = '',
        jobTitle = '',
        companyName = '',
        department = '',
        ctcYearly = '',
        joiningDate = '',
        currentDesignation = '',
        currentCTC = '',
        hikePercentage = '',
        ctcBreakdown = '',
        candidateDetails = '',
        approvalUrl = ''
    }) {
        if (!html) return html;

        const formattedJoiningDate = joiningDate 
            ? (isNaN(Date.parse(joiningDate)) ? joiningDate : new Date(joiningDate).toLocaleDateString())
            : '';

        return html
            .replace(/{{candidateName}}/g, candidateName)
            .replace(/{{jobTitle}}/g, jobTitle)
            .replace(/{{designation}}/g, jobTitle)
            .replace(/{{companyName}}/g, companyName)
            .replace(/{{department}}/g, department)
            .replace(/{{ctcYearly}}/g, ctcYearly)
            .replace(/{{joiningDate}}/g, formattedJoiningDate)
            .replace(/{{currentDesignation}}/g, currentDesignation)
            .replace(/{{currentCTC}}/g, currentCTC)
            .replace(/{{hikePercentage}}/g, hikePercentage)
            .replace(/{{ctcBreakdown}}/g, ctcBreakdown)
            .replace(/{{candidateDetails}}/g, candidateDetails)
            .replace(/{{approvalUrl}}/g, approvalUrl)
            
            // Dynamic Case-Insensitive replacements for CEO/Workflow template matching user requirements
            .replace(/{{current_department}}/gi, department)
            .replace(/{{currentDepartment}}/gi, department)
            .replace(/{{current department}}/gi, department)
            
            .replace(/{{current_ctc}}/gi, currentCTC)
            .replace(/{{currentCTC}}/gi, currentCTC)
            .replace(/{{current ctc}}/gi, currentCTC)
            
            .replace(/{{offer_ctc}}/gi, ctcYearly)
            .replace(/{{offerCTC}}/gi, ctcYearly)
            .replace(/{{offer ctc}}/gi, ctcYearly)
            
            .replace(/{{percentage_increase}}/gi, hikePercentage)
            .replace(/{{percentageIncrease}}/gi, hikePercentage)
            .replace(/{{% increase}}/gi, hikePercentage)
            .replace(/{{% increate}}/gi, hikePercentage)
            
            .replace(/{{current_designation}}/gi, currentDesignation)
            .replace(/{{currentDesignation}}/gi, currentDesignation)
            .replace(/{{current designation}}/gi, currentDesignation)
            
            .replace(/{{offer_designation}}/gi, jobTitle)
            .replace(/{{offerDesignation}}/gi, jobTitle)
            .replace(/{{offer designation}}/gi, jobTitle);
    }

    /**
     * Send Offer Letter Email with Attachment
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Candidate Name
     * @param {string} jobTitle - Job Title
     * @param {string} companyName - Company Name
     * @param {string} offerLetterPdfPath - Path to the generated PDF file
     */
    async sendOfferLetterEmail(to, candidateName, jobTitle, companyName, offerLetterPdfPath, customHtml = null, applicant = null, tenantId = null) {
        const subject = `Offer Letter – ${companyName}`;

        let html = customHtml;

        if (html) {
             const ctcBreakdown = applicant ? generateCTCBreakdownHtml(applicant.salarySnapshotId || applicant.salarySnapshot) : '';
             const candidateDetails = applicant ? generateCandidateDetailsHtml(applicant) : '';

             const ctcYearlyNum = parseFloat(String(applicant?.ctcYearly || '').replace(/,/g, '')) || 0;
             const currentCTCNum = parseFloat(String(applicant?.currentCTC || '').replace(/,/g, '')) || 0;
             let hikePercentage = '';
             if (currentCTCNum > 0 && ctcYearlyNum > 0) {
                 hikePercentage = (((ctcYearlyNum - currentCTCNum) / currentCTCNum) * 100).toFixed(2) + '%';
             }

             html = this.replaceEmailPlaceholders(html, {
                 candidateName,
                 jobTitle,
                 companyName,
                 department: applicant?.department || '',
                 ctcYearly: applicant?.ctcYearly || '',
                 joiningDate: applicant?.joiningDate || '',
                 currentDesignation: applicant?.currentDesignation || '',
                 currentCTC: applicant?.currentCTC || '',
                 hikePercentage,
                 ctcBreakdown,
                 candidateDetails
             });
        }

        if (!html) {
            html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Congratulations!</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        We are pleased to offer you the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
                    </p>

                    <p style="color: #555; line-height: 1.6;">
                        Please find your official Offer Letter attached to this email. We were impressed with your skills and experience, and we believe you will be a great addition to our team.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid #2ecc71; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #555; font-size: 14px;">Next Steps:</p>
                        <p style="margin: 5px 0 0; color: #333;">Please review the attached document and let us know your acceptance.</p>
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        We look forward to welcoming you aboard!
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        HR Team, ${companyName}
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
            `;
        }

        // Attachment configuration
        const attachments = [{
            filename: `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
            path: offerLetterPdfPath
        }];

        console.log(`📧 [EMAIL SERVICE] Sending Offer Letter to ${to} with attachment: ${offerLetterPdfPath}`);

        try {
            const { transporter, from } = await this.getTransporterAndSender(tenantId);
            const mailOptions = {
                from,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ [EMAIL SERVICE] Offer Letter sent successfully. MessageID: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ [EMAIL SERVICE] Failed to send Offer Letter to ${to}:`, error.message);
            throw error;
        }
    }


    /**
     * Send Joining Letter Email with Attachment
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Candidate Name
     * @param {string} jobTitle - Job Title
     * @param {string} companyName - Company Name
     * @param {string} joiningDate - Joining Date (formatted)
     * @param {string} joiningLetterPdfPath - Path to the generated PDF file
     */
    async sendJoiningLetterEmail(to, candidateName, jobTitle, companyName, joiningDate, joiningLetterPdfPath, tenantId = null) {
        const subject = `Joining Letter – ${companyName}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Welcome Aboard!</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        We are excited to welcome you to <strong>${companyName}</strong> as a <strong>${jobTitle}</strong>.
                    </p>

                    <p style="color: #555; line-height: 1.6;">
                        Please find your official Joining Letter attached to this email. This document confirms your joining details.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid #3498db; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #555; font-size: 14px;">Joining Date:</p>
                        <p style="margin: 5px 0 0; color: #333; font-weight: bold;">${joiningDate}</p>
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        We look forward to a successful journey together!
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        HR Team, ${companyName}
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;

        // Attachment configuration
        const attachments = [{
            filename: `Joining_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
            path: joiningLetterPdfPath
        }];

        console.log(`📧 [EMAIL SERVICE] Sending Joining Letter to ${to} with attachment: ${joiningLetterPdfPath}`);

        try {
            const { transporter, from } = await this.getTransporterAndSender(tenantId);
            const mailOptions = {
                from,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ [EMAIL SERVICE] Joining Letter sent successfully. MessageID: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ [EMAIL SERVICE] Failed to send Joining Letter to ${to}:`, error.message);
            throw error;
        }
    }


    /**
     * Send Interview Scheduled Email
     */
    async sendInterviewScheduledEmail(to, candidateName, jobTitle, interviewDetails, isForInterviewer = false, tenantId = null) {
        const subject = `${isForInterviewer ? 'Interview Schedule Notification' : 'Interview Scheduled'} - ${jobTitle}`;
        const { date, time, mode, location, meetingLink, interviewerName, notes } = interviewDetails;

        // Format date strictly
        const dateStr = new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const greeting = isForInterviewer 
            ? `Dear <strong>${interviewerName || 'Interviewer'}</strong>,` 
            : `Dear <strong>${candidateName}</strong>,`;

        const bodyIntro = isForInterviewer
            ? `You are scheduled to conduct an interview with candidate <strong>${candidateName}</strong> for the position of <strong>${jobTitle}</strong>.`
            : `We are pleased to invite you for an interview for the position of <strong>${jobTitle}</strong>.`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">${isForInterviewer ? 'Conduct Interview' : 'Interview Invitation'}</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">${greeting}</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        ${bodyIntro}
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid #3498db; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0; color: #555;"><strong>Date:</strong> ${dateStr}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Time:</strong> ${time}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Mode:</strong> ${mode}</p>
                        ${mode === 'Online' && meetingLink ? `<p style="margin: 5px 0; color: #555;"><strong>Meeting Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #3498db; text-decoration: underline; font-weight: bold;">${meetingLink}</a></p>` : ''}
                        ${mode !== 'Online' && location ? `<p style="margin: 5px 0; color: #555;"><strong>Location:</strong> ${location}</p>` : ''}
                        <p style="margin: 5px 0; color: #555;"><strong>Interviewer:</strong> ${interviewerName}</p>
                         ${notes ? `<p style="margin: 10px 0 0; font-style: italic; color: #666;">Note: ${notes}</p>` : ''}
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        ${isForInterviewer ? 'Please ensure you join the meeting on time.' : 'Please ensure you are available 10 minutes prior to the scheduled time.'}
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        Recruitment Team
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html, [], tenantId);
    }

    /**
     * Send Interview Rescheduled Email
     */
    async sendInterviewRescheduledEmail(to, candidateName, jobTitle, interviewDetails, isForInterviewer = false, tenantId = null) {
        const subject = `${isForInterviewer ? 'Interview Rescheduled Notification' : 'Interview Rescheduled'} - ${jobTitle}`;
        const { date, time, mode, location, meetingLink, interviewerName, notes } = interviewDetails;

        const dateStr = new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const greeting = isForInterviewer 
            ? `Dear <strong>${interviewerName || 'Interviewer'}</strong>,` 
            : `Dear <strong>${candidateName}</strong>,`;

        const bodyIntro = isForInterviewer
            ? `The interview you are conducting with candidate <strong>${candidateName}</strong> for the position of <strong>${jobTitle}</strong> has been rescheduled.`
            : `Your interview for the position of <strong>${jobTitle}</strong> has been rescheduled.`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #e67e22; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Interview Rescheduled</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">${greeting}</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        ${bodyIntro}
                    </p>

                    <div style="background-color: #fff3e0; border-left: 5px solid #e67e22; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0; color: #555;"><strong>New Date:</strong> ${dateStr}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>New Time:</strong> ${time}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Mode:</strong> ${mode}</p>
                        ${mode === 'Online' && meetingLink ? `<p style="margin: 5px 0; color: #555;"><strong>Meeting Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #e67e22; text-decoration: underline; font-weight: bold;">${meetingLink}</a></p>` : ''}
                        ${mode !== 'Online' && location ? `<p style="margin: 5px 0; color: #555;"><strong>Location:</strong> ${location}</p>` : ''}
                        <p style="margin: 5px 0; color: #555;"><strong>Interviewer:</strong> ${interviewerName}</p>
                         ${notes ? `<p style="margin: 10px 0 0; font-style: italic; color: #666;">Note: ${notes}</p>` : ''}
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        We apologize for any inconvenience caused.
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        Recruitment Team
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html, [], tenantId);
    }
    /**
     * Send Application Received Email to Candidate
     */
    async sendCandidateAppliedEmail(to, candidateName, jobTitle, companyName, tenantId = null) {
        const subject = `Application Received - ${jobTitle}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #3498db; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Application Received</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    <p style="color: #555; line-height: 1.6;">
                        Thank you for applying for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
                    </p>
                    <p style="color: #555; line-height: 1.6;">
                        We have successfully received your application. Our recruitment team will review your profile and get back to you if you are shortlisted for the next round.
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        Good luck!
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html, [], tenantId);
    }

    /**
     * Send New Application Notification to Company
     */
    async sendCompanyNewApplicationEmail(to, candidateName, jobTitle, applicantId, tenantId = null) {
        const subject = `New Candidate Applied: ${candidateName} - ${jobTitle}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #27ae60; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">New Application</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Hello HR Team,</p>
                    <p style="color: #555; line-height: 1.6;">
                        A new candidate, <strong>${candidateName}</strong>, has applied for the position of <strong>${jobTitle}</strong>.
                    </p>
                    <div style="background-color: #f8f9fa; border-left: 5px solid #27ae60; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #555;"><strong>Applicant ID:</strong> ${applicantId}</p>
                    </div>
                    <p style="color: #555;">
                        Please log in to the HRMS portal to review the application and resume.
                    </p>
                </div>
            </div>
        `;
        // Only send if 'to' address is present
        if (to) {
            return this.sendEmail(to, subject, html, [], tenantId);
        }
        return Promise.resolve();
    }

    /**
     * Send Offer Fully Signed Email
     */
    async sendOfferFullySignedEmail(to, candidateName, jobTitle, companyName, tenantId = null) {
        const subject = `Offer Fully Signed – ${companyName}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #27ae60; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Offer Fully Signed!</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    <p style="color: #555; line-height: 1.6;">
                        We are happy to inform you that your offer letter for the position of <strong>${jobTitle}</strong> has been fully signed and approved by <strong>${companyName}</strong>.
                    </p>
                    <p style="color: #555; line-height: 1.6;">
                        You can now log in to the candidate portal to download your final copy of the signed offer letter.
                    </p>
                    <div style="background-color: #f8f9fa; border-left: 5px solid #27ae60; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #555;">Next Steps:</p>
                        <p style="margin: 5px 0 0; color: #333;">Our team will initiate the Background Verification (BGV) process shortly. Please keep your documents ready.</p>
                    </div>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html, [], tenantId);
    }

    async sendOfferApprovalRequestEmail(to, candidateName, jobTitle, companyName, pdfPath, approvalUrl, assignmentId, details = {}, approverRole = '', tenantId = null, customTemplate = null) {
        let subject = `Action Required: Approval Needed for Offer Letter - ${candidateName}`;
        
        let attachments = [];
        if (pdfPath) {
            attachments.push({
                filename: `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
                path: pdfPath
            });
        }

        const isExecutive = approverRole && (approverRole.toLowerCase().includes('ceo') || approverRole.toLowerCase().includes('founder') || approverRole.toLowerCase().includes('director'));
        const showCTC = isExecutive;

        let html = customTemplate?.bodyHtml || null;

        if (customTemplate?.subject) {
             subject = this.replaceEmailPlaceholders(customTemplate.subject, {
                 candidateName,
                 jobTitle,
                 designation: jobTitle,
                 companyName,
                 department: details.department || ''
             });
        }

        if (html) {
             const applicant = details.applicant;
             const ctcBreakdown = applicant ? generateCTCBreakdownHtml(applicant.salarySnapshotId || applicant.salarySnapshot) : '';
             const candidateDetails = applicant ? generateCandidateDetailsHtml(applicant) : '';

             const ctcYearlyNum = parseFloat((details.ctcYearly || '').replace(/,/g, '')) || 0;
             const currentCTCNum = parseFloat(String(details.currentCTC || (applicant ? applicant.currentCTC : '') || '').replace(/,/g, '')) || 0;
             let hikePercentage = '';
             if (currentCTCNum > 0 && ctcYearlyNum > 0) {
                 hikePercentage = (((ctcYearlyNum - currentCTCNum) / currentCTCNum) * 100).toFixed(2) + '%';
             }

             html = this.replaceEmailPlaceholders(html, {
                 candidateName,
                 jobTitle,
                 designation: jobTitle,
                 companyName,
                 approvalUrl,
                 department: details.department || '',
                 ctcYearly: details.ctcYearly || '',
                 joiningDate: details.joiningDate || '',
                 currentDesignation: details.currentDesignation || (applicant ? applicant.currentDesignation : '') || '',
                 currentCTC: details.currentCTC || (applicant ? applicant.currentCTC : '') || '',
                 hikePercentage,
                 ctcBreakdown,
                 candidateDetails
             });
        }

        if (!html) {
            html = `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="background-color: #2b3a4a; padding: 20px; text-align: center; color: white;">
                    <h2 style="margin: 0; font-size: 20px;">Offer Letter Approval Request</h2>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333; margin-top: 0;">Hello,</p>
                    <p style="color: #555; line-height: 1.6;">
                        An offer letter for <strong>${candidateName}</strong> for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong> requires your review and approval.
                    </p>
                    <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                        <ul style="list-style-type: none; padding: 0; margin: 0; color: #444;">
                            <li style="margin-bottom: 8px;"><strong>Candidate:</strong> ${candidateName}</li>
                            <li style="margin-bottom: 8px;"><strong>Position:</strong> ${jobTitle}</li>
                            ${details.department ? `<li style="margin-bottom: 8px;"><strong>Department:</strong> ${details.department}</li>` : ''}
                            ${details.ctcYearly && showCTC ? `<li style="margin-bottom: 8px;"><strong>CTC:</strong> ${details.ctcYearly}</li>` : ''}
                            ${details.joiningDate ? `<li style="margin-bottom: 0;"><strong>Tentative Joining Date:</strong> ${details.joiningDate}</li>` : ''}
                        </ul>
                    </div>
                    <p style="color: #555; line-height: 1.6;">
                        Please review the attached offer letter document and click the button below to approve or reject this offer.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${approvalUrl}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Review & Approve Offer</a>
                    </div>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated workflow notification from ${companyName}. Please do not reply to this email.</p>
                </div>
            </div>
        `;
        }
        return this.sendEmail(to, subject, html, attachments, tenantId);
    }

    async sendJoiningApprovalRequestEmail(to, candidateName, jobTitle, companyName, pdfPath, approvalUrl, assignmentId, details = {}, approverRole = '', tenantId = null, customTemplate = null) {
        let subject = `Action Required: Approval Needed for Joining Letter - ${candidateName}`;
        
        let attachments = [];
        if (pdfPath) {
            attachments.push({
                filename: `Joining_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
                path: pdfPath
            });
        }

        const isExecutive = approverRole && (approverRole.toLowerCase().includes('ceo') || approverRole.toLowerCase().includes('founder') || approverRole.toLowerCase().includes('director'));
        const showDetails = isExecutive;

        let html = customTemplate?.bodyHtml || null;

        if (customTemplate?.subject) {
            subject = customTemplate.subject
                       .replace(/{{candidateName}}/g, candidateName)
                       .replace(/{{jobTitle}}/g, jobTitle)
                       .replace(/{{designation}}/g, jobTitle)
                       .replace(/{{companyName}}/g, companyName)
                       .replace(/{{department}}/g, details.department || '');
        }

        if (html) {
            html = html.replace(/{{candidateName}}/g, candidateName)
                       .replace(/{{jobTitle}}/g, jobTitle)
                       .replace(/{{designation}}/g, jobTitle)
                       .replace(/{{companyName}}/g, companyName)
                       .replace(/{{approvalUrl}}/g, approvalUrl)
                       .replace(/{{department}}/g, details.department || '')
                       .replace(/{{joiningDate}}/g, details.joiningDate || '');
        }

        if (!html) {
            html = `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="background-color: #2b3a4a; padding: 20px; text-align: center; color: white;">
                    <h2 style="margin: 0; font-size: 20px;">Joining Letter Approval Request</h2>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333; margin-top: 0;">Hello,</p>
                    <p style="color: #555; line-height: 1.6;">
                        A joining letter for <strong>${candidateName}</strong> for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong> requires your review and approval.
                    </p>
                    <div style="background-color: #f8f9fa; border-left: 4px solid #9b59b6; padding: 15px; margin: 20px 0;">
                        <ul style="list-style-type: none; padding: 0; margin: 0; color: #444;">
                            <li style="margin-bottom: 8px;"><strong>Candidate:</strong> ${candidateName}</li>
                            <li style="margin-bottom: 8px;"><strong>Position:</strong> ${jobTitle}</li>
                            ${details.department ? `<li style="margin-bottom: 8px;"><strong>Department:</strong> ${details.department}</li>` : ''}
                            ${details.joiningDate ? `<li style="margin-bottom: 0;"><strong>Confirmed Joining Date:</strong> ${details.joiningDate}</li>` : ''}
                        </ul>
                    </div>
                    <p style="color: #555; line-height: 1.6;">
                        Please review the attached joining letter document and click the button below to approve or reject it.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${approvalUrl}" style="background-color: #9b59b6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Review & Approve Joining Letter</a>
                    </div>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated workflow notification from ${companyName}. Please do not reply to this email.</p>
                </div>
            </div>
        `;
        }

        return this.sendEmail(to, subject, html, attachments, tenantId);
    }
}

function generateCTCBreakdownHtml(rawSnapshot) {
    if (!rawSnapshot) return '<p style="color: #777;">No CTC breakdown available.</p>';
    
    const snapObj = rawSnapshot.toObject ? rawSnapshot.toObject() : rawSnapshot;
    
    // Helper to clean and cast money values
    const toMoneyVal = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    
    const normComp = (item) => ({
        code: item.key || item.code || '',
        name: item.label || item.name || 'Component',
        monthlyAmount: toMoneyVal(item.monthly ?? item.monthlyAmount),
        yearlyAmount: toMoneyVal(item.yearly ?? item.yearlyAmount ?? item.annualAmount ?? ((item.monthly ?? item.monthlyAmount ?? 0) * 12))
    });

    const earnings = (snapObj.earnings || []).map(normComp);
    const employeeDeductions = (snapObj.deductions || snapObj.employeeDeductions || []).map(normComp);
    const benefits = (snapObj.employerBenefits || snapObj.benefits || []).map(normComp);

    const grossEarnings = toMoneyVal(snapObj.totals?.grossEarnings || earnings.reduce((sum, item) => sum + item.yearlyAmount, 0));
    const totalDeductions = toMoneyVal(snapObj.totals?.totalDeductions || employeeDeductions.reduce((sum, item) => sum + item.yearlyAmount, 0));
    const totalBenefits = toMoneyVal(snapObj.totals?.employerBenefits || benefits.reduce((sum, item) => sum + item.yearlyAmount, 0));
    const ctc = toMoneyVal(snapObj.totals?.annualCTC || snapObj.ctc || snapObj.annualCTC || (grossEarnings + totalBenefits));
    const netPay = toMoneyVal(snapObj.totals?.netSalary || snapObj.totals?.netPay || (grossEarnings - totalDeductions));

    const snapshot = {
        earnings,
        employeeDeductions,
        benefits,
        ctc,
        monthlyCTC: toMoneyVal(snapObj.totals?.monthlyCTC || ctc / 12),
        breakdown: {
            totalEarnings: grossEarnings,
            totalDeductions,
            totalBenefits,
            netPay
        },
        summary: {
            grossEarnings,
            totalDeductions,
            totalBenefits,
            netPay
        }
    };

    const cur = (val) => Math.round(val || 0).toLocaleString('en-IN');
    
    let html = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; text-align: left; border: 1px solid #e0e0e0;">
        <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                <th style="padding: 10px; border: 1px solid #e0e0e0;">Salary Component</th>
                <th style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">Monthly (₹)</th>
                <th style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">Yearly (₹)</th>
            </tr>
        </thead>
        <tbody>
    `;

    // 1. Earnings (Gross A)
    if (snapshot.earnings && snapshot.earnings.length > 0) {
        html += `
            <tr style="background-color: #f1f3f5; font-weight: bold;">
                <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">A. Earnings (Gross Pay)</td>
            </tr>
        `;
        snapshot.earnings.forEach(item => {
            html += `
                <tr>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">${item.name}</td>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(item.monthlyAmount)}</td>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(item.yearlyAmount)}</td>
                </tr>
            `;
        });
        const grossA = snapshot.breakdown?.totalEarnings || snapshot.summary?.grossEarnings || snapshot.grossA || 0;
        html += `
            <tr style="font-weight: bold; background-color: #f8f9fa;">
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Gross Earnings (A)</td>
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(grossA / 12)}</td>
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(grossA)}</td>
            </tr>
        `;
    }

    // 2. Benefits (Employer Contributions)
    if (snapshot.benefits && snapshot.benefits.length > 0) {
        html += `
            <tr style="background-color: #f1f3f5; font-weight: bold;">
                <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">B. Employer Contributions & Retirals</td>
            </tr>
        `;
        snapshot.benefits.forEach(item => {
            html += `
                <tr>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">${item.name}</td>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(item.monthlyAmount)}</td>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(item.yearlyAmount)}</td>
                </tr>
            `;
        });
        const totalBenefits = snapshot.breakdown?.totalBenefits || snapshot.summary?.totalBenefits || snapshot.employerContributions || 0;
        html += `
            <tr style="font-weight: bold; background-color: #f8f9fa;">
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Benefits (B)</td>
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(totalBenefits / 12)}</td>
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(totalBenefits)}</td>
            </tr>
        `;
    }

    // 3. Deductions (Employee Deductions)
    if (snapshot.employeeDeductions && snapshot.employeeDeductions.length > 0) {
        html += `
            <tr style="background-color: #f1f3f5; font-weight: bold;">
                <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">C. Employee Deductions</td>
            </tr>
        `;
        snapshot.employeeDeductions.forEach(item => {
            html += `
                <tr>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">${item.name}</td>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(item.monthlyAmount)}</td>
                    <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(item.yearlyAmount)}</td>
                </tr>
            `;
        });
        const totalDeductions = snapshot.breakdown?.totalDeductions || snapshot.summary?.totalDeductions || 0;
        html += `
            <tr style="font-weight: bold; background-color: #f8f9fa;">
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Deductions (C)</td>
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(totalDeductions / 12)}</td>
                <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(totalDeductions)}</td>
            </tr>
        `;
    }

    // 4. Totals (CTC & Take Home)
    const ctcYearly = snapshot.ctc || snapshot.ctcYearly || 0;
    const ctcMonthly = snapshot.monthlyCTC || snapshot.ctcMonthly || Math.round(ctcYearly / 12);
    const takeHome = snapshot.breakdown?.netPay || snapshot.summary?.netPay || snapshot.takeHomeMonthly || 0;

    html += `
        <tr style="font-weight: bold; background-color: #e9ecef; border-top: 2px solid #ced4da;">
            <td style="padding: 10px; border: 1px solid #e0e0e0;">Total Cost to Company (CTC)</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(ctcMonthly)}</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(ctcYearly)}</td>
        </tr>
        <tr style="font-weight: bold; background-color: #d3f9d8; color: #2b8a3e;">
            <td style="padding: 10px; border: 1px solid #e0e0e0;">Est. Take Home (Monthly Net Pay)</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(takeHome)}</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">${cur(takeHome * 12)}</td>
        </tr>
    `;

    html += `
        </tbody>
    </table>
    `;
    return html;
}

function generateCandidateDetailsHtml(applicant) {
    if (!applicant) return '<p style="color: #777;">No candidate details available.</p>';
    
    const fields = [
        { label: 'Application ID', value: applicant.applicationId },
        { label: 'Full Name', value: applicant.name },
        { label: 'Email Address', value: applicant.email },
        { label: 'Mobile Number', value: applicant.mobile },
        { label: 'Date of Birth', value: applicant.dob ? new Date(applicant.dob).toLocaleDateString('en-IN') : null },
        { label: 'Work Location', value: applicant.workLocation || applicant.location },
        { label: 'Current Designation', value: applicant.currentDesignation },
        { label: 'Current Company', value: applicant.currentCompany },
        { label: 'Current CTC', value: applicant.currentCTC ? `₹ ${Number(applicant.currentCTC).toLocaleString('en-IN')}` : null },
        { label: 'Expected CTC', value: applicant.expectedCTC ? `₹ ${Number(applicant.expectedCTC).toLocaleString('en-IN')}` : null },
        { label: 'Notice Period', value: applicant.noticePeriod === true ? 'Yes' : (applicant.noticePeriod === false ? 'No' : applicant.noticePeriod) },
        { label: 'Experience', value: applicant.experience ? `${applicant.experience} Years` : null },
        { label: 'Skills', value: applicant.parsedSkills?.join(', ') || applicant.matchedSkills?.join(', ') }
    ];

    let html = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; text-align: left; border: 1px solid #e0e0e0;">
        <tbody>
    `;

    fields.forEach((field, index) => {
        if (field.value !== undefined && field.value !== null && field.value !== '') {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
            html += `
                <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 10px; width: 35%; font-weight: bold; border: 1px solid #e0e0e0; color: #495057;">${field.label}</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; color: #212529;">${field.value}</td>
                </tr>
            `;
        }
    });

    html += `
        </tbody>
    </table>
    `;
    return html;
}

module.exports = new EmailService();