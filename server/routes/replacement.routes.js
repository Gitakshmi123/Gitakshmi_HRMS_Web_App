const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const replacementCtrl = require('../controllers/replacement.controller');

router.get('/', auth.authenticate, auth.requireHr, replacementCtrl.listRequests);
router.post('/', auth.authenticate, auth.requireHr, replacementCtrl.createRequest);
router.get('/:id', auth.authenticate, auth.requireHr, replacementCtrl.getRequest);
router.post('/:id/approve', auth.authenticate, auth.requireAdminOrHr, replacementCtrl.approveRequest);

module.exports = router;
