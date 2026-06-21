const fs = require('fs');
let content = fs.readFileSync('server/controllers/compensation.controller.js', 'utf8');
let idx = content.indexOf('exports.getCompensationHistory = async (req, res) => {');
if (idx !== -1) {
    let correctContent = content.substring(0, idx) + `exports.getCompensationHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const tenantId = getTenantId(req);
        const { Employee, EmployeeCtcVersion, EmployeePayrollProfile } = getModels(req);

        const employee = await Employee.findOne({ _id: employeeId }).select('_id firstName lastName employeeId').lean();
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const [salaryHistory, profileHistory] = await Promise.all([
            EmployeeCtcVersion.find({ companyId: tenantId, employeeId })
                .populate('createdBy', 'firstName lastName')
                .sort({ effectiveFrom: -1, version: -1 })
                .lean(),
            EmployeePayrollProfile.find({ tenantId, employeeId })
                .populate('createdBy', 'firstName lastName')
                .sort({ effectiveFrom: -1 })
                .lean()
        ]);

        res.json({
            success: true,
            data: salaryHistory,
            meta: {
                employee,
                payrollProfiles: profileHistory
            }
        });
    } catch (error) {
        console.error('Get History Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch history'
        });
    }
};

exports.bulkSetupCompensation = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const userId = req.user?.id || req.user?._id || null;
        const { Employee, EmployeeCtcVersion } = getModels(req);
        const canonicalPayroll = require('../services/canonicalPayroll.service');
        const SalaryCalculationEngine = require('../services/salaryCalculationEngine');
        const payrollPhase1 = require('../services/payrollPhase1.service');
        const MinimumWage = req.tenantDB.model('MinimumWage');

        const { employees } = req.body;
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ success: false, message: 'Valid employees array is required' });
        }

        const results = {
            successCount: 0,
            failedCount: 0,
            errors: []
        };

        for (const [index, row] of employees.entries()) {
            try {
                const { employeeId, totalCTC, state, employeeCategory, effectiveFrom: rowEffectiveFrom } = row;
                
                if (!employeeId || !totalCTC) {
                    throw new Error('Employee ID and Proposed CTC are required');
                }

                // Match by _id or employeeId string (e.g. EMP-001)
                const query = { $or: [] };
                if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
                    query.$or.push({ _id: employeeId });
                }
                query.$or.push({ employeeId: employeeId });

                const employee = await Employee.findOne(query).select('firstName lastName employeeId email joiningDate createdAt workState').lean();
                if (!employee) throw new Error(\`Employee \${employeeId} not found\`);

                const effectiveFrom = startOfDay(rowEffectiveFrom ? new Date(rowEffectiveFrom) : (employee.joiningDate || employee.createdAt || new Date()));
                const resolvedCTC = normalizeMoney(totalCTC);
                const category = employeeCategory || 'GENERAL';
                const empState = state || employee.workState || '';

                const existingVersion = await canonicalPayroll.resolveEffectiveSalaryVersion(req.tenantDB, tenantId, employee._id, effectiveFrom, effectiveFrom);
                if (existingVersion) throw new Error('Active salary version already exists for this employee');

                let minWageAmount = 0;
                if (empState && category) {
                    const mwDoc = await MinimumWage.findOne({ 
                        tenantId, 
                        state: { $regex: new RegExp(\`^\${empState}$\`, 'i') },
                        category: { $regex: new RegExp(\`^\${category}$\`, 'i') }
                    });
                    if (mwDoc) minWageAmount = mwDoc.monthlyAmount;
                }

                const ruleSet = await payrollPhase1.resolveStatutoryRuleSet(req.tenantDB, tenantId, effectiveFrom, effectiveFrom, { country: 'IN', workState: empState });
                const result = SalaryCalculationEngine.calculateSalary({
                    annualCTC: resolvedCTC,
                    employeeCategory: category,
                    minWageAmount,
                    payrollContext: {
                        applyStatutory: true,
                        locationPolicy: ruleSet ? payrollPhase1.buildStatutoryRuleSnapshot(ruleSet) : undefined
                    }
                });

                const components = [...result.earnings, ...result.benefits].map(c => ({
                    name: c.name, code: c.code, type: result.earnings.includes(c) ? 'EARNING' : 'BENEFIT',
                    monthlyAmount: c.monthly, annualAmount: c.yearly, isTaxable: true, isProRata: true, enabled: true
                }));

                await canonicalPayroll.createSalaryVersion(req.tenantDB, tenantId, employee._id, {
                    effectiveFrom, totalCTC: resolvedCTC, components, source: 'MANUAL',
                    revisionType: 'INITIAL', reason: 'Bulk Salary Setup'
                }, userId);

                results.successCount++;
            } catch (err) {
                results.failedCount++;
                results.errors.push({ row: index + 1, employeeId: row.employeeId, error: err.message });
            }
        }

        res.json({ success: true, message: \`Bulk setup complete. Success: \${results.successCount}, Failed: \${results.failedCount}\`, data: results });
    } catch (error) {
        console.error('Bulk Setup Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
`;
    fs.writeFileSync('server/controllers/compensation.controller.js', correctContent);
    console.log('Fixed');
}
