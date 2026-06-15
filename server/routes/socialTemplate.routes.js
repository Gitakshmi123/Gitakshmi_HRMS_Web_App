const express = require('express');
const router = express.Router();
const controller = require('../controllers/socialTemplate.controller');
const auth = require('../middleware/auth.jwt');
const tenantMiddleware = require('../middleware/tenant.middleware');

router.use(auth.authenticate);
router.use(tenantMiddleware);

router.get('/', controller.getTemplates);
router.post('/', controller.saveTemplate);
router.get('/:id', controller.getTemplateById);

module.exports = router;
