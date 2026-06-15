const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const { authenticate } = require('../middleware/auth.jwt');

router.use(authenticate);

// -- FEEDBACK TEMPLATES --
router.post('/feedback/template', feedbackController.createFeedbackTemplate);
router.get('/feedback/templates', feedbackController.getFeedbackTemplates);
router.get('/feedback/template/:stageId', feedbackController.getFeedbackTemplateById);

// -- FEEDBACK SUBMISSION --
router.post('/feedback/submit', feedbackController.submitFeedback);

// -- PIPELINE STAGES --
// For 'Master' stages
router.post('/pipeline/stage', feedbackController.createHiringStage);
router.get('/pipeline/list', feedbackController.getHiringStages);

// For 'Requirement' specific pipeline customization
// Use dedicated endpoints or reuse Requirement controller?
// The user asked for "POST /pipeline/stage" & "PUT /pipeline/stage/order".
// These update a specific requirement usually.
// But could also mean "Create a new stage definition to be used".
// Let's assume the controller handles Requirement update logic as implemented.
router.post('/pipeline/requirement/:id/stage', feedbackController.addStageToPipeline);
router.put('/pipeline/requirement/:id/order', feedbackController.updatePipelineOrder);

module.exports = router;
