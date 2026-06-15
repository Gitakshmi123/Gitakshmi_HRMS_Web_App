const express = require('express');
const router = express.Router();
const salaryStructureController = require('../controllers/salaryStructure.controller');
const { authenticate } = require('../middleware/auth.jwt');

router.post('/create', authenticate, salaryStructureController.createSalaryStructure);
router.post('/suggest', authenticate, salaryStructureController.suggestSalaryStructure);
router.get('/:candidateId', authenticate, salaryStructureController.getSalaryStructure);

module.exports = router;
