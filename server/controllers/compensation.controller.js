const canonicalPayroll = require('../services/canonicalPayroll.service');

const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database connection not available');
    }

    return {
        Employee: req.tenantDB.model('Employee'),
        EmployeeCtcVersion: req.tenantDB.model('EmployeeCtcVersion'),
        EmployeePayrollProfile: req.tenantDB.model('EmployeePayrollProfile')
    };
};

function getTenantId(req) {
    return req.user?.tenantId || req.user?.companyId || req.tenantId;
}

function normalizeMoney(value) {
    const amount = parseFloat(String(value ?? 0).replace(/[^0-9.-]+/g, '')) || 0;
    return Math.round(amount * 100) / 100;
}

function startOfDay(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
}

function dayBefore(value) {
    const date = startOfDay(value);
    if (!date) {
        return null;
    }
    date.setDate(date.getDate() - 1);
    date.setHours(23, 59, 59, 999);
    return date;
}

function buildInitialSalaryComponents(totalCTC) {
    const normalizedTotal = normalizeMoney(totalCTC);
    const monthlyCTC = Math.round((normalizedTotal / 12) * 100) / 100;
    const basicMonthly = Math.round(monthlyCTC * 0.5 * 100) / 100;
    const hraMonthly = Math.round((basicMonthly * 0.4) * 100) / 100;
    const specialMonthly = Math.round((monthlyCTC - basicMonthly - hraMonthly) * 100) / 100;

    return [
        {
            name: 'Basic Salary',
            code: 'BASIC',
            type: 'EARNING',
            monthlyAmount: basicMonthly,
            annualAmount: Math.round((basicMonthly * 12) * 100) / 100,
            isTaxable: true,
            isProRata: true,
            enabled: true
        },
        {
            name: 'House Rent Allowance',
            code: 'HRA',
            type: 'EARNING',
            monthlyAmount: hraMonthly,
            annualAmount: Math.round((hraMonthly * 12) * 100) / 100,
            isTaxable: true,
            isProRata: true,
            enabled: true
        },
        {
            name: 'Special Allowance',
            code: 'SPECIAL_ALLOWANCE',
            type: 'EARNING',
            monthlyAmount: specialMonthly,
            annualAmount: Math.round((specialMonthly * 12) * 100) / 100,
            isTaxable: true,
            isProRata: true,
            enabled: true
        }
    ];
}

function deriveAvailableActions(activeVersion, versionCount) {
    return {
        canSetupSalary: !activeVersion,
        canCreateIncrement: Boolean(activeVersion),
        canViewHistory: Boolean(versionCount)
    };
}

function deriveCompensationStatus(activeVersion, scheduledVersion, validation) {
    if (!activeVersion && scheduledVersion) {
        return 'Scheduled';
    }

    if (!activeVersion) {
        return 'Not Set';
    }

    return validation.issues?.length ? 'Blocked' : 'Active';
}

function derivePayrollReadiness(validation = {}) {
    if (validation.canCalculate) {
        return 'Ready';
    }

    const missingSalary = (validation.issues || []).some(issue => issue.code === 'MISSING_CANONICAL_SALARY_VERSION');
    if (missingSalary) {
        return 'Missing Salary';
    }

    const missingProfile = (validation.issues || []).some(issue => issue.code === 'MISSING_PAYROLL_PROFILE');
    if (missingProfile) {
        return 'Missing Profile';
    }

    return 'Blocked';
}

