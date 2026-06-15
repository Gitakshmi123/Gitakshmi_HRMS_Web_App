const express = require('express');
const router = express.Router();
const careerController = require('../controllers/career.controller');
const { authenticate } = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');

router.get('/customize', authenticate, checkPermission('portals.careerPage', 'any'), careerController.getCustomization);
router.post('/customize', authenticate, checkPermission('portals.careerPage', 'any'), careerController.saveCustomization);
router.post('/publish', authenticate, checkPermission('portals.careerPage', 'any'), careerController.publishCustomization);

router.get('/apply/customize', authenticate, checkPermission('portals.applyPage', 'any'), careerController.getCustomization);
router.post('/apply/customize', authenticate, checkPermission('portals.applyPage', 'any'), careerController.saveCustomization);
router.post('/apply/publish', authenticate, checkPermission('portals.applyPage', 'any'), careerController.publishCustomization);

module.exports = router;
