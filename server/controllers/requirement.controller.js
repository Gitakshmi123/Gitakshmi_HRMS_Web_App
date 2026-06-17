const RecruitmentService = require('../services/Recruitment.service');
const mongoose = require('mongoose');
const emailService = require('../services/email.service');

const formatLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

exports.saveDraft = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { step, data, draftId } = req.body;

        if (!step) return res.status(400).json({ message: "Step number is required" });

        const result = await RecruitmentService.saveDraft(tenantId, parseInt(step), data, req.user.id, draftId);
        res.status(200).json({ success: true, draftId: String(result._id), draft: result });
    } catch (error) {
        console.error('[saveDraft ERROR]', error);
        res.status(400).json({ message: error.message });
    }
};

exports.publishJob = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { draftId } = req.body;

        if (!draftId) return res.status(400).json({ message: "Draft ID is required to publish" });

        const result = await RecruitmentService.publishJob(tenantId, draftId, req.user.id);
        res.status(201).json({ success: true, message: "Job published successfully", job: result });
    } catch (error) {
        console.error('[publishJob ERROR]', {
            message: error.message,
            draftId: req.body?.draftId,
            validation: error.errors ? Object.keys(error.errors).reduce((acc, key) => {
                acc[key] = error.errors[key]?.message;
                return acc;
            }, {}) : undefined
        });
        res.status(400).json({ message: error.message });
    }
};

exports.notifyInterviewerAssignment = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { employeeId, isExternal, externalName, externalEmail, stageName, jobTitle, department, mode, durationMinutes } = req.body;

        let employeeName = '';
        let employeeCode = '';
        let targetEmail = '';

        if (isExternal) {
            if (!externalEmail || !externalName) {
                return res.status(400).json({ success: false, message: 'External name and email are required.' });
            }
            employeeName = externalName;
            targetEmail = externalEmail;
            employeeCode = 'External';
        } else {
            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return res.status(400).json({ success: false, message: 'Valid interviewer is required.' });
            }

            const db = req.tenantDB || mongoose.connection;
            const Employee = db.model('Employee');
            const Notification = db.model('Notification');
            const interviewer = await Employee.findOne({ _id: employeeId, tenant: tenantId }).lean();

            if (!interviewer) {
                return res.status(404).json({ success: false, message: 'Interviewer employee not found.' });
            }

            employeeName = [interviewer.firstName, interviewer.lastName].filter(Boolean).join(' ')
                || interviewer.name
                || interviewer.fullName
                || interviewer.email
                || 'Interviewer';
            employeeCode = interviewer.employeeId || interviewer.employeeCode || '';
            targetEmail = interviewer.email;
            
            // Notifications are only for internal employees
            const title = `Interview assignment: ${String(stageName || 'Interview Stage').trim()}`;
            const message = `You have been assigned as interviewer for ${String(stageName || 'Interview Stage').trim()} in ${String(jobTitle || 'Job Opening').trim()}${department ? ` (${department})` : ''}. Mode: ${mode || 'Online'}, Duration: ${durationMinutes || 30} min.`;

            await Notification.create({
                tenant: tenantId,
                receiverId: interviewer._id,
                receiverRole: 'employee',
                entityType: 'InterviewAssignment',
                entityId: interviewer._id,
                title,
                message,
            });
        }

        const finalStageName = String(stageName || 'Interview Stage').trim();
        const finalJobTitle = String(jobTitle || 'Job Opening').trim();
        const finalDepartment = String(department || '').trim();
        const finalMode = String(mode || 'Online').trim();
        const finalDuration = Number(durationMinutes) > 0 ? Number(durationMinutes) : 30;

        let emailSent = false;
        let emailError = null;
        if (targetEmail) {
            const subject = `Interview Assignment - ${finalJobTitle}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background: #1e3a8a; color: #fff; padding: 18px 22px;">
                        <h2 style="margin: 0; font-size: 18px;">Interview Assignment</h2>
                    </div>
                    <div style="padding: 22px; color: #111827;">
                        <p>Dear <strong>${employeeName}</strong>${employeeCode && !isExternal ? ` (${employeeCode})` : (isExternal ? ' (External Interviewer)' : '')},</p>
                        <p>You have been assigned as an interviewer for the following hiring stage.</p>
                        <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 16px; margin: 18px 0;">
                            <p style="margin: 6px 0;"><strong>Job:</strong> ${finalJobTitle}</p>
                            ${finalDepartment ? `<p style="margin: 6px 0;"><strong>Department:</strong> ${finalDepartment}</p>` : ''}
                            <p style="margin: 6px 0;"><strong>Stage:</strong> ${finalStageName}</p>
                            <p style="margin: 6px 0;"><strong>Mode:</strong> ${finalMode}</p>
                            <p style="margin: 6px 0;"><strong>Duration:</strong> ${finalDuration} min</p>
                        </div>
                        <p>Please check your calendar ${!isExternal ? 'or HRMS employee panel ' : ''}for the assignment details.</p>
                    </div>
                </div>
            `;
            try {
                await emailService.sendEmail(targetEmail, subject, html, [], tenantId);
                emailSent = true;
            } catch (error) {
                emailError = error.message || 'Email delivery failed.';
                console.error('[notifyInterviewerAssignment EMAIL ERROR]', emailError);
            }
        }

        return res.json({ success: true, notified: true, emailSent, emailError });
    } catch (error) {
        console.error('[notifyInterviewerAssignment ERROR]', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to notify interviewer.' });
    }
};

