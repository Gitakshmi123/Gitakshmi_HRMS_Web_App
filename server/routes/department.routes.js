const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/department.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/', ctrl.getDepartments);
router.post('/', ctrl.createDepartment);
router.put('/:id', ctrl.updateDepartment);
router.delete('/:id', ctrl.deleteDepartment);

module.exports = router;
