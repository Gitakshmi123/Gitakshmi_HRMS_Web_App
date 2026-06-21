const express = require('express');
const router = express.Router();
const compensationController = require('../controllers/compensation.controller');
const auth = require('../middleware/auth.jwt');

// Apply authentication to all compensation routes
router.use(auth.authenticate);

router.get('/list', compensationController.getCompensationList);
router.post('/increment', compensationController.createIncrement);
router.post('/setup/:employeeId', compensationController.setupInitialCompensation);
router.get('/history/:employeeId', compensationController.getCompensationHistory);
router.post('/bulk-setup', compensationController.bulkSetupCompensation);

module.exports = router;
