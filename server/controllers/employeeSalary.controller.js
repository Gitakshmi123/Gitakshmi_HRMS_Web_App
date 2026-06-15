const mongoose = require('mongoose');

// Helper to get models
const getModels = (req) => {
    return {
        Employee: req.tenantDB.model('Employee'),
        SalaryAssignment: req.tenantDB.model('SalaryAssignment'),
        SalaryTemplate: req.tenantDB.model('SalaryTemplate'),
    };
};

/**
 * Assign Salary Template to Employee
 * POST /api/employees/:id/salary-assignment
 */
exports.assignSalary = async (req, res) => {
    try {
        const { id } = req.params; // Employee ID
        const { salaryTemplateId, effectiveFrom, status } = req.body;
        const tenantId = req.user.tenantId;

        const { Employee, SalaryAssignment, SalaryTemplate } = getModels(req);

        // 1. Verify Employee
        const employee = await Employee.findOne({ _id: id, tenant: tenantId });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        // 2. Verify Template
        const template = await SalaryTemplate.findOne({ _id: salaryTemplateId, tenantId });
        if (!template) return res.status(404).json({ success: false, message: 'Salary Template not found' });

        // 3. Validation
        const effDate = new Date(effectiveFrom);
        const joinDate = new Date(employee.joiningDate);
        if (effDate < joinDate) {
            return res.status(400).json({ success: false, message: 'Effective date cannot be before joining date' });
        }

        // 4. Deactivate previous active assignments
        await SalaryAssignment.updateMany(
            { employeeId: id, status: 'Active' },
            {
                $set: {
                    status: 'Inactive',
                    isCurrent: false,
                    effectiveTo: new Date(effDate.getTime() - 24 * 60 * 60 * 1000) // Day before new effective date
                }
            }
        );

        // 5. Create New Assignment
        const assignment = new SalaryAssignment({
            tenantId,
            employeeId: id,
            salaryTemplateId,
            effectiveFrom: effDate,
            payFrequency: 'Monthly',
            status: status || 'Active',
            isCurrent: true,
            assignmentSnapshot: {
                annualCTC: template.annualCTC,
                monthlyCTC: template.monthlyCTC
            },
            assignedBy: req.user.id
        });

        await assignment.save();

        // 6. Update Employee Reference (Source of Truth for "Current")
        employee.salaryTemplateId = salaryTemplateId;
        await employee.save();

        res.status(201).json({ success: true, data: assignment, message: 'Salary assigned successfully' });

    } catch (error) {
        console.error('Assign Salary Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Employee Salary Assignment
 * GET /api/employees/:id/salary-assignment
 */
exports.getSalaryAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const { SalaryAssignment } = getModels(req);

        // Fetch the current active assignment
        const assignment = await SalaryAssignment.findOne({
            employeeId: id,
            status: 'Active',
            isCurrent: true
        })
            .populate('salaryTemplateId')
            .sort({ effectiveFrom: -1 });

        if (!assignment) {
            return res.json({ success: true, data: null });
        }

        res.json({ success: true, data: assignment });

    } catch (error) {
        console.error('Get Salary Assignment Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
