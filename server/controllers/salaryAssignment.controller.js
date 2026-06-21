const mongoose = require('mongoose');
const canonicalPayroll = require('../services/canonicalPayroll.service');

// Helper to get models from tenant DB
const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database connection not available');
    }
    return {
        SalaryAssignment: req.tenantDB.model('SalaryAssignment'),
        SalaryTemplate: req.tenantDB.model('SalaryTemplate'),
        Employee: req.tenantDB.model('Employee'),
        EmployeeCompensation: req.tenantDB.model('EmployeeCompensation')
    };
};

/**
 * Assign a salary template to an employee
 * POST /api/payroll/assign-template
 */
exports.assignTemplate = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const tenantId = req.user.tenantId;
        const { employeeId, salaryTemplateId, effectiveFrom } = req.body;

        if (!employeeId || !salaryTemplateId || !effectiveFrom) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const { SalaryAssignment, SalaryTemplate, Employee } = getModels(req);

        // Validate existence
        const employee = await Employee.findOne({ _id: employeeId, tenant: tenantId });
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

        const template = await SalaryTemplate.findOne({ _id: salaryTemplateId, tenantId });
        if (!template) return res.status(404).json({ success: false, message: "Salary Template not found" });

        const effectiveDate = new Date(effectiveFrom);
        if (isNaN(effectiveDate.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid effective date" });
        }

        const canonicalComponents = [
            ...(template.earnings || []).map(item => ({
                name: item.name,
                code: item.componentCode,
                monthlyAmount: item.monthlyAmount,
                annualAmount: item.annualAmount,
                type: 'EARNING',
                isTaxable: item.taxable !== false,
                isProRata: item.proRata !== false,
                enabled: item.enabled !== false
            })),
            ...(template.employeeDeductions || []).map(item => ({
                name: item.name,
                code: item.componentCode,
                monthlyAmount: item.monthlyAmount,
                annualAmount: (item.monthlyAmount || 0) * 12,
                type: 'DEDUCTION',
                category: item.category,
                amountType: item.amountType,
                calculationBase: item.calculationBase,
                amountValue: item.amountValue,
                percentage: item.percentage,
                enabled: item.enabled !== false
            })),
            ...(template.employerDeductions || []).map(item => ({
                name: item.name,
                code: item.componentCode,
                monthlyAmount: item.monthlyAmount,
                annualAmount: item.annualAmount || ((item.monthlyAmount || 0) * 12),
                type: 'BENEFIT',
                isTaxable: false,
                isProRata: false,
                enabled: item.enabled !== false
            }))
        ];

        const salaryVersion = await canonicalPayroll.createSalaryVersion(
            req.tenantDB,
            tenantId,
            employeeId,
            {
                effectiveFrom: effectiveDate,
                totalCTC: template.annualCTC || 0,
                monthlyCTC: template.monthlyCTC || Math.round(((template.annualCTC || 0) / 12) * 100) / 100,
                components: canonicalComponents,
                salaryTemplateId,
                source: 'SALARY_TEMPLATE',
                sourceModel: 'SalaryTemplate',
                sourceRefId: salaryTemplateId,
                revisionType: 'INITIAL',
                reason: `Assigned salary template ${template.templateName}`,
                closePrevious: true,
                settings: template.settings || {}
            },
            req.user.id || req.user._id
        );

        // Create assignment (Compatible with new schema)
        const assignment = new SalaryAssignment({
            tenantId,
            employeeId,
            salaryTemplateId,
            effectiveFrom: effectiveDate,
            ctcAnnual: template.annualCTC || 0,
            monthlyCTC: template.monthlyCTC || Math.round(((template.annualCTC || 0) / 12) * 100) / 100,
            assignedBy: req.user.id || req.user._id
        });

        await assignment.save();

        // If effective date is today or past, update the employee record directly as "Current"
        // This maintains backward compatibility and allows quick access
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (effectiveDate <= today) {
            employee.salaryTemplateId = salaryTemplateId;
            await employee.save();
        }

        res.status(201).json({
            success: true,
            data: assignment,
            salaryVersion,
            message: "Salary template assigned successfully"
        });

    } catch (error) {
        console.error("assignTemplate Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get assignment history for an employee
 * GET /api/payroll/history/:employeeId
 */
exports.getAssignmentHistory = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const tenantId = req.user.tenantId;
        const { employeeId } = req.params;

        const { SalaryAssignment } = getModels(req);

        const history = await SalaryAssignment.find({ tenantId, employeeId })
            .populate('salaryTemplateId', 'templateName annualCTC')
            .populate('assignedBy', 'firstName lastName')
            .sort({ effectiveFrom: -1 });

        res.json({ success: true, data: history });
    } catch (error) {
        console.error("getAssignmentHistory Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * Assign salary based on Excel calculation breakup
 * POST /api/payroll/assign-salary-excel
 */
exports.assignSalaryExcel = async (req, res) => {
    try {
        if (!req.user || !req.user.tenantId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const tenantId = req.user.tenantId;
        const { employeeId, annualCTC, effectiveFrom, breakup, category, state } = req.body;

        if (!employeeId || !annualCTC || !breakup) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const { Employee, EmployeeCompensation, SalaryAssignment } = getModels(req);

        // 1. Validate employee
        const employee = await Employee.findOne({ _id: employeeId, tenant: tenantId });
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

        // 2. Update Employee record (category/state)
        employee.category = category;
        employee.state = state;
        await employee.save();

        // 3. Update or Create EmployeeCompensation
        let compensation = await EmployeeCompensation.findOne({ employeeId, companyId: tenantId });
        const oldCTC = compensation ? compensation.totalCTC : 0;

        const components = [
            ...breakup.earnings.map(e => ({ name: e.name, code: e.code, monthlyAmount: e.monthly, annualAmount: e.yearly, type: 'EARNING' })),
            ...breakup.deductions.map(d => ({ name: d.name, code: d.code, monthlyAmount: d.monthly, annualAmount: d.yearly, type: 'DEDUCTION' })),
            ...(breakup.benefits || []).map(b => ({ name: b.name, code: b.code, monthlyAmount: b.monthly, annualAmount: b.yearly, type: 'BENEFIT' }))
        ];

        if (!compensation) {
            compensation = new EmployeeCompensation({
                companyId: tenantId,
                employeeId,
                totalCTC: annualCTC,
                grossA: breakup.totals.grossA_Yearly,
                grossB: breakup.totals.grossB_Yearly,
                components,
                category,
                effectiveFrom: new Date(effectiveFrom),
                createdBy: req.user.id || req.user._id
            });
        } else {
            // Push to revision history
            compensation.revisionHistory.push({
                oldCTC,
                newCTC: annualCTC,
                effectiveDate: new Date(effectiveFrom),
                revisedBy: req.user.id || req.user._id,
                reason: 'Excel-style salary assignment'
            });

            compensation.totalCTC = annualCTC;
            compensation.grossA = breakup.totals.grossA_Yearly;
            compensation.grossB = breakup.totals.grossB_Yearly;
            compensation.components = components;
            compensation.category = category;
            compensation.effectiveFrom = new Date(effectiveFrom);
            compensation.updatedBy = req.user.id || req.user._id;
        }

        await compensation.save();
        
        // 4. Save SalaryAssignment record for history/tracking
        await SalaryAssignment.create({
            tenantId: req.tenantId,
            employeeId: employeeId,
            salaryTemplateId: null, // Excel style might not have a template
            ctcAnnual: annualCTC,
            monthlyCTC: breakup.totals.totalCTC / 12,
            
            // Map structured lists
            earnings: breakup.earnings.map(e => ({ name: e.name, code: e.code, monthlyAmount: e.monthly, annualAmount: e.yearly })),
            deductions: breakup.deductions.map(d => ({ name: d.name, code: d.code, monthlyAmount: d.monthly, annualAmount: d.yearly })),
            benefits: (breakup.benefits || []).map(b => ({ name: b.name, code: b.code, monthlyAmount: b.monthly, annualAmount: b.yearly })),
            
            breakup: breakup, // Store the full calculation result for backup
            category: category,
            state: state,
            netSalaryMonthly: breakup.totals.takeHomeMonthly,
            effectiveFrom: new Date(effectiveFrom),
            assignedBy: req.user.id || req.user._id
        });

        res.json({
            success: true,
            data: compensation,
            message: "Salary assigned successfully"
        });

    } catch (error) {
        console.error("assignSalaryExcel Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
