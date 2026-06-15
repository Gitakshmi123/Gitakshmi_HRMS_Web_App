const mongoose = require('mongoose');

// Helper to get models from tenant database
const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database not initialized. Please ensure tenant middleware is running.');
    }
    return {
        ZohoLeavePolicy: req.tenantDB.model('ZohoLeavePolicy'),
        Grade: req.tenantDB.model('Grade'),
        Department: req.tenantDB.model('Department'),
        Employee: req.tenantDB.model('Employee')
    };
};

/**
 * @desc    Create a new Leave Policy
 * @route   POST /api/leave-policies
 * @access  Private (Admin/HR)
 */
exports.createPolicy = async (req, res) => {
    try {
        const { ZohoLeavePolicy } = getModels(req);
        const tenantId = req.user.tenantId;

        const policyData = {
            ...req.body,
            tenant: tenantId
        };

        const policy = new ZohoLeavePolicy(policyData);
        await policy.save();

        res.status(201).json({
            success: true,
            data: policy
        });
    } catch (error) {
        console.error('Create Leave Policy Error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get all Leave Policies for the tenant
 * @route   GET /api/leave-policies
 * @access  Private
 */
exports.getPolicies = async (req, res) => {
    try {
        const { ZohoLeavePolicy } = getModels(req);
        const tenantId = req.user.tenantId;

        const policies = await ZohoLeavePolicy.find({ tenant: tenantId })
            .populate('entitlement.gradeEntitlements.grade', 'name level')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: policies.length,
            data: policies
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get policy by ID
 * @route   GET /api/leave-policies/:id
 */
exports.getPolicyById = async (req, res) => {
    try {
        const { ZohoLeavePolicy } = getModels(req);
        const policy = await ZohoLeavePolicy.findOne({ 
            _id: req.params.id, 
            tenant: req.user.tenantId 
        }).populate('entitlement.gradeEntitlements.grade', 'name level');

        if (!policy) {
            return res.status(404).json({ success: false, message: 'Policy not found' });
        }

        res.status(200).json({ success: true, data: policy });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Leave Policy
 * @route   PUT /api/leave-policies/:id
 */
exports.updatePolicy = async (req, res) => {
    try {
        const { ZohoLeavePolicy } = getModels(req);
        
        const policy = await ZohoLeavePolicy.findOneAndUpdate(
            { _id: req.params.id, tenant: req.user.tenantId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!policy) {
            return res.status(404).json({ success: false, message: 'Policy not found' });
        }

        res.status(200).json({ success: true, data: policy });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Leave Policy
 * @route   DELETE /api/leave-policies/:id
 */
exports.deletePolicy = async (req, res) => {
    try {
        const { ZohoLeavePolicy } = getModels(req);
        
        const policy = await ZohoLeavePolicy.findOneAndDelete({ 
            _id: req.params.id, 
            tenant: req.user.tenantId 
        });

        if (!policy) {
            return res.status(404).json({ success: false, message: 'Policy not found' });
        }

        res.status(200).json({ success: true, message: 'Policy removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Calculate specific entitlement for an employee
 * @param   {string} employeeId
 * @param   {string} policyId
 */
exports.calculateEmployeeEntitlement = async (req, res) => {
    try {
        const { ZohoLeavePolicy, Employee } = getModels(req);
        const { employeeId, policyId } = req.params;

        const employee = await Employee.findById(employeeId).populate('gradeId');
        const policy = await ZohoLeavePolicy.findById(policyId);

        if (!employee || !policy) {
            return res.status(404).json({ success: false, message: 'Employee or Policy not found' });
        }

        // Logic for grade-based entitlement
        let baseEntitlement = policy.entitlement.daysPerYear;
        
        if (employee.gradeId) {
            const override = policy.entitlement.gradeEntitlements.find(
                ge => ge.grade.toString() === employee.gradeId._id.toString()
            );
            if (override) {
                baseEntitlement = override.days;
            }
        }

        res.status(200).json({
            success: true,
            employee: {
                name: `${employee.firstName} ${employee.lastName}`,
                grade: employee.gradeId?.name
            },
            entitlement: {
                baseDays: baseEntitlement,
                accrualType: policy.entitlement.accrualType
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