async function buildCompensationRow(req, tenantId, employee, referenceDate) {
    const { EmployeeCtcVersion } = getModels(req);

    const [activeVersion, scheduledVersionDoc, payrollProfile, validation, versionCount] = await Promise.all([
        canonicalPayroll.resolveEffectiveSalaryVersion(req.tenantDB, tenantId, employee._id, referenceDate, referenceDate),
        EmployeeCtcVersion.findOne({
            companyId: tenantId,
            employeeId: employee._id,
            status: 'SCHEDULED',
            effectiveFrom: { $gt: referenceDate }
        }).sort({ effectiveFrom: 1, version: 1 }).lean(),
        canonicalPayroll.resolvePayrollProfile(req.tenantDB, tenantId, employee._id, referenceDate, referenceDate),
        canonicalPayroll.validateEmployeePayrollData(
            req.tenantDB,
            tenantId,
            employee,
            referenceDate,
            referenceDate,
            {
                requirePayrollProfile: false,
                allowLegacyFallback: false
            }
        ),
        EmployeeCtcVersion.countDocuments({ companyId: tenantId, employeeId: employee._id })
    ]);

    const scheduledVersion = canonicalPayroll.buildCompensationFromVersion(scheduledVersionDoc);
    const compensationStatus = deriveCompensationStatus(activeVersion, scheduledVersion, validation);
    const payrollReadiness = derivePayrollReadiness(validation);
    const legacySource = !activeVersion
        ? await canonicalPayroll.findLegacySalarySource(req.tenantDB, tenantId, employee)
        : null;
    const availableActions = deriveAvailableActions(activeVersion, versionCount);

    return {
        ...employee,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A',
        activeVersion,
        scheduledVersion,
        payrollProfile: payrollProfile ? canonicalPayroll.buildPayrollProfileSnapshot(payrollProfile) : null,
        validation,
        ctcStatus: compensationStatus,
        compensationStatus,
        payrollReadiness,
        blockersCount: validation.issues?.length || 0,
        warningsCount: validation.warnings?.length || 0,
        versionCount,
        availableActions,
        primaryAction: availableActions.canSetupSalary ? 'SETUP_SALARY' : 'VIEW_DETAILS',
        legacySource: legacySource
            ? {
                source: legacySource.source,
                sourceRefId: legacySource.sourceRefId,
                totalCTC: normalizeMoney(legacySource.totalCTC || 0),
                effectiveFrom: legacySource.effectiveFrom || null
            }
            : null
    };
}

