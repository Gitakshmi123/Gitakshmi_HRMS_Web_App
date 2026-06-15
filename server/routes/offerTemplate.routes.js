const express = require('express');
const router = express.Router();
const controller = require('../controllers/offerTemplate.controller');
const auth = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');

router.use(auth.authenticate);
router.use(auth.requireHr);

router.get('/', checkPermission('hiring.offerTemplates', 'view'), controller.getTemplates);
router.get('/:id', checkPermission('hiring.offerTemplates', 'view'), controller.getTemplateById);
router.post('/', checkPermission('hiring.offerTemplates', 'create'), controller.createTemplate);
router.put('/:id', checkPermission('hiring.offerTemplates', 'edit'), controller.updateTemplate);
router.delete('/:id', checkPermission('hiring.offerTemplates', 'delete'), controller.deleteTemplate);

module.exports = router;
