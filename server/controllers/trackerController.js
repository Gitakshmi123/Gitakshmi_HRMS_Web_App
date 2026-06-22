const dayjs = require('dayjs');
const getTenantDB = require('../utils/tenantDB');

const getModels = async (req) => {
    // Force resolve tenantDB from tenantId if missing
    if (!req.tenantDB && req.tenantId) {
        req.tenantDB = await getTenantDB(req.tenantId);
    }
    if (!req.tenantDB) throw new Error("Tenant database connection not available");

    return {
        TrackerCandidate: req.tenantDB.models.TrackerCandidate || req.tenantDB.model("TrackerCandidate", require('../models/TrackerCandidate')),
        CandidateStatusLog: req.tenantDB.models.CandidateStatusLog || req.tenantDB.model("CandidateStatusLog", require('../models/CandidateStatusLog')),
        Applicant: req.tenantDB.models.Applicant || req.tenantDB.model("Applicant", require('../models/Applicant')),
        Offer: req.tenantDB.models.Offer || req.tenantDB.model("Offer", require('../models/Offer')),
        AuditLog: req.tenantDB.models.AuditLog || req.tenantDB.model("AuditLog", require('../models/AuditLog'))
    };
};

/**
 * @desc    Get all candidates (Merged from Applicants and TrackerCandidates)
 * @route   GET /api/hr/candidate-status
 */
