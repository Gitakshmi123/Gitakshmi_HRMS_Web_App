const express = require('express');
const authJwt = require('../middleware/auth.jwt');
const controller = require('../controllers/demoData.controller');

const router = express.Router();

router.post('/seed', authJwt.authenticate, authJwt.requireAdminOrHr, controller.seedTenantDemoData);

module.exports = router;
