const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const salaryCtrl = require('../controllers/salary.controller');

// Root protection
router.use(auth.authenticate);
router.use(auth.requireHr);

// Salary Operations
router.post('/assign', salaryCtrl.assign);
router.post('/confirm', salaryCtrl.confirm);
router.get('/current', salaryCtrl.getCurrent);
router.post('/preview', salaryCtrl.preview);
router.post('/unlock', salaryCtrl.unlock);
router.post('/auto-balance', salaryCtrl.autoBalance);
router.post('/candidate-setup', salaryCtrl.candidateSetup);
router.get('/snapshot/:id', salaryCtrl.getSnapshot);

module.exports = router;