exports.getCandidates = async (req, res) => {
    try {
        const { TrackerCandidate, Applicant } = await getModels(req);
        const tenantId = req.tenantId;

        // 1. Fetch from Tracker (Seeded or previously tracked)
        const trackerCandidatesRaw = await TrackerCandidate.find({}).lean();
        const trackerCandidates = trackerCandidatesRaw.map(tc => ({
            ...tc,
            resumeUrl: tc.resume ? `/hr/resume/${tc.resume}` : null
        }));

        // 2. Fetch from main Applicants collection
        const applicants = await Applicant.find({}).populate('requirementId').lean();

        // 3. Map Applicants to Tracker format
        const mappedApplicants = applicants.map(app => {
            // Check if this applicant is already in tracker candidates to avoid duplicates
            const alreadyTracked = trackerCandidates.find(tc => tc.email === app.email);
            if (alreadyTracked) return null;

            return {
                _id: app._id,
                name: app.name,
                email: app.email,
                phone: app.mobile || app.phone || 'N/A',
                requirementTitle: app.requirementId?.jobTitle || 'Unknown Role',
                currentStatus: app.status || 'Applied',
                currentStage: 'Application',
                resumeUrl: app.resume ? `/hr/resume/${app.resume}` : null,
                tenant: tenantId,
                createdAt: app.createdAt,
                source: 'Applicant'
            };
        }).filter(Boolean);

        // 4. Combine and Sort
        let finalResults = [...trackerCandidates, ...mappedApplicants].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        // 5. Final Healing: If any tracker candidate still lacks resumeUrl, try one last check against applicants
        // (This handles legacy tracker data already in the DB)
        for (let item of finalResults) {
            if (!item.resumeUrl) {
                const legacyApp = applicants.find(a => a.email === item.email);
                if (legacyApp?.resume) {
                    item.resumeUrl = `/hr/resume/${legacyApp.resume}`;
                }
            }
        }

        res.json(finalResults);
    } catch (error) {
        console.error('[TRACKER_ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get single candidate by ID (either TrackerCandidate or Applicant)
 */
exports.getCandidateById = async (req, res) => {
    try {
        const { TrackerCandidate, Applicant } = await getModels(req);
        const { id } = req.params;

        let candidate = await TrackerCandidate.findById(id).lean();

        // If not found by ID, maybe it's an Applicant ID and already promoted?
        if (!candidate) {
            const applicant = await Applicant.findById(id).populate('requirementId').lean();
            if (applicant) {
                // Try finding in TrackerCandidate by email
                candidate = await TrackerCandidate.findOne({ email: applicant.email }).lean();
                if (!candidate) {
                    // Not promoted yet, return Applicant data
                    candidate = {
                        _id: applicant._id,
                        name: applicant.name,
                        email: applicant.email,
                        phone: applicant.mobile || 'N/A',
                        requirementTitle: applicant.requirementId?.jobTitle || 'Unknown Role',
                        pipelineStages: applicant.requirementId?.pipelineStages || [],
                        currentStatus: applicant.status || 'Applied',
                        currentStage: 'Application',
                        resumeUrl: applicant.resume ? `/hr/resume/${applicant.resume}` : null,
                        createdAt: applicant.createdAt,
                        source: 'Applicant'
                    };
                }
            }
        }

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        if (candidate) {
            // Include pipeline stages if not already present
            if (!candidate.pipelineStages) {
                 const applicant = await Applicant.findOne({ email: candidate.email }).populate('requirementId').lean();
                 candidate.pipelineStages = applicant?.requirementId?.pipelineStages || [];
            }
            // Attach resumeUrl if present
            if (candidate.resume) {
                candidate.resumeUrl = `/hr/resume/${candidate.resume}`;
            } else {
                // HEALING: Look up applicant if tracker record lacks resume
                const applicant = await Applicant.findOne({ email: candidate.email }).lean();
                if (applicant?.resume) {
                    candidate.resumeUrl = `/hr/resume/${applicant.resume}`;
                    // Optional: Update the tracker record to avoid future lookups
                    await TrackerCandidate.findByIdAndUpdate(candidate._id, { resume: applicant.resume });
                }
            }
        }

        // console.log('✅ [GET_CANDIDATE_BY_ID] Returning candidate:', {
        //     id: candidate._id,
        //     name: candidate.name,
        //     resume: candidate.resume,
        //     resumeUrl: candidate.resumeUrl
        // });

        res.json(candidate);
    } catch (error) {
        console.error('❌ [GET_CANDIDATE_BY_ID] Error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get candidate timeline
 */
exports.getTimeline = async (req, res) => {
    try {
        const { CandidateStatusLog, TrackerCandidate, Applicant } = await getModels(req);
        const { id } = req.params;

        // Try getting logs by ID
        let logs = await CandidateStatusLog.find({ candidateId: id }).sort({ actionDate: -1 }).lean();

        // If no logs, maybe it's an Applicant ID and already promoted?
        if (logs.length === 0) {
            const applicant = await Applicant.findById(id).lean();
            if (applicant) {
                const tc = await TrackerCandidate.findOne({ email: applicant.email }).lean();
                if (tc) {
                    logs = await CandidateStatusLog.find({ candidateId: tc._id }).sort({ actionDate: -1 }).lean();
                }
            }
        }

        // If no logs or minimal logs, also fetch logs from Applicant.timeline
        let applicantLogs = [];

        // Find the applicant record (either by ID or email if ID is TrackerCandidate)
        let applicant = await Applicant.findById(id).lean();
        if (!applicant) {
            const trackerCandidate = await TrackerCandidate.findById(id).lean();
            if (trackerCandidate) {
                applicant = await Applicant.findOne({ email: trackerCandidate.email }).lean();
            }
        }

        if (applicant && applicant.timeline && applicant.timeline.length > 0) {
            applicantLogs = applicant.timeline.map(t => {
                let inferredStage = 'Application';
                const s = t.status || '';
                if (s === 'Shortlisted' || s === 'Interview Scheduled' || s.includes('Interview')) inferredStage = 'Interview';
                else if (s === 'Selected' || s === 'Offer Sent' || s === 'Hired' || s === 'Rejected' || s.includes('Offer Letter') || s.includes('Joining Letter')) inferredStage = 'Final';

                return {
                    _id: t._id || `app-${t.timestamp}`,
                    candidateId: id,
                    status: t.status,
                    stage: inferredStage,
                    actionBy: t.updatedBy || 'System',
                    remarks: t.message,
                    actionDate: t.timestamp
                };
            });
        }

        // Merge logs
        // We prioritize CandidateStatusLogs (Tracker) but we want to show everything
        // Filter out applicant logs that might be duplicates of existing status logs if we want,
        // but typically Tracker logs are newer.
        // Simple merge:
        logs = [...logs, ...applicantLogs];

        // If merged logs are still empty, return default
        if (logs.length === 0) {
            let candidate = await TrackerCandidate.findById(id).lean();
            if (!candidate) candidate = applicant;

            if (candidate) {
                logs = [{
                    _id: 'default-log',
                    candidateId: id,
                    status: candidate.status || candidate.currentStatus || 'Applied',
                    stage: 'Application',
                    actionBy: 'System',
                    remarks: 'Application received and automatically tracked.',
                    actionDate: candidate.createdAt || new Date()
                }];
            }
        }

        // Deduplicate based on timestamp and status to be safe (optional but good)
        // Sort descending
        logs.sort((a, b) => new Date(b.actionDate) - new Date(a.actionDate));

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update candidate status
 */
exports.updateStatus = async (req, res) => {
    const { status, stage, actionBy, remarks } = req.body;
    try {
        const { TrackerCandidate, CandidateStatusLog, Applicant, AuditLog } = await getModels(req);
        const { id } = req.params;

        // Try finding in TrackerCandidate first
        let candidate = await TrackerCandidate.findById(id);

        // If not found, check if it's an Applicant needing promotion
        if (!candidate) {
            const applicant = await Applicant.findById(id).populate('requirementId');
            if (applicant) {
                // Check if already promoted by email
                candidate = await TrackerCandidate.findOne({ email: applicant.email, tenant: req.tenantId });

                if (!candidate) {
                    candidate = new TrackerCandidate({
                        name: applicant.name,
                        email: applicant.email,
                        phone: applicant.mobile || 'N/A',
                        requirementTitle: applicant.requirementId?.jobTitle || 'Unknown Role',
                        currentStatus: status,
                        currentStage: stage,
                        resume: applicant.resume,
                        tenant: req.tenantId
                    });
                    await candidate.save();
                } else {
                    candidate.currentStatus = status;
                    candidate.currentStage = stage;
                    await candidate.save();
                }

                // IMPORTANT: Also update the Applicant status to keep in sync
                applicant.status = status;
                if (applicant.currentStage && typeof applicant.currentStage === 'object') {
                    applicant.currentStage.stageName = stage;
                } else {
                    applicant.currentStage = { stageName: stage };
                }
                if (!applicant.timeline) applicant.timeline = [];
                applicant.timeline.push({
                    status: status,
                    stage: stage,
                    message: remarks || `Status updated via Tracker to ${status}`,
                    updatedBy: actionBy || 'HR',
                    timestamp: new Date()
                });
                await applicant.save();
            }
        } else {
            candidate.currentStatus = status;
            candidate.currentStage = stage;
            await candidate.save();

            // Also try to find and update the corresponding applicant by email
            const applicant = await Applicant.findOne({ email: candidate.email, tenant: req.tenantId });
            if (applicant) {
                applicant.status = status;
                if (applicant.currentStage && typeof applicant.currentStage === 'object') {
                    applicant.currentStage.stageName = stage;
                } else {
                    applicant.currentStage = { stageName: stage };
                }
                if (!applicant.timeline) applicant.timeline = [];
                applicant.timeline.push({
                    status: status,
                    stage: stage,
                    message: remarks || `Status updated via Tracker to ${status}`,
                    updatedBy: actionBy || 'HR',
                    timestamp: new Date()
                });
                await applicant.save();
            }
        }

        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

        const log = new CandidateStatusLog({
            candidateId: candidate._id,
            status,
            stage,
            actionBy,
            remarks,
            actionDate: new Date()
        });
        await log.save();

        try {
            await AuditLog.create({
                tenant: req.tenantId,
                entity: 'HiringPipeline',
                entityId: candidate._id,
                action: status || 'Pipeline Status Updated',
                performedBy: req.user?._id || null,
                changes: { before: null, after: { status, stage } },
                meta: {
                    module: 'Hiring',
                    performedBy: actionBy || req.user?.name || req.user?.email || 'HR',
                    ipAddress: req.ip,
                    date: new Date(),
                    remarks
                }
            });
        } catch (auditErr) {
            console.warn('[TRACKER_AUDIT] failed:', auditErr.message);
        }

        res.json({ candidate, log });
    } catch (error) {
        console.error('[UPDATE_STATUS_ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Seed sample data (Cleaned)
 */
exports.seedData = async (req, res) => {
    try {
        const { TrackerCandidate, CandidateStatusLog } = await getModels(req);
        const tenantId = req.tenantId;

        // Clean only dummy data
        await TrackerCandidate.deleteMany({ tenant: tenantId, email: /@example.com$/ });

        const sample = [
            { name: 'John Doe', email: 'john@example.com', phone: '1234567890', requirementTitle: 'Senior Dev', currentStatus: 'Selected', currentStage: 'Final', tenant: tenantId },
            { name: 'Jane Smith', email: 'jane@example.com', phone: '9876543210', requirementTitle: 'Lead Designer', currentStatus: 'Interview Scheduled', currentStage: 'Technical', tenant: tenantId }
        ];

        const created = await TrackerCandidate.insertMany(sample);
        const logs = created.map(c => ({
            candidateId: c._id,
            status: 'Applied',
            stage: 'Application',
            actionBy: 'System',
            remarks: 'Seeded sample data.',
            actionDate: new Date()
        }));
        await CandidateStatusLog.insertMany(logs);

        res.json({ message: 'Seeded', count: created.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// ============= GET AGGREGATED STATUS (OPTIMIZED) =============
exports.getStatus = async (req, res) => {
    try {
        const { CandidateStatusLog, TrackerCandidate, Applicant, Offer } = await getModels(req);
        const { id } = req.params;

        // 1. Resolve Candidate & find all possible IDs (Tracker and Applicant)
        let candidateRaw = await TrackerCandidate.findById(id).lean();
        let trackerId = null;
        let applicantId = null;
        let applicantObj = null;

        if (candidateRaw) {
            trackerId = candidateRaw._id;
            // Try finding applicantId by email
            applicantObj = await Applicant.findOne({ email: candidateRaw.email, tenant: req.tenantId }).lean();
            if (applicantObj) applicantId = applicantObj._id;
        } else {
            applicantObj = await Applicant.findById(id).lean();
            if (!applicantObj) return res.status(404).json({ message: "Candidate not found" });
            candidateRaw = applicantObj;
            applicantId = applicantObj._id;
            // Try finding trackerId by email
            const tc = await TrackerCandidate.findOne({ email: applicantObj.email, tenant: req.tenantId }).lean();
            if (tc) trackerId = tc._id;
        }

        // 2. Fetch Logs for BOTH IDs
        const queryIds = [trackerId, applicantId, id].filter(Boolean);
        let logs = await CandidateStatusLog.find({ candidateId: { $in: queryIds } }).lean();

        // 3. Merge applicant timeline if it's not already in StatusLogs
        if (applicantObj && applicantObj.timeline && Array.isArray(applicantObj.timeline)) {
            applicantObj.timeline.forEach(t => {
                const exists = logs.some(l => l.status === t.status && dayjs(l.actionDate).isSame(dayjs(t.timestamp), 'second'));
                if (!exists) {
                    logs.push({
                        status: t.status,
                        actionDate: t.timestamp,
                        stage: 'Application',
                        remarks: t.message,
                        actionBy: t.updatedBy
                    });
                }
            });
        }

        // 4. Merge Offer Details (CTC, approvals, hires) from all offer versions
        if (applicantId && Offer) {
            const offers = await Offer.find({ applicationId: applicantId, tenant: req.tenantId }).sort({ version: 1 }).lean();
            
            offers.forEach(offer => {
                const formatMoney = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
                
                if (offer.statusHistory && Array.isArray(offer.statusHistory)) {
                    offer.statusHistory.forEach(hist => {
                        let additionalInfo = '';
                        if (hist.to === 'SENT') {
                            additionalInfo = `Offered CTC: ${formatMoney(offer.salarySnapshot?.ctc)}/year. `;
                        } else if (hist.to === 'ACCEPTED') {
                            additionalInfo = `Finalized CTC: ${formatMoney(offer.salarySnapshot?.ctc)}/year. Joining on: ${dayjs(offer.joiningDate).format('MMM DD, YYYY')}. `;
                        }

                        logs.push({
                            _id: `offer-hist-${hist._id || Math.random()}`,
                            status: `Offer: ${hist.to}`,
                            actionDate: hist.timestamp,
                            stage: 'Offer Process',
                            actionBy: hist.changedBy || 'System',
                            remarks: `Offer v${offer.version} marked as ${hist.to}. ${additionalInfo}${hist.reason ? 'Notes: ' + hist.reason : ''}`
                        });
                    });
                }

                if (offer.employeeCreatedDate) {
                    logs.push({
                        _id: `employee-onboarded-${offer._id}`,
                        status: 'Hired / Employee Onboarded',
                        actionDate: offer.employeeCreatedDate,
                        stage: 'Final',
                        actionBy: offer.sentBy || 'System',
                        remarks: `Candidate successfully hired. Employee ID assigned: ${offer.employeeReadableId || 'N/A'}`
                    });
                }
            });
        }

        // Sort ASC
        logs.sort((a, b) => new Date(a.actionDate) - new Date(b.actionDate));

        // Format Helper: Fix bug where 'in:mm' was used. Correct format is 'hh:mm A'
        const formatTime = (d) => d ? dayjs(d).format("MMM DD, YYYY – hh:mm A") : null;

        // Initialize Response
        const response = {
            applied: { status: null, time: null },
            shortlisted: { status: null, time: null },
            interview: { status: null, time: null },
            selected: { status: null, time: null },
            rejected: { status: null, time: null },
            logs: logs
        };

        const currentStatus = candidateRaw.currentStatus || candidateRaw.status || 'Applied';
        const currentStage = candidateRaw.currentStage || candidateRaw.stage || '';
        const updatedAt = candidateRaw.updatedAt || candidateRaw.createdAt || new Date();

        // --- APPLIED ---
        const appliedLog = logs.find(l => l.status === 'Applied');
        response.applied = {
            status: 'completed',
            time: formatTime(appliedLog ? appliedLog.actionDate : candidateRaw.createdAt)
        };

        // --- SHORTLISTED ---
        const shortLog = logs.find(l => l.status === 'Shortlisted');
        const passedShortlist = ['Shortlisted', 'Interview Scheduled', 'Interviewing', 'Selected', 'Offer Sent', 'Hired'].some(s => currentStatus === s || currentStatus.includes('Round'));

        if (shortLog) {
            response.shortlisted = { status: 'completed', time: formatTime(shortLog.actionDate) };
        } else if (passedShortlist) {
            // Find earliest log that is Shortlisted or past it
            const nextLog = logs.find(l => ['Shortlisted', 'Interview Scheduled', 'Interviewing', 'Selected'].includes(l.status));
            response.shortlisted = {
                status: 'completed',
                time: formatTime(nextLog ? nextLog.actionDate : (currentStatus === 'Shortlisted' ? updatedAt : null))
            };
        }

        // Rejection logic for Shortlisted
        if (currentStatus === 'Rejected' && (currentStage === 'Shortlisting' || currentStage === 'Application')) {
            const rejectLog = logs.find(l => l.status === 'Rejected');
            response.shortlisted = { status: 'rejected', time: formatTime(rejectLog ? rejectLog.actionDate : updatedAt) };
            response.rejected = { status: 'completed', time: formatTime(rejectLog ? rejectLog.actionDate : updatedAt) };
        }

        // --- INTERVIEW ---
        const interviewLog = logs.find(l => l.status === 'Interview Scheduled' || l.status.includes('Interview') || l.status.includes('Round'));
        const passedInterview = ['Selected', 'Offer Sent', 'Hired'].some(s => currentStatus === s);
        const isInterviewing = currentStatus === 'Interview Scheduled' || currentStatus.includes('Round') || currentStatus.includes('Interview');

        if (interviewLog) {
            response.interview = {
                status: passedInterview ? 'completed' : (isInterviewing ? 'in-progress' : 'completed'),
                time: formatTime(interviewLog.actionDate)
            };
        } else if (passedInterview) {
            const nextLog = logs.find(l => ['Selected', 'Offer Sent', 'Hired'].includes(l.status));
            response.interview = { status: 'completed', time: formatTime(nextLog ? nextLog.actionDate : null) };
        } else if (isInterviewing) {
            response.interview = { status: 'in-progress', time: formatTime(updatedAt) };
        }

        // Rejection logic for Interview
        if (currentStatus === 'Rejected' && (currentStage.includes('Round') || currentStage === 'Interview' || currentStage === 'Final')) {
            if (!response.rejected.status) { // If not already handled by Shortlisted rejection
                const rejectLog = logs.find(l => l.status === 'Rejected');
                response.interview = { status: 'rejected', time: formatTime(rejectLog ? rejectLog.actionDate : updatedAt) };
                response.rejected = { status: 'completed', time: formatTime(rejectLog ? rejectLog.actionDate : updatedAt) };
            }
        }

        // --- SELECTED ---
        const selectedLog = logs.find(l => ['Selected', 'Offer Sent', 'Hired'].includes(l.status));
        if (selectedLog) {
            response.selected = { status: 'completed', time: formatTime(selectedLog.actionDate) };
        } else if (['Selected', 'Offer Sent', 'Hired'].includes(currentStatus)) {
            response.selected = { status: 'completed', time: formatTime(updatedAt) };
        }

        // --- REJECTED (Fallback) ---
        if (currentStatus === 'Rejected' && !response.rejected.status) {
            const rejectLog = logs.find(l => l.status === 'Rejected');
            const time = formatTime(rejectLog ? rejectLog.actionDate : updatedAt);
            response.rejected = { status: 'completed', time };

            // Mark where it failed
            if (response.interview.status === 'in-progress' || response.interview.status === 'completed') {
                response.interview = { status: 'rejected', time };
            } else if (response.shortlisted.status === 'completed' || response.shortlisted.status === 'in-progress') {
                response.shortlisted = { status: 'rejected', time };
            }
        }

        res.json(response);

    } catch (error) {
        console.error('[GET_STATUS_ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};
