/**
 * trackerSync.js
 * Utility to synchronize applicant status changes with the Candidate Status Tracker
 */
const syncToTracker = async (req, { applicant, status, stage, remarks, actionBy }) => {
    try {
        if (!req.tenantDB) return;

        const TrackerCandidate = req.tenantDB.models.TrackerCandidate || req.tenantDB.model("TrackerCandidate", require('../models/TrackerCandidate'));
        const CandidateStatusLog = req.tenantDB.models.CandidateStatusLog || req.tenantDB.model("CandidateStatusLog", require('../models/CandidateStatusLog'));
        const tenantId = req.tenantId;

        if (!applicant || !applicant.email) return;

        // 1. Find or create TrackerCandidate
        let tc = await TrackerCandidate.findOne({ email: applicant.email, tenant: tenantId });

        if (!tc) {
            tc = new TrackerCandidate({
                name: applicant.name,
                email: applicant.email,
                phone: applicant.mobile || applicant.phone || 'N/A',
                requirementTitle: applicant.requirementId?.jobTitle || 'Unknown Role',
                currentStatus: status || applicant.status || 'Applied',
                currentStage: stage || 'HR',
                tenant: tenantId
            });
        } else {
            if (status) tc.currentStatus = status;
            if (stage) tc.currentStage = stage;
            // Update requirement title if it was missing or unknown
            if ((!tc.requirementTitle || tc.requirementTitle === 'Unknown Role') && applicant.requirementId?.jobTitle) {
                tc.requirementTitle = applicant.requirementId.jobTitle;
            }
        }

        await tc.save();

        // 2. Create status log
        const log = new CandidateStatusLog({
            candidateId: tc._id,
            status: status || applicant.status || 'Applied',
            stage: stage || tc.currentStage || 'HR',
            actionBy: actionBy || 'System',
            remarks: remarks || `Status synchronized from Application: ${status || applicant.status}`,
            actionDate: new Date()
        });

        await log.save();

        return { tc, log };
    } catch (error) {
        console.error('[TRACKER_SYNC_ERROR]', error.message);
        // We don't want to crash the main process if sync fails
        return null;
    }
};

module.exports = { syncToTracker };
