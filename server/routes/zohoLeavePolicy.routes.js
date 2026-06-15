const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const zohoLeavePolicyController = require('../controllers/zohoLeavePolicy.controller');
const { validateLeavePolicy } = require('../validations/zohoLeavePolicy.validation');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');

// Middleware to check for 'leave' module access
const leaveCheck = checkModuleAccess('leave');

/**
 * @desc Validation Middleware
 */
const validate = (req, res, next) => {
    const result = validateLeavePolicy(req.body);
    if (!result.success) {
        return res.status(400).json({
            success: false,
            errors: result.error.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message
            }))
        });
    }
    next();
};

// All routes are private and require 'leave' module access
router.use(auth.authenticate, leaveCheck);

// Core CRUD Routes
router.post('/', validate, zohoLeavePolicyController.createPolicy);
router.get('/', zohoLeavePolicyController.getPolicies);
router.get('/:id', zohoLeavePolicyController.getPolicyById);
router.put('/:id', validate, zohoLeavePolicyController.updatePolicy);
router.delete('/:id', zohoLeavePolicyController.deletePolicy);

// Advanced Calculation Routes
router.get('/:policyId/calculate/:employeeId', zohoLeavePolicyController.calculateEmployeeEntitlement);

module.exports = router;
