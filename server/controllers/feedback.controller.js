const FeedbackTemplate = require('../models/FeedbackTemplate');
const StageFeedback = require('../models/StageFeedback');
const HiringStage = require('../models/HiringStage');
const Requirement = require('../models/Requirement');
const Applicant = require('../models/Applicant');

// --- FEEDBACK TEMPLATES ---

exports.createFeedbackTemplate = async (req, res) => {
    try {
        const { templateName, criteria, isDefault } = req.body;
        const tenant = req.user.tenant || req.user.tenantId || req.tenantId;

        const template = new FeedbackTemplate({
            tenant,
            templateName,
            criteria,
            isDefault,
            createdBy: req.user._id || req.user.id
        });

        await template.save();
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFeedbackTemplates = async (req, res) => {
    try {
        const tenant = req.user.tenant || req.user.tenantId || req.tenantId;
        const templates = await FeedbackTemplate.find({ tenant });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFeedbackTemplateById = async (req, res) => {
    try {
        const { stageId } = req.params; // Using route param :stageId but it maps to template ID
        // Note: User Step 7 says GET /feedback/template/:stageId
        // If stageId refers to the 'pipeline stage ID' (string), we need to find the requirement first?
        // OR it refers to the 'template ID'?
        // Usually, when rendering feedback form, we pass the Template ID.
        // But if frontend passes Stage ID (from pipeline), we might need to lookup.
        // Let's assume input is Template ID for now, or handle both.

        let template = null;
        if (req.query.type === 'stage_lookup') {
            // Logic to find template for a specific stage in a requirement not implemented here directly
            // Frontend should pass templateId directly
        } else {
            template = await FeedbackTemplate.findById(stageId);
        }

        if (!template) return res.status(404).json({ message: 'Template not found' });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- HIRING STAGES (MASTER LIBRARY) ---

exports.createHiringStage = async (req, res) => {
    try {
        const { name, defaultFeedbackTemplate } = req.body;
        const stage = new HiringStage({
            tenant: req.user.tenant,
            name,
            defaultFeedbackTemplate
        });
        await stage.save();
        res.status(201).json(stage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getHiringStages = async (req, res) => {
    try {
        // System stages + Tenant stages
        const stages = await HiringStage.find({
            $or: [
                { tenant: req.user.tenant },
                { isSystemStage: true }
            ]
        }).sort({ defaultOrder: 1 });
        res.json(stages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- PIPELINE MANAGEMENT ---

exports.addStageToPipeline = async (req, res) => {
    try {
        // POST /pipeline/stage
        // Body: { requirementId, stageData: { name, feedbackTemplateId, ... } }
        const { requirementId, stageData } = req.body;

        const requirement = await Requirement.findOne({ _id: requirementId, tenant: req.user.tenant });
        if (!requirement) return res.status(404).json({ message: 'Requirement not found' });

        // Generate ID and Order
        const newStage = {
            stageId: `stage_${Date.now()}`,
            stageName: stageData.name,
            feedbackFormId: stageData.feedbackTemplateId,
            isSystemStage: false,
            orderIndex: requirement.pipelineStages.length + 1,
            evaluationCriteria: [] // Populated from template if needed, or kept separate
        };

        requirement.pipelineStages.push(newStage);
        await requirement.save();

        res.json(requirement.pipelineStages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePipelineOrder = async (req, res) => {
    try {
        // PUT /pipeline/stage/order
        // Body: { requirementId, stages: [ { stageId, orderIndex } ] }
        const { requirementId, stages } = req.body;

        const requirement = await Requirement.findOne({ _id: requirementId, tenant: req.user.tenant });
        if (!requirement) return res.status(404).json({ message: 'Requirement not found' });

        // Update order
        // Ensure we replace the whole array or update indices
        // Ideally receiving the full ordered array is safer

        // Map incoming stages to existing
        const newPipeline = stages.map((s, idx) => {
            const existing = requirement.pipelineStages.find(p => p.stageId === s.stageId);
            if (existing) {
                existing.orderIndex = idx + 1;
                return existing;
            }
            return null;
        }).filter(Boolean);

        // Append any missing stages (if partial update, though dangerous)
        // Better: Replace requirement.pipelineStages with reordered list based on ID match

        // Sort incoming by order? Array is usually ordered by index.
        // We'll trust the array order.

        // We need to preserve properties of stages not in the list? No, usually list is complete.

        // Let's assumed 'stages' is the full list of stage objects or IDs in order.
        // If it's objects:

        requirement.pipelineStages = stages.map((s, i) => ({
            ...s,
            orderIndex: i + 1
        }));

        await requirement.save();
        res.json(requirement.pipelineStages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- FEEDBACK SUBMISSION ---

exports.submitFeedback = async (req, res) => {
    try {
        // POST /feedback/submit
        // Body: { candidateId, requirementId, stageId, feedbackTemplateId, responses, comments, overallRating }
        const { candidateId, requirementId, stageId, feedbackTemplateId, responses, comments, overallRating } = req.body;

        const feedback = new StageFeedback({
            tenant: req.user.tenant,
            candidate: candidateId,
            requirementId,
            stageId,
            feedbackTemplate: feedbackTemplateId,
            evaluator: req.user._id,
            responses,
            comments,
            overallRating
        });

        await feedback.save();

        // Optionally update Candidate status or metadata
        // const applicant = await Applicant.findById(candidateId);
        // applicant.feedback.push(feedback._id);
        // await applicant.save();

        res.status(201).json(feedback);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
