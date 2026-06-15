const express = require('express');

const auth = require('../middleware/auth.jwt');
const systemController = require('../controllers/system.controller');

const router = express.Router();

router.get('/modules-full', auth.authenticate, systemController.getModulesFull);
router.post('/seed-modules', auth.authenticate, auth.requirePsa, systemController.seedModules);

module.exports = router;
