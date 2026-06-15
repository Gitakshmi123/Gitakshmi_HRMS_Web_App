const mongoose = require('mongoose');
const payrollPhase2 = require('../services/payrollPhase2.service');

const getTenantModel = (req, modelName) => {
    if (req.tenantDB) return req.tenantDB.model(modelName);
    return mongoose.model(modelName);
};

const getEmployeeId = (req) => req.user?.id || req.user?._id;

const STAGE_ORDER = [
    'Requested', 'HR Review', 'Notice Period',
    'Clearance', 'Exit Interview', 'FNF', 'Letters Generated', 'Deactivated'
];

/** Default department tasks (IT, Admin, Finance) — assigned department + status pending/completed */
const DEFAULT_DEPT_TASKS = [
    { department: 'IT',      task: 'Disable employee email'               },
    { department: 'IT',      task: 'Revoke email & all system access'      },
    { department: 'IT',      task: 'Disable VPN / remote access'           },
    { department: 'IT',      task: 'Collect laptop and peripherals'        },
    { department: 'IT',      task: 'Remove from Active Directory / LDAP'   },
    { department: 'Admin',  task: 'Collect laptop and ID card'            },
    { department: 'Admin',   task: 'Collect ID card & access badge'        },
    { department: 'Admin',   task: 'Collect office keys & parking pass'    },
    { department: 'Admin',   task: 'Workstation / desk clearance'           },
    { department: 'Finance', task: 'Clear finance dues'                    },
    { department: 'Finance', task: 'Clear outstanding advances / loans'   },
    { department: 'Finance', task: 'Prepare Full & Final Settlement'       },
    { department: 'HR',      task: 'Collect NOC from department head'      },
    { department: 'HR',      task: 'Update employee master records'       },
];

// ── Letter template helpers ───────────────────────────────────────────────

