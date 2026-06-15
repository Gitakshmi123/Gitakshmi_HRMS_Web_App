const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/module.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/', ctrl.getModules);
router.put('/:id/config', ctrl.updateModuleConfig);

module.exports = router;
