const express = require('express');
const ctrl = require('../controllers/onboarding.controller');
const auth = require('../middleware/auth.jwt');

const router = express.Router();

router.get('/overview', auth.authenticate, auth.requirePsa, ctrl.superAdminOverview);

module.exports = router;