exports.getCompensationList = async (req, res) => {
    try {
        const { Employee } = getModels(req);
        const tenantId = getTenantId(req);
        const { search, status } = req.query;

        let query = {};
        if (status) {
            query.status = status;
        }

        const employees = await Employee.find(query)
            .select('firstName lastName employeeId department role email status joiningDate branchId branchName')
            .lean();

        const searchValue = String(search || '').trim().toLowerCase();
        const filteredEmployees = searchValue
            ? employees.filter((emp) => {
                const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();
                const identifier = `${emp.employeeId || ''} ${emp.email || ''}`.toLowerCase();
                return fullName.includes(searchValue) || identifier.includes(searchValue);
            })
            : employees;

        const referenceDate = new Date();
        referenceDate.setHours(0, 0, 0, 0);

        const data = await Promise.all(filteredEmployees.map((employee) => buildCompensationRow(req, tenantId, employee, referenceDate)));

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get Compensation List Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createIncrement = async (req, res) => {
    try {
        const salaryIncrementService = require('../services/salaryIncrement.service');
        const {
            employeeId,
            effectiveFrom,
            totalCTC,
            grossA,
            grossB,
            grossC,
            components,
            incrementType,
            reason,
            notes
        } = req.body;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        if (!effectiveFrom) {
            return res.status(400).json({
                success: false,
                message: 'Effective From date is required'
            });
        }

        if (!totalCTC || totalCTC <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid Total CTC is required'
            });
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        const userId = req.user.id || req.user._id;
        const tenantId = getTenantId(req);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID not found in request'
            });
        }

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID not found in request'
            });
        }

        const result = await salaryIncrementService.createIncrement(req.tenantDB, {
            employeeId,
            effectiveFrom,
            totalCTC,
            grossA,
            grossB,
            grossC,
            components,
            incrementType: incrementType || 'INCREMENT',
            reason,
            notes,
            createdBy: userId,
            companyId: tenantId
        });

        res.json({
            success: true,
            message: `Salary ${result.status === 'ACTIVE' ? 'increment activated' : 'increment scheduled'} successfully`,
            data: {
                newVersion: {
                    version: result.newCtcVersion.version,
                    totalCTC: result.newCtcVersion.totalCTC,
                    grossA: result.newCtcVersion.grossA,
                    grossB: result.newCtcVersion.grossB,
                    grossC: result.newCtcVersion.grossC,
                    effectiveFrom: result.newCtcVersion.effectiveFrom,
                    status: result.newCtcVersion.status,
                    isActive: result.newCtcVersion.isActive
                },
                change: {
                    absolute: result.change.absolute,
                    percentage: result.change.percentage
                },
                status: result.status,
                statusMessage: result.status === 'ACTIVE'
                    ? 'Increment is now active and will be used for payroll'
                    : `Increment scheduled for ${new Date(effectiveFrom).toLocaleDateString()}`
            }
        });
    } catch (error) {
        console.error('Create Increment Error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            user: req.user ? { id: req.user.id || req.user._id, tenantId: req.user.tenantId } : 'No user',
            body: req.body
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create increment',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.setupInitialCompensation = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const tenantId = getTenantId(req);
        const userId = req.user?.id || req.user?._id || null;
        const { Employee, EmployeeCtcVersion } = getModels(req);

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID not found in request'
            });
        }

        const employee = await Employee.findOne({ _id: employeeId })
            .select('firstName lastName employeeId email joiningDate createdAt branchId branchName workCity workState workLocation commAddress permAddress tempAddress bankDetails')
            .lean();

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const effectiveFrom = startOfDay(req.body?.effectiveFrom || employee.joiningDate || employee.createdAt || new Date());
        if (!effectiveFrom) {
            return res.status(400).json({
                success: false,
                message: 'A valid effective date is required'
            });
        }

        const existingVersion = await canonicalPayroll.resolveEffectiveSalaryVersion(
            req.tenantDB,
            tenantId,
            employeeId,
            effectiveFrom,
            effectiveFrom
        );

        if (existingVersion) {
            return res.status(409).json({
                success: false,
                message: 'An active salary version already exists for this employee. Use increment instead.'
            });
        }

        const nextScheduledVersion = await EmployeeCtcVersion.findOne({
            companyId: tenantId,
            employeeId,
            status: 'SCHEDULED',
            effectiveFrom: { $gt: effectiveFrom }
        }).sort({ effectiveFrom: 1, version: 1 }).lean();

        const effectiveTo = nextScheduledVersion?.effectiveFrom ? dayBefore(nextScheduledVersion.effectiveFrom) : null;
        if (effectiveTo && effectiveTo < effectiveFrom) {
            return res.status(400).json({
                success: false,
                message: 'Selected effective date conflicts with an already scheduled salary version.'
            });
        }

        const legacySource = await canonicalPayroll.findLegacySalarySource(req.tenantDB, tenantId, employee);
        const requestedCTC = normalizeMoney(req.body?.totalCTC || req.body?.annualCTC || 0);
        const resolvedCTC = requestedCTC || normalizeMoney(legacySource?.totalCTC || 0);

        if (!resolvedCTC || resolvedCTC <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid Annual CTC is required'
            });
        }

        let components = Array.isArray(req.body?.components) && req.body.components.length > 0
            ? req.body.components
            : null;

        if (!components) {
            // Auto-generate components using the advanced engine
            const SalaryCalculationEngine = require('../services/salaryCalculationEngine');
            const payrollPhase1 = require('../services/payrollPhase1.service');
            
            const category = req.body?.employeeCategory || 'GENERAL';
            const state = req.body?.state || employee.workState || '';
            const city = req.body?.city || employee.workCity || '';
            
            let minWageAmount = 0;
            if (state && category) {
                const MinimumWage = req.tenantDB.models.MinimumWage || req.tenantDB.model('MinimumWage', require('../models/MinimumWage'));
                const mwDoc = await MinimumWage.findOne({ 
                    tenantId, 
                    state: { $regex: new RegExp(`^${state}$`, 'i') },
                    category: { $regex: new RegExp(`^${category}$`, 'i') }
                });
                if (mwDoc) minWageAmount = mwDoc.monthlyAmount;
            }

            const ruleSet = await payrollPhase1.resolveStatutoryRuleSet(
                req.tenantDB,
                tenantId,
                effectiveFrom,
                effectiveFrom,
                { country: 'IN', workState: state, workCity: city, payrollRegion: state }
            );

            const result = SalaryCalculationEngine.calculateSalary({
                annualCTC: resolvedCTC,
                employeeCategory: category,
                minWageAmount,
                payrollContext: {
                    applyStatutory: true,
                    locationPolicy: ruleSet ? payrollPhase1.buildStatutoryRuleSnapshot(ruleSet) : undefined
                }
            });

            // Convert engine results back to saveable components
            components = [
                ...result.earnings,
                ...result.benefits
            ].map(c => ({
                name: c.name,
                code: c.code,
                type: result.earnings.includes(c) ? 'EARNING' : 'BENEFIT',
                monthlyAmount: c.monthly,
                annualAmount: c.yearly,
                isTaxable: true,
                isProRata: true,
                enabled: true
            }));
        }

        const shouldUseLegacySource = Boolean(legacySource && requestedCTC === 0 && !req.body?.components);

        const createdVersion = await canonicalPayroll.createSalaryVersion(
            req.tenantDB,
            tenantId,
            employeeId,
            {
                effectiveFrom,
                effectiveTo,
                totalCTC: resolvedCTC,
                components,
                source: shouldUseLegacySource ? legacySource.source : 'MANUAL',
                sourceModel: shouldUseLegacySource ? legacySource.sourceModel : undefined,
                sourceRefId: shouldUseLegacySource ? legacySource.sourceRefId : undefined,
                revisionType: 'INITIAL',
                reason: req.body?.reason || (shouldUseLegacySource
                    ? `Initial canonical salary setup from ${legacySource.source}`
                    : 'Initial canonical salary setup'),
                notes: req.body?.notes
            },
            userId
        );

        const payrollProfileResolution = await canonicalPayroll.resolvePayrollProfile(
            req.tenantDB,
            tenantId,
            employeeId,
            effectiveFrom,
            effectiveFrom,
            {
                employee,
                userId,
                autoBackfill: req.body?.autoCreatePayrollProfile !== false,
                returnMeta: true
            }
        );

        const validation = await canonicalPayroll.validateEmployeePayrollData(
            req.tenantDB,
            tenantId,
            employee,
            effectiveFrom,
            effectiveFrom,
            {
                requirePayrollProfile: false,
                allowLegacyFallback: false
            }
        );

        res.status(201).json({
            success: true,
            message: 'Initial salary setup created successfully',
            data: {
                salaryVersion: canonicalPayroll.buildCompensationFromVersion(createdVersion),
                payrollProfile: payrollProfileResolution?.profile
                    ? canonicalPayroll.buildPayrollProfileSnapshot(payrollProfileResolution.profile)
                    : null,
                payrollProfileAutoBackfilled: payrollProfileResolution?.autoBackfilled === true,
                preservedScheduledVersion: nextScheduledVersion
                    ? {
                        _id: nextScheduledVersion._id,
                        version: nextScheduledVersion.version,
                        effectiveFrom: nextScheduledVersion.effectiveFrom
                    }
                    : null,
                validation
            }
        });
    } catch (error) {
        console.error('Setup Initial Compensation Error:', error);
        const status = /required|valid|conflicts|overlap|effective/i.test(error.message) ? 400 : 500;
        res.status(status).json({
            success: false,
            message: error.message || 'Failed to set up initial compensation'
        });
    }
};

exports.getCompensationHistory = async (req, res) => {
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
        const MinimumWage = req.tenantDB.models.MinimumWage || req.tenantDB.model('MinimumWage', require('../models/MinimumWage'));

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
                const empIdStr = String(employeeId).trim();
                const query = { $or: [] };
                if (empIdStr.match(/^[0-9a-fA-F]{24}$/)) {
                    query.$or.push({ _id: empIdStr });
                }
                query.$or.push({ employeeId: empIdStr });

                const employee = await Employee.findOne(query).select('firstName lastName employeeId email joiningDate createdAt workState').lean();
                if (!employee) throw new Error(`Employee ${empIdStr} not found`);

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
                        state: { $regex: new RegExp(`^${empState}$`, 'i') },
                        category: { $regex: new RegExp(`^${category}$`, 'i') }
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

        res.json({ success: true, message: `Bulk setup complete. Success: ${results.successCount}, Failed: ${results.failedCount}`, data: results });
    } catch (error) {
        console.error('Bulk Setup Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