function buildExperienceLetter({ empName, empId, designation, department, joiningDate, lwd, companyName, gender }) {
    const he  = gender === 'Female' ? 'she' : 'he';
    const his = gender === 'Female' ? 'her' : 'his';
    const him = gender === 'Female' ? 'her' : 'him';
    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
    return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:48px;border:1px solid #e2e8f0;line-height:1.8;">
  <div style="text-align:center;margin-bottom:32px;border-bottom:3px solid #0d9488;padding-bottom:20px;">
    <h2 style="color:#0d9488;margin:0;font-size:22px;letter-spacing:1px;">${companyName}</h2>
    <p style="color:#64748b;margin:4px 0 0 0;font-size:13px;">Human Resources Department</p>
  </div>
  <p style="text-align:right;color:#64748b;font-size:13px;margin-bottom:24px;">Date: ${fmt(new Date())}</p>
  <h3 style="text-align:center;text-decoration:underline;color:#1e293b;letter-spacing:2px;margin:24px 0 32px 0;font-size:16px;">EXPERIENCE LETTER</h3>
  <p style="color:#475569;font-size:13px;font-weight:700;margin-bottom:20px;">TO WHOMSOEVER IT MAY CONCERN</p>
  <p style="color:#374151;font-size:14px;margin-bottom:16px;">This is to certify that <strong>${empName}</strong> (Employee ID: <strong>${empId}</strong>) has been employed with <strong>${companyName}</strong> from <strong>${fmt(joiningDate)}</strong> to <strong>${fmt(lwd)}</strong> in the capacity of <strong>${designation || 'Employee'}</strong> in the <strong>${department || '—'}</strong> department.</p>
  <p style="color:#374151;font-size:14px;margin-bottom:16px;">During this period of service, ${he} has been a dedicated and hardworking employee and has discharged all duties assigned to ${him} with sincerity and devotion. ${he.charAt(0).toUpperCase() + he.slice(1)} has maintained exemplary professional conduct throughout ${his} tenure with us.</p>
  <p style="color:#374151;font-size:14px;margin-bottom:40px;">We wish ${him} all the best in ${his} future endeavors.</p>
  <p style="color:#374151;font-size:14px;margin-bottom:60px;">For <strong>${companyName}</strong>,</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:inline-block;">
    <p style="color:#1e293b;font-size:14px;font-weight:700;margin:0;">Authorized Signatory</p>
    <p style="color:#64748b;font-size:13px;margin:2px 0 0 0;">HR Department</p>
  </div>
</div>`;
}

function buildRelievingLetter({ empName, empId, designation, department, joiningDate, lwd, companyName, gender }) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
    let nextDayStr = 'N/A';
    if (lwd) {
        const nd = new Date(lwd); nd.setDate(nd.getDate() + 1);
        nextDayStr = fmt(nd);
    }
    return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:48px;border:1px solid #e2e8f0;line-height:1.8;">
  <div style="text-align:center;margin-bottom:32px;border-bottom:3px solid #0d9488;padding-bottom:20px;">
    <h2 style="color:#0d9488;margin:0;font-size:22px;letter-spacing:1px;">${companyName}</h2>
    <p style="color:#64748b;margin:4px 0 0 0;font-size:13px;">Human Resources Department</p>
  </div>
  <p style="text-align:right;color:#64748b;font-size:13px;margin-bottom:24px;">Date: ${fmt(new Date())}</p>
  <h3 style="text-align:center;text-decoration:underline;color:#1e293b;letter-spacing:2px;margin:24px 0 32px 0;font-size:16px;">RELIEVING LETTER</h3>
  <p style="color:#374151;font-size:14px;margin-bottom:16px;">Dear <strong>${empName}</strong>,</p>
  <p style="color:#374151;font-size:14px;margin-bottom:16px;">This is to confirm that you have been associated with <strong>${companyName}</strong> as <strong>${designation || 'Employee'}</strong> in the <strong>${department || '—'}</strong> department from <strong>${fmt(joiningDate)}</strong> to <strong>${fmt(lwd)}</strong>.</p>
  <p style="color:#374151;font-size:14px;margin-bottom:16px;">We accept your resignation and hereby relieve you from all duties and responsibilities with effect from the close of business on <strong>${fmt(lwd)}</strong>. You are free to join another organization from <strong>${nextDayStr}</strong>.</p>
  <p style="color:#374151;font-size:14px;margin-bottom:40px;">We appreciate your contributions during your tenure and wish you great success in all your future endeavors.</p>
  <p style="color:#374151;font-size:14px;margin-bottom:60px;">For <strong>${companyName}</strong>,</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:inline-block;">
    <p style="color:#1e293b;font-size:14px;font-weight:700;margin:0;">Authorized Signatory</p>
    <p style="color:#64748b;font-size:13px;margin:2px 0 0 0;">HR Department</p>
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle validation: check if employee can submit an exit request
// (salary structure assigned, status ACTIVE, profile complete)
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = ['ACTIVE', 'Active', 'active'];

async function hasSalaryStructure(tenantDB, tenantId, employeeId, employeeDoc) {
    if (!tenantDB || !employeeId) return false;
    try {
        if (tenantDB.models.EmployeeCompensation) {
            const comp = await tenantDB.model('EmployeeCompensation').findOne({
                companyId: tenantId,
                employeeId,
                status: 'ACTIVE',
                isActive: true,
                totalCTC: { $gt: 0 }
            }).lean();
            if (comp) return true;
        }
    } catch (e) { /* ignore */ }
    try {
        const SalaryStructure = mongoose.model('SalaryStructure');
        const structure = await SalaryStructure.findOne({
            tenantId,
            status: 'ACTIVE',
            $and: [
                { $or: [{ employee: employeeId }, { candidateId: employeeId }] },
                { $or: [{ 'totals.annualCTC': { $gt: 0 } }, { 'totals.monthlyCTC': { $gt: 0 } }] }
            ]
        }).lean();
        if (structure) return true;
    } catch (e) { /* ignore */ }
    if (employeeDoc && (employeeDoc.salaryTemplateId || employeeDoc.currentSnapshotId) && (Number(employeeDoc.salary) > 0 || employeeDoc.currentSnapshotId)) return true;
    if (employeeDoc && Number(employeeDoc.salary) > 0) return true;
    return false;
}

async function checkExitSubmissionEligibility(req) {
    const employeeId = getEmployeeId(req);
    if (!employeeId) return { allowed: false, message: 'Authentication required.' };
    const tenantDB = req.tenantDB;
    const tenantId = req.tenantId;
    if (!tenantId) return { allowed: false, message: 'Salary structure not configured. Please contact HR.' };
    if (!tenantDB) return { allowed: false, message: 'Salary structure not configured. Please contact HR.' };

    const Employee = getTenantModel(req, 'Employee');
    const employee = await Employee.findById(employeeId).select('status firstName email salary salaryTemplateId currentSnapshotId').lean();
    if (!employee) return { allowed: false, message: 'Employee record not found. Please contact HR.' };

    const status = (employee.status || '').trim();
    if (!ACTIVE_STATUSES.includes(status)) {
        return { allowed: false, message: 'Only active employees can submit exit requests. Please contact HR.' };
    }

    const hasSalary = await hasSalaryStructure(tenantDB, tenantId, employeeId, employee);
    if (!hasSalary) {
        return { allowed: false, message: 'Salary structure not configured. Please contact HR.' };
    }

    if (!employee.firstName && !employee.email) {
        return { allowed: false, message: 'Employee profile is incomplete. Please contact HR.' };
    }

    return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exit/can-submit  — Check if current employee can submit exit request (for UI)
// ─────────────────────────────────────────────────────────────────────────────
exports.canSubmit = async (req, res) => {
    try {
        const result = await checkExitSubmissionEligibility(req);
        if (result.allowed) {
            return res.status(200).json({ success: true, canSubmit: true });
        }
        return res.status(200).json({ success: true, canSubmit: false, reason: result.message });
    } catch (err) {
        console.error('[exit] canSubmit:', err.message);
        return res.status(500).json({ success: false, canSubmit: false, reason: 'Unable to verify eligibility. Please contact HR.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exit/request  — Employee submits resignation
// ─────────────────────────────────────────────────────────────────────────────
exports.submitRequest = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Authentication required.' });

        const eligibility = await checkExitSubmissionEligibility(req);
        if (!eligibility.allowed) {
            return res.status(400).json({ success: false, message: eligibility.message });
        }

        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { reason, comments, noticePeriodDays, lastWorkingDate, exitType } = req.body;

        if (!reason) return res.status(400).json({ success: false, message: 'reason is required.' });

        // Block if employee has any exit request that is not yet completed or rejected
        const existing = await ExitRequest.findOne({
            tenant: req.tenantId,
            employee: employeeId,
            status: { $nin: ['Completed', 'Rejected'] }
        });
        if (existing) return res.status(409).json({
            success: false,
            message: 'You already have an active exit request.'
        });

        const doc = new ExitRequest({
            tenant: req.tenantId, employee: employeeId,
            exitType: exitType || 'Resignation', reason, comments,
            noticePeriodDays: noticePeriodDays || 30, lastWorkingDate,
            stage: 'Requested', status: 'Pending'
        });
        await doc.save();
        res.status(201).json({ success: true, data: doc, message: 'Resignation submitted successfully.' });
    } catch (err) {
        console.error('[exit] submitRequest:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exit/my-requests  — Employee views own requests (with workflow summary)
// ─────────────────────────────────────────────────────────────────────────────
function addWorkflowSummary(doc) {
    if (!doc) return doc;
    const d = doc.toObject ? doc.toObject() : { ...doc };
    const start = d.noticePeriodStartDate ? new Date(d.noticePeriodStartDate) : null;
    const end = d.lastWorkingDate ? new Date(d.lastWorkingDate) : (start && d.noticePeriodDays ? (() => { const e = new Date(start); e.setDate(e.getDate() + (d.noticePeriodDays || 0)); return e; })() : null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let remainingDays = null;
    if (end) {
        const endDate = new Date(end);
        endDate.setHours(0, 0, 0, 0);
        remainingDays = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    }
    const stageIdx = STAGE_ORDER.indexOf(d.stage);
    d.workflowSummary = {
        noticePeriodStartDate: start,
        noticePeriodEndDate: end,
        remainingDays,
        currentStageIndex: stageIdx >= 0 ? stageIdx + 1 : 0,
        totalStages: STAGE_ORDER.length,
        progressPercent: d.status === 'Completed' ? 100 : Math.round(((stageIdx + 0.5) / STAGE_ORDER.length) * 100)
    };
    return d;
}

exports.getMyRequests = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const requests = await ExitRequest
            .find({ tenant: req.tenantId, employee: getEmployeeId(req) })
            .populate('hrId', 'firstName lastName')
            .sort({ createdAt: -1 });
        const withSummary = requests.map(r => addWorkflowSummary(r));
        res.status(200).json({ success: true, data: withSummary });
    } catch (err) {
        console.error('[exit] getMyRequests:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exit/all — HR views all requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllRequests = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { status, stage, page = 1, limit = 50 } = req.query;
        const filter = { tenant: req.tenantId };
        if (status) filter.status = status;
        if (stage)  filter.stage  = stage;

        const [requests, total] = await Promise.all([
            ExitRequest.find(filter)
                .populate('employee', 'firstName lastName employeeId department designation email dateOfJoining joiningDate gender')
                .populate('hrId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip((+page - 1) * +limit).limit(+limit)
                .lean(),
            ExitRequest.countDocuments(filter)
        ]);
        const withSummary = requests.map(r => addWorkflowSummary(r));
        res.status(200).json({ success: true, data: withSummary, total });
    } catch (err) {
        console.error('[exit] getAllRequests:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/stage/:id  — HR advances the offboarding stage
// ─────────────────────────────────────────────────────────────────────────────
exports.updateStage = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const { stage, remarks, lastWorkingDate } = req.body;

        if (!STAGE_ORDER.includes(stage))
            return res.status(400).json({ success: false, message: `Invalid stage: ${stage}` });

        const current = await ExitRequest.findOne({ _id: id, tenant: req.tenantId });
        if (!current) return res.status(404).json({ success: false, message: 'Request not found.' });

        const update = { stage, hrId: getEmployeeId(req) };
        if (remarks)         update.hrRemarks       = remarks;
        if (lastWorkingDate) update.lastWorkingDate  = lastWorkingDate;

        if (stage === 'HR Review')     update.hrReviewedAt = new Date();
        if (stage === 'Notice Period') {
            update.status = 'Approved';
            update.hrApprovedAt = new Date();
            update.noticePeriodStartDate = current.noticePeriodStartDate || new Date();
        }
        if (stage === 'Deactivated')   update.status = 'Completed';

        if (stage === 'Clearance' && (!current.departmentTasks || current.departmentTasks.length === 0)) {
            update.departmentTasks = DEFAULT_DEPT_TASKS.map(t => ({ ...t, status: 'Pending' }));
        }
        if (stage === 'Exit Interview' && current.stage !== 'Exit Interview') {
            update.clearanceCompletedAt = new Date();
        }

        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId }, update, { new: true }
        );

        // When exit reaches Deactivated (ACCOUNT_DEACTIVATED / EXIT_COMPLETED), set employee status to INACTIVE
        if (doc && stage === 'Deactivated' && doc.employee) {
            const Employee = getTenantModel(req, 'Employee');
            await Employee.findOneAndUpdate(
                { _id: doc.employee, tenant: req.tenantId },
                { status: 'INACTIVE', isActive: false, employmentStatus: 'Exited', payrollLocked: true, attendanceLocked: true }
            ).catch(e => console.warn('[exit] Could not update employee status:', e.message));
        }

        res.status(200).json({ success: true, data: doc, message: `Stage updated to "${stage}".` });
    } catch (err) {
        console.error('[exit] updateStage:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/approve/:id  — HR approves (HR Review → Notice Period)
// ─────────────────────────────────────────────────────────────────────────────
exports.approveRequest = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const { remarks, lastWorkingDate } = req.body;
        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId, stage: { $in: ['Requested', 'HR Review'] } },
            { stage: 'Notice Period', status: 'Approved', hrId: getEmployeeId(req),
              hrRemarks: remarks, hrApprovedAt: new Date(),
              ...(lastWorkingDate && { lastWorkingDate }) },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found or already actioned.' });
        res.status(200).json({ success: true, data: doc, message: 'Exit request approved.' });
    } catch (err) {
        console.error('[exit] approveRequest:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/reject/:id  — HR rejects at any stage
// ─────────────────────────────────────────────────────────────────────────────
exports.rejectRequest = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const { remarks } = req.body;
        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId, status: { $nin: ['Completed', 'Rejected'] } },
            { status: 'Rejected', rejectedBy: getEmployeeId(req), rejectionReason: remarks, rejectedAt: new Date() },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found or already resolved.' });
        res.status(200).json({ success: true, data: doc, message: 'Exit request rejected.' });
    } catch (err) {
        console.error('[exit] rejectRequest:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/assets/:id  — HR updates asset checklist
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAssets = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const { checklist, assetRemarks } = req.body;

        const update = {};
        if (Array.isArray(checklist)) {
            update.assetChecklist = checklist.map(c => ({
                item: c.item, returned: Boolean(c.returned),
                returnedAt: c.returned ? (c.returnedAt || new Date()) : undefined
            }));
            update.allAssetsReturned = update.assetChecklist.every(c => c.returned);
            if (update.allAssetsReturned) update.assetClearedAt = new Date();
        }
        if (assetRemarks !== undefined) update.assetRemarks = assetRemarks;

        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId }, update, { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found.' });
        res.status(200).json({ success: true, data: doc, message: 'Asset checklist updated.' });
    } catch (err) {
        console.error('[exit] updateAssets:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/interview/:id  — Employee submits exit interview feedback
// ─────────────────────────────────────────────────────────────────────────────
exports.submitInterview = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const employeeId = getEmployeeId(req);
        const { reasonForLeaving, companyFeedback, managementFeedback, suggestions, jobSatisfaction, wouldRecommend } = req.body;

        const doc = await ExitRequest.findOne({ _id: id, tenant: req.tenantId, employee: employeeId });
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found.' });
        if (doc.stage !== 'Exit Interview')
            return res.status(400).json({ success: false, message: 'Exit interview can only be submitted during the Exit Interview stage.' });
        if (doc.exitInterviewCompleted)
            return res.status(400).json({ success: false, message: 'Exit interview already submitted.' });

        doc.exitInterview = {
            reasonForLeaving: reasonForLeaving || '',
            companyFeedback: companyFeedback || '',
            managementFeedback: managementFeedback || '',
            suggestions: suggestions || '',
            jobSatisfaction: jobSatisfaction ? Number(jobSatisfaction) : undefined,
            wouldRecommend: wouldRecommend === true || wouldRecommend === false ? wouldRecommend : undefined,
            submittedAt: new Date()
        };
        doc.exitInterviewCompleted = true;
        await doc.save({ validateModifiedOnly: true });

        res.status(200).json({ success: true, data: doc, message: 'Exit interview submitted. Thank you for your feedback.' });
    } catch (err) {
        console.error('[exit] submitInterview:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/clearance/:id  — Employee submits handover / clearance form
// ─────────────────────────────────────────────────────────────────────────────
exports.submitClearanceForm = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const employeeId = getEmployeeId(req);
        const { handoverTo, pendingTasks, projectsStatus, knowledgeTransferNotes, systemCredentials, otherNotes } = req.body;

        const doc = await ExitRequest.findOne({ _id: id, tenant: req.tenantId, employee: employeeId });
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found.' });
        if (doc.stage !== 'Clearance')
            return res.status(400).json({ success: false, message: 'Clearance form can only be submitted during the Clearance stage.' });

        doc.clearanceForm          = { handoverTo, pendingTasks, projectsStatus, knowledgeTransferNotes, systemCredentials, otherNotes, submittedAt: new Date() };
        doc.clearanceFormSubmitted = true;
        await doc.save({ validateModifiedOnly: true });

        res.status(200).json({ success: true, data: doc, message: 'Clearance form submitted.' });
    } catch (err) {
        console.error('[exit] submitClearanceForm:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/tasks/:id  — HR manages department exit tasks
// ─────────────────────────────────────────────────────────────────────────────
exports.updateTasks = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const { tasks } = req.body;   // full array replacement

        if (!Array.isArray(tasks))
            return res.status(400).json({ success: false, message: 'tasks must be an array.' });

        const processedTasks = tasks.map(t => ({
            ...t,
            completedAt: t.status === 'Completed' && !t.completedAt ? new Date() : t.completedAt
        }));

        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId },
            { departmentTasks: processedTasks },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found.' });
        res.status(200).json({ success: true, data: doc, message: 'Department tasks updated.' });
    } catch (err) {
        console.error('[exit] updateTasks:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch employee salary structure (basic, allowances, annual/monthly CTC) for FNF
// Uses EmployeeCompensation (tenant) then SalaryStructure (global); matches payroll lookup.
// ─────────────────────────────────────────────────────────────────────────────
async function getEmployeeSalaryStructureForFNF(req, empId) {
    const tenantDB = req.tenantDB;
    const tenantId = req.tenantId;
    const result = { annualCTC: 0, monthlyCTC: 0, basicSalary: 0, allowances: 0, source: null };

    if (!tenantDB) return result;

    // 1. EmployeeCompensation (tenant DB) – match payroll service; fallback with companyId
    try {
        const Comp = tenantDB.model('EmployeeCompensation');
        let comp = await Comp.findOne({
            employeeId: empId,
            isActive: true,
            status: { $in: ['ACTIVE', 'Active'] },
            totalCTC: { $gt: 0 }
        }).lean();
        if (!comp && tenantId) {
            comp = await Comp.findOne({
                companyId: tenantId,
                employeeId: empId,
                isActive: true,
                status: { $in: ['ACTIVE', 'Active'] },
                totalCTC: { $gt: 0 }
            }).lean();
        }
        if (comp) {
            const annual = Number(comp.totalCTC) || 0;
            result.annualCTC = annual;
            result.monthlyCTC = Math.round(annual / 12);
            result.source = 'EmployeeCompensation';
            const components = comp.components || [];
            let basicMonthly = 0;
            let allowancesMonthly = 0;
            for (const c of components) {
                if ((c.type || '').toUpperCase() !== 'EARNING') continue;
                const monthly = Number(c.monthlyAmount) || (Number(c.annualAmount) || 0) / 12;
                const name = ((c.name || c.code || '') + '').toLowerCase();
                if (name.includes('basic')) {
                    basicMonthly += monthly;
                } else {
                    allowancesMonthly += monthly;
                }
            }
            if (basicMonthly > 0 || allowancesMonthly > 0) {
                result.basicSalary = Math.round(basicMonthly);
                result.allowances = Math.round(allowancesMonthly);
            } else {
                result.basicSalary = result.monthlyCTC;
                result.allowances = 0;
            }
            return result;
        }
    } catch (e) {
        console.warn('[exit] getEmployeeSalaryStructureForFNF EmployeeCompensation:', e.message);
    }

    // 2. SalaryStructure (global) – by employee or candidateId
    if (tenantId) {
        try {
            const SalaryStructure = mongoose.model('SalaryStructure');
            const structure = await SalaryStructure.findOne({
                tenantId,
                status: { $in: ['ACTIVE', 'Active'] },
                $and: [
                    { $or: [{ employee: empId }, { candidateId: empId }] },
                    { $or: [{ 'totals.annualCTC': { $gt: 0 } }, { 'totals.monthlyCTC': { $gt: 0 } }] }
                ]
            }).lean();
            if (structure) {
                const totals = structure.totals || {};
                const annual = Number(totals.annualCTC) || 0;
                const monthly = Number(totals.monthlyCTC) || (annual ? Math.round(annual / 12) : 0);
                result.annualCTC = annual || monthly * 12;
                result.monthlyCTC = monthly || Math.round(result.annualCTC / 12);
                result.source = 'SalaryStructure';
                const earnings = structure.earnings || [];
                let basicMonthly = 0;
                let allowancesMonthly = 0;
                for (const e of earnings) {
                    const m = Number(e.monthly) || (Number(e.yearly) || 0) / 12;
                    const label = ((e.label || e.key || '') + '').toLowerCase();
                    if (label.includes('basic')) {
                        basicMonthly += m;
                    } else {
                        allowancesMonthly += m;
                    }
                }
                if (basicMonthly > 0 || allowancesMonthly > 0) {
                    result.basicSalary = Math.round(basicMonthly);
                    result.allowances = Math.round(allowancesMonthly);
                } else {
                    result.basicSalary = result.monthlyCTC;
                    result.allowances = 0;
                }
                return result;
            }
        } catch (e) {
            console.warn('[exit] getEmployeeSalaryStructureForFNF SalaryStructure:', e.message);
        }
    }

    return result;
}

function roundCurrency(value) {
    const numeric = Number(value) || 0;
    return Math.round(numeric * 100) / 100;
}

function roundWhole(value) {
    return Math.round(Number(value) || 0);
}

function calculateCompletedServiceYears(joiningDate, lastWorkingDate) {
    if (!joiningDate || !lastWorkingDate) return 0;
    const joinDate = new Date(joiningDate);
    const lwd = new Date(lastWorkingDate);
    if (Number.isNaN(joinDate.getTime()) || Number.isNaN(lwd.getTime()) || lwd < joinDate) return 0;

    let years = lwd.getFullYear() - joinDate.getFullYear();
    const monthDelta = lwd.getMonth() - joinDate.getMonth();
    const dayDelta = lwd.getDate() - joinDate.getDate();
    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
        years -= 1;
    }
    return Math.max(0, years);
}

function calculateServedNoticeDays(noticeStart, lastWorkingDate) {
    if (!noticeStart || !lastWorkingDate) return 0;
    const start = new Date(noticeStart);
    const end = new Date(lastWorkingDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

function normalizeDeductions(deductions = []) {
    return (Array.isArray(deductions) ? deductions : [])
        .map((item, index) => ({
            label: String(item?.label || item?.name || `Deduction ${index + 1}`).trim(),
            amount: roundWhole(Math.abs(Number(item?.amount) || 0))
        }))
        .filter((item) => item.label && item.amount > 0);
}

async function buildFNFSettlementPreview(req, exitReq, overrides = {}) {
    const employee = exitReq.employee || {};
    const employeeId = employee._id || exitReq.employee;
    const lastWorkingDate = exitReq.lastWorkingDate ? new Date(exitReq.lastWorkingDate) : null;
    const noticeStart = exitReq.noticePeriodStartDate ? new Date(exitReq.noticePeriodStartDate) : null;

    const salaryStruct = await getEmployeeSalaryStructureForFNF(req, employeeId);
    let monthlyCTC = Number(overrides.monthlyCTC) || salaryStruct.monthlyCTC || 0;
    let annualCTC = Number(overrides.annualCTC) || salaryStruct.annualCTC || 0;
    let basicSalary = Number(overrides.basicSalary) || salaryStruct.basicSalary || 0;
    let allowances = Number(overrides.allowances) || salaryStruct.allowances || 0;
    let salaryStructureFound = !!salaryStruct.source;

    if (!monthlyCTC && employee?.salary) {
        monthlyCTC = Number(employee.salary) || 0;
        if (monthlyCTC > 0) {
            annualCTC = monthlyCTC * 12;
            basicSalary = basicSalary || monthlyCTC;
            allowances = allowances || 0;
            salaryStructureFound = true;
        }
    }

    if (!annualCTC && monthlyCTC) {
        annualCTC = monthlyCTC * 12;
    }

    if (!basicSalary && monthlyCTC) {
        basicSalary = roundWhole(monthlyCTC * 0.4);
    }

    if (!allowances && monthlyCTC && basicSalary) {
        allowances = Math.max(0, roundWhole(monthlyCTC - basicSalary));
    }

    const totalWorkingDays = Math.max(1, Number(overrides.totalWorkingDays) || Number(exitReq.fnfSettlement?.totalWorkingDays) || 26);
    const grossDailyRate = monthlyCTC ? monthlyCTC / totalWorkingDays : 0;
    const basicDailyRate = basicSalary ? basicSalary / totalWorkingDays : grossDailyRate;

    let workedDays = Number(overrides.workedDays);
    if (!workedDays && lastWorkingDate) {
        const startOfMonth = new Date(lastWorkingDate.getFullYear(), lastWorkingDate.getMonth(), 1);
        const joiningDate = employee?.joiningDate ? new Date(employee.joiningDate) : null;
        const startReference = noticeStart && noticeStart > startOfMonth
            ? noticeStart
            : (joiningDate && joiningDate > startOfMonth ? joiningDate : startOfMonth);
        workedDays = Math.max(0, Math.ceil((lastWorkingDate - startReference) / (1000 * 60 * 60 * 24)) + 1);
    }
    workedDays = Math.min(totalWorkingDays, Math.max(0, Number(workedDays) || 0));

    let leaveEncashmentDays = Number(overrides.leaveEncashmentDays);
    if (!leaveEncashmentDays) {
        try {
            const LeaveBalance = getTenantModel(req, 'LeaveBalance');
            const balances = await LeaveBalance.find({ employee: employeeId, tenant: req.tenantId }).lean();
            leaveEncashmentDays = balances.reduce((sum, balance) => sum + (Number(balance.balance) || 0), 0);
        } catch (_) {
            leaveEncashmentDays = 0;
        }
    }
    leaveEncashmentDays = Math.max(0, Math.min(Number(leaveEncashmentDays) || 0, 45));

    const serviceYears = Number(overrides.serviceYears) || calculateCompletedServiceYears(employee?.joiningDate, lastWorkingDate);
    const gratuityEligible = overrides.gratuityEligible === false
        ? false
        : (overrides.gratuityEligible === true || serviceYears >= 5 || exitReq.exitType === 'Retirement');
    const gratuityAmount = Number(overrides.gratuityAmount) >= 0
        ? roundWhole(overrides.gratuityAmount)
        : (gratuityEligible ? roundWhole((basicSalary * 15 * serviceYears) / totalWorkingDays) : 0);

    const servedNoticeDays = calculateServedNoticeDays(noticeStart, lastWorkingDate);
    const noticeShortfallDays = Math.max(
        0,
        Number(overrides.noticeShortfallDays) || (Number(exitReq.noticePeriodDays) || 0) - servedNoticeDays
    );
    const noticeRecovery = Number(overrides.noticeRecovery) >= 0
        ? roundWhole(overrides.noticeRecovery)
        : roundWhole(grossDailyRate * noticeShortfallDays);

    const bonusAmount = Math.max(0, roundWhole(overrides.bonusAmount || 0));
    const reimbursementAmount = Math.max(0, roundWhole(overrides.reimbursementAmount || 0));
    const additionalDeductions = normalizeDeductions(overrides.deductions || []);
    const deductions = noticeRecovery > 0
        ? [{ label: 'Notice pay recovery', amount: noticeRecovery }, ...additionalDeductions]
        : additionalDeductions;

    const basicSalaryPayable = roundWhole(grossDailyRate * workedDays);
    const leaveEncashmentAmount = roundWhole(basicDailyRate * leaveEncashmentDays);
    const grossPayable = basicSalaryPayable + leaveEncashmentAmount + gratuityAmount + bonusAmount + reimbursementAmount;
    const totalDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netPayable = grossPayable - totalDeductions;

    return {
        salaryStructureFound,
        annualCTC: roundWhole(annualCTC),
        monthlyCTC: roundWhole(monthlyCTC),
        basicSalary: roundWhole(basicSalary),
        allowances: roundWhole(allowances),
        salaryStructureSource: salaryStruct.source || '',
        workedDays,
        totalWorkingDays,
        dailyRate: roundCurrency(grossDailyRate),
        serviceYears,
        gratuityEligible,
        basicSalaryPayable,
        leaveEncashmentDays,
        leaveEncashmentAmount,
        gratuityAmount,
        bonusAmount,
        reimbursementAmount,
        deductions,
        noticeShortfallDays,
        noticeRecovery,
        grossPayable,
        totalDeductions,
        netPayable
    };
}

function buildFNFInputItems(exitReq, settlement) {
    const employeeId = exitReq.employee?._id || exitReq.employee;
    const effectiveDate = exitReq.lastWorkingDate || new Date();
    const metadata = {
        exitRequestId: String(exitReq._id),
        exitType: exitReq.exitType || 'Resignation',
        lastWorkingDate: effectiveDate
    };

    const items = [];
    const pushItem = (payload) => {
        if ((Number(payload.amount) || 0) <= 0) return;
        items.push({
            employeeId,
            quantity: 1,
            taxable: payload.taxable !== false,
            affectsBasic: payload.affectsBasic === true,
            effectiveDate,
            metadata,
            ...payload
        });
    };

    pushItem({
        inputType: 'FINAL_SETTLEMENT',
        classification: 'EARNING',
        name: 'FNF Salary Payable',
        amount: settlement.basicSalaryPayable,
        componentCode: 'FNF_SALARY',
        notes: 'Prorated salary payable up to last working date.'
    });
    pushItem({
        inputType: 'FINAL_SETTLEMENT',
        classification: 'EARNING',
        name: 'Leave Encashment',
        amount: settlement.leaveEncashmentAmount,
        componentCode: 'FNF_LEAVE_ENCASHMENT',
        notes: `Leave encashment for ${settlement.leaveEncashmentDays} day(s).`
    });
    pushItem({
        inputType: 'FINAL_SETTLEMENT',
        classification: 'EARNING',
        name: 'Gratuity',
        amount: settlement.gratuityAmount,
        taxable: false,
        componentCode: 'FNF_GRATUITY',
        notes: `Gratuity for ${settlement.serviceYears} completed year(s) of service.`
    });
    pushItem({
        inputType: 'BONUS',
        classification: 'EARNING',
        name: 'FNF Bonus / Ex-Gratia',
        amount: settlement.bonusAmount,
        componentCode: 'FNF_BONUS',
        notes: 'One-time bonus or ex-gratia settlement.'
    });
    pushItem({
        inputType: 'REIMBURSEMENT',
        classification: 'REIMBURSEMENT',
        name: 'Final Reimbursement',
        amount: settlement.reimbursementAmount,
        taxable: false,
        componentCode: 'FNF_REIMBURSEMENT',
        notes: 'Final approved reimbursement in full and final settlement.'
    });

    for (const deduction of settlement.deductions || []) {
        pushItem({
            inputType: deduction.label?.toLowerCase().includes('notice') ? 'FINAL_SETTLEMENT' : 'MANUAL_DEDUCTION',
            classification: 'POST_TAX_DEDUCTION',
            name: deduction.label,
            amount: deduction.amount,
            taxable: false,
            componentCode: deduction.label?.toLowerCase().includes('notice') ? 'FNF_NOTICE_RECOVERY' : 'FNF_DEDUCTION',
            notes: `Deduction captured during full and final settlement: ${deduction.label}`
        });
    }

    return items;
}

async function syncFNFPayrollInputBatch(req, exitReq, settlement) {
    const userId = getEmployeeId(req);
    const lastWorkingDate = exitReq.lastWorkingDate ? new Date(exitReq.lastWorkingDate) : new Date();
    const month = lastWorkingDate.getMonth() + 1;
    const year = lastWorkingDate.getFullYear();
    const employeeName = [exitReq.employee?.firstName, exitReq.employee?.lastName].filter(Boolean).join(' ').trim() || 'Employee';
    const existingBatchId = exitReq.fnfSettlement?.payrollInputBatchId || null;

    if (existingBatchId) {
        const existingBatch = await payrollPhase2.getPayrollInputBatchById(req.tenantDB, req.tenantId, existingBatchId);
        if (existingBatch?.appliedRunIds?.length) {
            throw new Error('Existing FNF payroll input batch has already been used in payroll. Create an amendment payroll run before reprocessing this settlement.');
        }
        if (existingBatch && existingBatch.status !== 'CANCELLED') {
            await payrollPhase2.transitionPayrollInputBatch(
                req.tenantDB,
                req.tenantId,
                existingBatchId,
                'CANCEL',
                userId,
                'Superseded by updated FNF settlement.'
            );
        }
    }

    const createdBatch = await payrollPhase2.createPayrollInputBatch(
        req.tenantDB,
        req.tenantId,
        {
            name: `FNF ${employeeName} ${month}/${year}`,
            source: 'FINAL_SETTLEMENT',
            runScope: 'OFF_CYCLE',
            usagePolicy: 'ONE_TIME',
            month,
            year,
            payDate: lastWorkingDate,
            notes: `Auto-generated from exit request ${exitReq._id}`,
            items: buildFNFInputItems(exitReq, settlement)
        },
        userId
    );

    await payrollPhase2.transitionPayrollInputBatch(
        req.tenantDB,
        req.tenantId,
        createdBatch._id,
        'SUBMIT',
        userId,
        'Submitted automatically from FNF processing.'
    );
    await payrollPhase2.transitionPayrollInputBatch(
        req.tenantDB,
        req.tenantId,
        createdBatch._id,
        'APPROVE',
        userId,
        'Approved automatically from FNF processing.'
    );

    return payrollPhase2.transitionPayrollInputBatch(
        req.tenantDB,
        req.tenantId,
        createdBatch._id,
        'RELEASE',
        userId,
        'Released for off-cycle payroll run consumption.'
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exit/fnf/:id/calculate  — Get suggested FNF breakdown (salary structure, proration, leave encashment)
// ─────────────────────────────────────────────────────────────────────────────
exports.calculateFNF = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;

        const exitReq = await ExitRequest.findOne({ _id: id, tenant: req.tenantId })
            .populate('employee', 'firstName lastName employeeId joiningDate salary');
        if (!exitReq) return res.status(404).json({ success: false, message: 'Request not found.' });
        const preview = await buildFNFSettlementPreview(req, exitReq, exitReq.fnfSettlement || {});

        return res.status(200).json({
            success: true,
            data: preview,
            message: 'FNF breakdown calculated using Indian payroll settlement defaults.'
        });
    } catch (err) {
        console.error('[exit] calculateFNF:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/fnf/:id  — HR processes Full & Final Settlement
// ─────────────────────────────────────────────────────────────────────────────
exports.processFNF = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;
        const exitReq = await ExitRequest.findOne({ _id: id, tenant: req.tenantId })
            .populate('employee', 'firstName lastName employeeId joiningDate salary');
        if (!exitReq) return res.status(404).json({ success: false, message: 'Request not found.' });

        const settlement = await buildFNFSettlementPreview(req, exitReq, req.body || {});
        const fnfInputBatch = await syncFNFPayrollInputBatch(req, exitReq, settlement);

        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId },
            {
                fnfSettlement: {
                    ...settlement,
                    payrollInputBatchId: fnfInputBatch?._id || null,
                    payrollInputBatchCode: fnfInputBatch?.batchCode || '',
                    payrollInputBatchStatus: fnfInputBatch?.status || '',
                    remarks: req.body?.remarks || '',
                    processedBy: getEmployeeId(req),
                    processedAt: new Date()
                },
                fnfProcessed: true,
                stage:        'FNF'
            },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Request not found.' });
        res.status(200).json({
            success: true,
            data: {
                exitRequest: doc,
                settlement: {
                    ...settlement,
                    payrollInputBatchId: fnfInputBatch?._id || null,
                    payrollInputBatchCode: fnfInputBatch?.batchCode || '',
                    payrollInputBatchStatus: fnfInputBatch?.status || ''
                }
            },
            message: 'FNF settlement processed and released to off-cycle payroll inputs.'
        });
    } catch (err) {
        console.error('[exit] processFNF:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exit/letters/:id  — HR generates Experience + Relieving letters
// ─────────────────────────────────────────────────────────────────────────────
exports.generateLetters = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const { id } = req.params;

        const exitReq = await ExitRequest.findOne({ _id: id, tenant: req.tenantId })
            .populate('employee', 'firstName lastName employeeId department designation jobTitle position gender dateOfJoining joiningDate');

        if (!exitReq) return res.status(404).json({ success: false, message: 'Request not found.' });

        const emp = exitReq.employee;
        let companyName = 'Your Company';
        try {
            const tenant = await mongoose.model('Tenant').findById(req.tenantId).select('companyName name').lean();
            companyName  = tenant?.companyName || tenant?.name || companyName;
        } catch (_) { /* use default */ }

        const data = {
            empName:     `${emp.firstName} ${emp.lastName}`,
            empId:       emp.employeeId || '—',
            designation: emp.designation || emp.jobTitle || emp.position || 'Employee',
            department:  emp.department || '—',
            joiningDate: emp.dateOfJoining || emp.joiningDate,
            lwd:         exitReq.lastWorkingDate,
            companyName,
            gender:      emp.gender || 'Male'
        };

        const hrId       = getEmployeeId(req);
        const generatedAt = new Date();

        const doc = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId },
            {
                'letters.experience': { content: buildExperienceLetter(data), generatedAt, generatedBy: hrId },
                'letters.relieving':  { content: buildRelievingLetter(data),  generatedAt, generatedBy: hrId },
                lettersGenerated:     true,
                stage:                'Letters Generated'
            },
            { new: true }
        );
        res.status(200).json({ success: true, data: doc, message: 'Letters generated successfully.' });
    } catch (err) {
        console.error('[exit] generateLetters:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exit/deactivate/:id  — HR deactivates the employee account
// ─────────────────────────────────────────────────────────────────────────────
exports.deactivateEmployee = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const Employee    = getTenantModel(req, 'Employee');
        const { id }      = req.params;

        const exitReq = await ExitRequest.findOneAndUpdate(
            { _id: id, tenant: req.tenantId, stage: 'Letters Generated' },
            { stage: 'Deactivated', status: 'Completed', deactivatedAt: new Date(), deactivatedBy: getEmployeeId(req) },
            { new: true }
        );
        if (!exitReq) return res.status(404).json({ success: false, message: 'Request not found or not ready for deactivation.' });

        // Deactivate employee account — set status to INACTIVE and lock payroll/attendance (archive)
        await Employee.findOneAndUpdate(
            { _id: exitReq.employee, tenant: req.tenantId },
            {
                status: 'INACTIVE',
                isActive: false,
                employmentStatus: 'Exited',
                payrollLocked: true,
                attendanceLocked: true
            }
        ).catch(e => console.warn('[exit] Could not update employee status:', e.message));

        res.status(200).json({ success: true, data: exitReq, message: 'Employee account deactivated. Offboarding complete.' });
    } catch (err) {
        console.error('[exit] deactivateEmployee:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exit/analytics  — HR dashboard summary
// ─────────────────────────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
    try {
        const ExitRequest = getTenantModel(req, 'ExitRequest');
        const base = { tenant: req.tenantId };

        const [total, pending, approved, completed, rejected, byStage] = await Promise.all([
            ExitRequest.countDocuments(base),
            ExitRequest.countDocuments({ ...base, status: 'Pending' }),
            ExitRequest.countDocuments({ ...base, status: 'Approved' }),
            ExitRequest.countDocuments({ ...base, status: 'Completed' }),
            ExitRequest.countDocuments({ ...base, status: 'Rejected' }),
            ExitRequest.aggregate([{ $match: base }, { $group: { _id: '$stage', count: { $sum: 1 } } }])
        ]);

        const stageBreakdown = {};
        byStage.forEach(s => { stageBreakdown[s._id] = s.count; });

        res.status(200).json({ success: true, data: { total, pending, approved, completed, rejected, stageBreakdown } });
    } catch (err) {
        console.error('[exit] getAnalytics:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
