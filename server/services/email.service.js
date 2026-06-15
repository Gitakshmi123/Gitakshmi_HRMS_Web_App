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
            logger: false
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




    /**
     * Send an email to a specific recipient
     * @param {string} to - Recipient email address
     * @param {string} subject - Subject line
     * @param {string} html - HTML body content
     * @returns {Promise<Object>} - The result of the send operation
     */
    async sendEmail(to, subject, html) {
        try {
            if (!to) {
                throw new Error("Recipient email address is required.");
            }

            // console.log(`📧 [EmailService] Sending email to: ${to}`);

            const mailOptions = {
                from: process.env.EMAIL_FROM || `"Gitakshmi HR Team" <${this.smtpUser}>`,
                to: to,
                subject: subject,
                html: html,
            };

            const info = await this.transporter.sendMail(mailOptions);

            // console.log(`✅ [EmailService] Email sent successfully. MessageID: ${info.messageId}`);
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error(`❌ [EmailService] Failed to send email to ${to}:`, error.message);

            // Make SMTP auth errors actionable (common with Gmail if password/app-password is wrong)
            if (error && (error.code === 'EAUTH' || error.responseCode === 535)) {
                const err = new Error(
                    'SMTP authentication failed (535). Check SMTP_USER/SMTP_PASS. ' +
                    'For Gmail, use an App Password (not your Gmail password) and ensure SMTP_PASS has no spaces.'
                );
                err.status = 500;
                err.error = 'smtp_auth_failed';
                throw err;
            }

            // We throw the error so the calling controller handles it
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
    async sendApplicationStatusEmail(to, candidateName, jobTitle, applicationId, status, feedback = null, rating = null) {
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

        return this.sendEmail(to, subject, html);
    }

    // Alias for backward compatibility
    async sendStatusEmail(to, candidateName, jobTitle, applicationId, status) {
        return this.sendApplicationStatusEmail(to, candidateName, jobTitle, applicationId, status);
    }

    /**
     * Send Offer Letter Email with Attachment
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Candidate Name
     * @param {string} jobTitle - Job Title
     * @param {string} companyName - Company Name
     * @param {string} offerLetterPdfPath - Path to the generated PDF file
     */
    async sendOfferLetterEmail(to, candidateName, jobTitle, companyName, offerLetterPdfPath, customHtml = null, applicant = null) {
        const subject = `Offer Letter – ${companyName}`;

        let html = customHtml;

        if (html) {
             const ctcBreakdown = applicant ? generateCTCBreakdownHtml(applicant.salarySnapshotId || applicant.salarySnapshot) : '';
             const candidateDetails = applicant ? generateCandidateDetailsHtml(applicant) : '';

             html = html.replace(/{{candidateName}}/g, candidateName)
                        .replace(/{{jobTitle}}/g, jobTitle)
                        .replace(/{{companyName}}/g, companyName)
                        .replace(/{{ctcBreakdown}}/g, ctcBreakdown)
                        .replace(/{{candidateDetails}}/g, candidateDetails)
                        .replace(/{{department}}/g, applicant?.department || '')
                        .replace(/{{ctcYearly}}/g, applicant?.ctcYearly || '')
                        .replace(/{{joiningDate}}/g, applicant?.joiningDate ? new Date(applicant.joiningDate).toLocaleDateString() : '')
                        .replace(/{{currentDesignation}}/g, applicant?.currentDesignation || '')
                        .replace(/{{currentCTC}}/g, applicant?.currentCTC || '');
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
            const mailOptions = {
                from: process.env.EMAIL_FROM || `"Gitakshmi HR Team" <${this.smtpUser}>`,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
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
    async sendJoiningLetterEmail(to, candidateName, jobTitle, companyName, joiningDate, joiningLetterPdfPath) {
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
            const mailOptions = {
                from: process.env.EMAIL_FROM || `"Gitakshmi HR Team" <${this.smtpUser}>`,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
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
    async sendInterviewScheduledEmail(to, candidateName, jobTitle, interviewDetails, isForInterviewer = false) {
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
        return this.sendEmail(to, subject, html);
    }

    /**
     * Send Interview Rescheduled Email
     */
    async sendInterviewRescheduledEmail(to, candidateName, jobTitle, interviewDetails, isForInterviewer = false) {
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
        return this.sendEmail(to, subject, html);
    }
    /**
     * Send Application Received Email to Candidate
     */
    async sendCandidateAppliedEmail(to, candidateName, jobTitle, companyName) {
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
        return this.sendEmail(to, subject, html);
    }

    /**
     * Send New Application Notification to Company
     */
    async sendCompanyNewApplicationEmail(to, candidateName, jobTitle, applicantId) {
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
            return this.sendEmail(to, subject, html);
        }
        return Promise.resolve();
    }

    /**
     * Send Offer Fully Signed Email
     */
    async sendOfferFullySignedEmail(to, candidateName, jobTitle, companyName) {
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
        return this.sendEmail(to, subject, html);
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
            subject = customTemplate.subject
                       .replace(/{{candidateName}}/g, candidateName)
                       .replace(/{{jobTitle}}/g, jobTitle)
                       .replace(/{{companyName}}/g, companyName)
                       .replace(/{{department}}/g, details.department || '');
        }

        if (html) {
            const applicant = details.applicant;
            const ctcBreakdown = applicant ? generateCTCBreakdownHtml(applicant.salarySnapshotId || applicant.salarySnapshot) : '';
            const candidateDetails = applicant ? generateCandidateDetailsHtml(applicant) : '';

            html = html.replace(/{{candidateName}}/g, candidateName)
                       .replace(/{{jobTitle}}/g, jobTitle)
                       .replace(/{{companyName}}/g, companyName)
                       .replace(/{{approvalUrl}}/g, approvalUrl)
                       .replace(/{{department}}/g, details.department || '')
                       .replace(/{{ctcYearly}}/g, details.ctcYearly || '')
                       .replace(/{{joiningDate}}/g, details.joiningDate || '')
                       .replace(/{{currentDesignation}}/g, details.currentDesignation || (applicant ? applicant.currentDesignation : '') || '')
                       .replace(/{{currentCTC}}/g, details.currentCTC || (applicant ? applicant.currentCTC : '') || '')
                       .replace(/{{ctcBreakdown}}/g, ctcBreakdown)
                       .replace(/{{candidateDetails}}/g, candidateDetails);
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
        return this.sendEmail(to, subject, html, attachments);
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
                       .replace(/{{companyName}}/g, companyName)
                       .replace(/{{department}}/g, details.department || '');
        }

        if (html) {
            html = html.replace(/{{candidateName}}/g, candidateName)
                       .replace(/{{jobTitle}}/g, jobTitle)
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

        return this.sendEmail(to, subject, html, attachments);
    }
}

function generateCTCBreakdownHtml(snapshot) {
    if (!snapshot) return '<p style="color: #777;">No CTC breakdown available.</p>';
    
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