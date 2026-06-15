const router = require('express').Router();

const enterprise = require('../core/controllers/enterprise.controller');
const resource = require('../tenant/controllers/resource.controller');
const { requireSystemAuth } = require('../middleware/enterpriseAuth.middleware');
const { tenantResolver } = require('../middleware/enterpriseTenant.middleware');
const { requirePermission } = require('../middleware/enterpriseRbac.middleware');

router.post('/bootstrap/system-admin', enterprise.bootstrapSystemAdmin);
router.post('/system/login', enterprise.loginSystemAdmin);
router.post('/tenants', requireSystemAuth, enterprise.createCompany);
router.get('/tenants', requireSystemAuth, enterprise.listTenants);
router.get('/connections', requireSystemAuth, enterprise.connectionStats);

router.post('/tenant/login', tenantResolver, enterprise.loginTenant);

router.get('/tenant/:moduleKey', tenantResolver, (req, res, next) => requirePermission(req.params.moduleKey, 'read')(req, res, next), resource.list);
router.post('/tenant/:moduleKey', tenantResolver, (req, res, next) => requirePermission(req.params.moduleKey, 'create')(req, res, next), resource.create);
router.get('/tenant/:moduleKey/:id', tenantResolver, (req, res, next) => requirePermission(req.params.moduleKey, 'read')(req, res, next), resource.getOne);
router.put('/tenant/:moduleKey/:id', tenantResolver, (req, res, next) => requirePermission(req.params.moduleKey, 'update')(req, res, next), resource.update);
router.delete('/tenant/:moduleKey/:id', tenantResolver, (req, res, next) => requirePermission(req.params.moduleKey, 'delete')(req, res, next), resource.remove);

router.use((error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Enterprise API error',
    code: error.code || 'enterprise_api_error'
  });
});

module.exports = router;
