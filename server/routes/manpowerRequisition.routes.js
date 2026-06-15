const express = require('express');
const router = express.Router();
const manpowerRequisitionController = require('../controllers/manpowerRequisitionController');
const auth = require('../middleware/auth.jwt');

// All routes require authentication
router.use(auth.authenticate);

router.post('/', manpowerRequisitionController.createRequisition);
router.get('/', manpowerRequisitionController.getRequisitions);
router.get('/:id', manpowerRequisitionController.getRequisitionById);

// Optionally an admin or workflow system endpoint to update status
router.patch('/:id/status', manpowerRequisitionController.updateRequisitionStatus);

module.exports = router;
