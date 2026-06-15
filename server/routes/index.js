const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/tenants', require('./tenant.routes'));
router.use('/users', require('./user.routes'));
router.use('/employees', require('./employee.routes'));
router.use('/department', require('./department.routes'));
router.use('/module', require('./module.routes'));
router.use('/email', require('./email.routes'));

router.use('/tickets', require('./ticket.routes'));
router.use('/tasks', require('./task.routes'));
router.use('/social-templates', require('./socialTemplate.routes'));
router.use('/approvals', require('./approval.routes'));
router.use('/manpower-requisition', require('./manpowerRequisition.routes'));
router.use('/public/offer', require('./public.offer.routes'));

module.exports = router;
