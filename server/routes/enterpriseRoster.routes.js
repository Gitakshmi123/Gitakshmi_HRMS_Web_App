const express = require('express');
const router = express.Router();
const rosterController = require('../controllers/enterpriseRoster.controller');
const { authenticate } = require('../middleware/auth.jwt');

router.get('/', authenticate, rosterController.listRosters);
router.get('/rotations', authenticate, rosterController.listRotations);
router.post('/rotations', authenticate, rosterController.createRotation);
router.post('/assignments', authenticate, rosterController.saveAssignments);
router.post('/validate-conflicts', authenticate, rosterController.validateRosterConflicts);
router.post('/', authenticate, rosterController.createRoster);
router.post('/generate', authenticate, rosterController.generateRoster);
router.post('/publish', authenticate, rosterController.publishRoster);
router.get('/:id', authenticate, rosterController.getRosterDetails);

module.exports = router;