exports.getDraft = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { RequirementDraft } = await RecruitmentService.getModels(tenantId);
        const draft = await RequirementDraft.findOne({ _id: req.params.id, tenant: tenantId });
        if (!draft) return res.status(404).json({ message: "Draft not found" });
        res.json(draft);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createRequirement = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const result = await RecruitmentService.createRequirement(tenantId, req.body, req.user.id);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getRequirements = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const result = await RecruitmentService.getRequirements(tenantId, req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRequirementById = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ message: 'Invalid requirement id' });
        }
        const requirement = await RecruitmentService.getRequirementById(tenantId, req.params.id);
        if (!requirement) return res.status(404).json({ message: 'Requirement not found' });
        res.json(requirement);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRequirementsByDate = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { Requirement } = await RecruitmentService.getModels(tenantId);
        const dateValue = req.query.date ? new Date(req.query.date) : new Date();

        if (Number.isNaN(dateValue.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date' });
        }

        const start = new Date(dateValue);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const requirements = await Requirement.find({
            createdAt: { $gte: start, $lt: end }
        })
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            date: formatLocalDateKey(start),
            requirements,
            summary: {
                total: requirements.length,
                open: requirements.filter(item => item.status === 'Open').length,
                closed: requirements.filter(item => item.status === 'Closed').length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getRequirementsTrend = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { Requirement } = await RecruitmentService.getModels(tenantId);
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));

        const rows = await Requirement.aggregate([
            { $match: { createdAt: { $gte: start } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    total: { $sum: 1 },
                    open: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                    closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const byDate = new Map(rows.map(row => [row._id, row]));
        const trend = Array.from({ length: days }, (_, index) => {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            const key = formatLocalDateKey(date);
            const row = byDate.get(key) || {};
            return {
                date: key,
                total: row.total || 0,
                open: row.open || 0,
                closed: row.closed || 0
            };
        });

        res.json({ success: true, days, trend });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getInternalJobs = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const query = { status: 'Open', $or: [{ isInternal: true }, { visibility: { $in: ['Internal', 'Both'] } }] };
        const result = await RecruitmentService.getRequirements(tenantId, query);
        // Extract array if pagination object is returned
        const jobs = result.requirements || result;
        res.json({ success: true, jobs: jobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.registerReferralCode = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const db = await require('../utils/tenantDB')(tenantId);
        
        if (!db) {
            console.error('[registerReferralCode] No tenant DB resolved');
            return res.status(500).json({ success: false, message: 'Configuration error: DB not found' });
        }

        const ReferralCode = db.models.ReferralCode
            ? db.model('ReferralCode')
            : db.model('ReferralCode', require('../models/ReferralCode'));
        const Employee = db.model('Employee');

        const employee = await Employee.findOne({
            $or: [{ _id: req.user.id }, { email: req.user.email }]
        }).select('referralCode _id firstName lastName').lean();

        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!code) return res.status(400).json({ success: false, message: 'Referral code is required' });

        if (!employee) {
            return res.json({
                success: true,
                skipped: true,
                message: 'Referral registration skipped because no employee profile is linked to this login.'
            });
        }

        const referrerName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();

        await ReferralCode.updateOne(
            { tenant: tenantId, referrerEmployeeId: employee._id },
            {
                $set: {
                    code,
                    referrerName,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    tenant: tenantId,
                    referrerEmployeeId: employee._id
                }
            },
            { upsert: true }
        );

        res.json({ success: true, message: 'Referral code registered' });
    } catch (error) {
        console.error('[registerReferralCode ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resolveReferralCode = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const code = String(req.query?.code || '').trim().toUpperCase();
        if (!code) return res.status(400).json({ success: false, message: 'code_required' });

        const db = await require('../utils/tenantDB')(tenantId);
        if (!db.models.ReferralCode) {
            db.model('ReferralCode', require('../models/ReferralCode'));
        }
        const ReferralCode = db.model('ReferralCode');

        const doc = await ReferralCode.findOne({ tenant: tenantId, code })
            .select('code referrerEmployeeId referrerName')
            .lean();

        if (!doc) return res.json({ success: true, found: false });
        res.json({
            success: true,
            found: true,
            code: doc.code,
            referrerEmployeeId: doc.referrerEmployeeId,
            referrerName: doc.referrerName || ''
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getReferralStats = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const requirementId = String(req.query?.requirementId || '').trim();

        const db = await require('../utils/tenantDB')(tenantId);
        const Applicant = db.model('Applicant');

        const match = {
            tenant: new (require('mongoose').Types.ObjectId)(tenantId),
            'referral.referrerEmployeeId': { $ne: null }
        };
        if (requirementId) match.requirementId = new (require('mongoose').Types.ObjectId)(requirementId);

        const rows = await Applicant.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        requirementId: '$requirementId',
                        referrerEmployeeId: '$referral.referrerEmployeeId',
                        referrerName: '$referral.referrerName'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({ success: true, rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.applyInternal = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const result = await RecruitmentService.applyInternal(
            tenantId,
            req.params.id,
            req.user,
            req.body?.referral || null,
            req.body?.applicant || null
        );
        res.status(201).json({ message: "Successfully applied internally", applicationId: result._id });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getMyApplications = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const summaryOnly = ['1', 'true', 'yes'].includes(
            String(req.query.summary || '').trim().toLowerCase()
        );
        const result = await RecruitmentService.getApplicantApplications(tenantId, req.user, {
            summary: summaryOnly
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMyReferrals = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const result = await RecruitmentService.getMyReferrals(tenantId, req.user);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.withdrawInternal = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { id } = req.params;
        const { reason } = req.body;

        const db = await require('../utils/tenantDB')(tenantId);
        const Applicant = db.model('Applicant');

        // Find the application and verify ownership
        const applicant = await Applicant.findOne({
            _id: id,
            tenant: tenantId,
            employeeId: req.user.id
        });

        if (!applicant) {
            return res.status(404).json({ message: 'Application not found or not authorized.' });
        }

        // Block withdrawal if already in advanced stages or already closed
        const blockedStatuses = ['Withdrawn', 'Rejected', 'Selected', 'Offer Issued', 'Joined', 'WITHDRAWN', 'REJECTED', 'SELECTED', 'OFFERED', 'JOINED'];
        if (blockedStatuses.includes(applicant.status)) {
            return res.status(400).json({ message: `Cannot withdraw: application is already in '${applicant.status}' state.` });
        }

        // Update status to Withdrawn
        applicant.status = 'Withdrawn';
        applicant.timeline.push({
            status: 'Withdrawn',
            message: reason ? `Withdrawn by employee. Reason: ${reason}` : 'Withdrawn by employee via self-service portal.',
            updatedBy: req.user.name || req.user.email || 'Employee',
            timestamp: new Date()
        });

        await applicant.save();

        res.json({ success: true, message: 'Application withdrawn successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.updateStatus = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const { status } = req.body;
        const result = await RecruitmentService.updateRequirement(tenantId, req.params.id, { status }, req.user.id);
        res.json({ success: true, message: "Status updated successfully", requirement: result });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getApplicants = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const result = await RecruitmentService.getTenantApplications(tenantId, {
            requirementId: req.query?.requirementId
        });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateRequirement = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const result = await RecruitmentService.updateRequirement(tenantId, req.params.id, req.body, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


exports.deleteRequirement = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        await RecruitmentService.deleteRequirement(tenantId, req.params.id);
        res.json({ message: 'Requirement deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
