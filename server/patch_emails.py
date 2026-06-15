import sys
path = 'D:/Project/GT_HRMS/server/controllers/recruitment.workflow.controller.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = "const { sendMail } = require('../utils/emailService');\n"
if import_statement not in content:
    content = import_statement + content

old_code = '''        await session.commitTransaction();

        res.status(201).json({'''

new_code = '''        await session.commitTransaction();

        // ─────────────────────────────────────────────────────────────────
        // SEND EMAILS
        // ─────────────────────────────────────────────────────────────────
        try {
            const candidateEmail = application.candidateId?.email;
            let interviewerEmail = interviewData.interviewerEmail;
            
            if (!interviewData.isExternalInterviewer && interviewData.interviewerId) {
                const Employee = getModels(db).Employee;
                const employee = await Employee.findById(interviewData.interviewerId);
                if (employee) {
                    interviewerEmail = employee.email;
                }
            }

            const interviewTimeStr = `${interviewData.date} at ${interviewData.time}`;
            const locationStr = interviewData.mode === 'Online' ? `Online Meeting Link: ${interviewData.meetingLink}` : `Location: ${interviewData.location}`;
            
            // Email to Candidate
            if (candidateEmail) {
                await sendMail({
                    to: candidateEmail,
                    subject: 'Interview Scheduled',
                    html: `<p>Dear ${application.candidateId?.firstName || 'Candidate'},</p>
                           <p>Your interview has been scheduled.</p>
                           <p><strong>Round:</strong> ${interviewData.stage || 'Technical'}</p>
                           <p><strong>Time:</strong> ${interviewTimeStr}</p>
                           <p><strong>Mode:</strong> ${interviewData.mode}</p>
                           <p>${locationStr}</p>
                           <p>Best regards,<br/>HR Team</p>`
                });
            }

            // Email to Interviewer
            if (interviewerEmail) {
                await sendMail({
                    to: interviewerEmail,
                    subject: 'Interview Scheduled - Interviewer Notification',
                    html: `<p>Dear ${interviewData.interviewerName || 'Interviewer'},</p>
                           <p>An interview has been scheduled for you to conduct.</p>
                           <p><strong>Candidate:</strong> ${application.candidateId?.firstName || ''} ${application.candidateId?.lastName || ''}</p>
                           <p><strong>Round:</strong> ${interviewData.stage || 'Technical'}</p>
                           <p><strong>Time:</strong> ${interviewTimeStr}</p>
                           <p><strong>Mode:</strong> ${interviewData.mode}</p>
                           <p>${locationStr}</p>
                           <p>Best regards,<br/>HR Team</p>`
                });
            }
        } catch (emailError) {
            console.error('Error sending interview emails:', emailError);
            // Non-blocking error, we still return success
        }

        res.status(201).json({'''

content = content.replace(old_code, new_code)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Emails logic added')
