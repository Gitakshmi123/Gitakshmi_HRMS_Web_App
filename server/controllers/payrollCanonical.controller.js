const canonicalPayroll = require('../services/canonicalPayroll.service');
const payrollRuleResolver = require('../services/payrollRuleResolver.service');

function getTenantId(req) {
    return req.tenantId || req.user?.tenantId || req.user?.companyId;
}

function getUserId(req) {
    return req.user?.id || req.user?._id || null;
}

function parsePeriod(query = {}) {
    if (query.month && query.year) {
        const month = parseInt(query.month, 10);
        const year = parseInt(query.year, 10);
        if (month >= 1 && month <= 12 && year >= 2000) {
            return {
                startDate: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
                endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
            };
        }
    }

    const date = query.date ? new Date(query.date) : new Date();
    if (!isNaN(date.getTime())) {
        return {
            startDate: new Date(date.setHours(0, 0, 0, 0)),
            endDate: new Date(date.setHours(23, 59, 59, 999))
        };
    }

    const today = new Date();
    return {
        startDate: new Date(today.setHours(0, 0, 0, 0)),
        endDate: new Date(today.setHours(23, 59, 59, 999))
    };
}

async function findEmployee(req, tenantId, employeeId) {
    const Employee = req.tenantDB.model('Employee');
    return Employee.findOne({ _id: employeeId, tenant: tenantId }).lean();
}

exports.getEmployeePayrollProfile = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { employeeId } = req.params;
        const { startDate, endDate } = parsePeriod(req.query);
        const EmployeePayrollProfile = req.tenantDB.model('EmployeePayrollProfile');

        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const [effectiveProfile, segmentResolution, history] = await Promise.all([
            canonicalPayroll.resolvePayrollProfile(req.tenantDB, tenantId, employeeId, startDate, endDate),
            canonicalPayroll.resolvePayrollProfileSegments(
                req.tenantDB,
                tenantId,
                employeeId,
                startDate,
                endDate,
                { returnMeta: true }
            ),
            EmployeePayrollProfile.find({ tenantId, employeeId }).sort({ effectiveFrom: -1 }).lean()
        ]);

        const segments = await Promise.all((segmentResolution?.segments || []).map(async (segment) => {
            let resolvedLocationPolicy = null;
            try {
                resolvedLocationPolicy = await payrollRuleResolver.resolvePayrollLocationPolicy(
                    req.tenantDB,
                    tenantId,
                    segment.profile || null
                );
            } catch (_err) {
                resolvedLocationPolicy = null;
            }

            return {
                segmentStart: segment.segmentStart,
                segmentEnd: segment.segmentEnd,
                isGap: segment.isGap === true,
                source: segment.source || 'DEFAULT',
                profile: segment.profile ? canonicalPayroll.buildPayrollProfileSnapshot(segment.profile) : null,
                locationPolicy: resolvedLocationPolicy
                    ? payrollRuleResolver.buildLocationPolicySnapshot(resolvedLocationPolicy)
                    : null
            };
        }));

        res.json({
            success: true,
            data: {
                effectiveProfile,
                segments,
                history
            }
        });
    } catch (error) {
        console.error('[getEmployeePayrollProfile] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createEmployeePayrollProfile = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { employeeId } = req.params;
        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const profile = await canonicalPayroll.createPayrollProfile(
            req.tenantDB,
            tenantId,
            employeeId,
            req.body,
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: profile,
            message: 'Payroll profile created successfully'
        });
    } catch (error) {
        console.error('[createEmployeePayrollProfile] Error:', error);
        const status = /overlap|effectiveTo/i.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getEmployeeSalaryVersions = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { employeeId } = req.params;
        const { startDate, endDate } = parsePeriod(req.query);
        const EmployeeCtcVersion = req.tenantDB.model('EmployeeCtcVersion');

        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const [effectiveVersion, history] = await Promise.all([
            canonicalPayroll.resolveEffectiveSalaryVersion(req.tenantDB, tenantId, employeeId, startDate, endDate),
            EmployeeCtcVersion.find({ companyId: tenantId, employeeId }).sort({ effectiveFrom: -1, version: -1 }).lean()
        ]);

        res.json({
            success: true,
            data: {
                effectiveVersion: effectiveVersion ? canonicalPayroll.buildSalarySourceSnapshot(effectiveVersion) : null,
                history
            }
        });
    } catch (error) {
        console.error('[getEmployeeSalaryVersions] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createEmployeeSalaryVersion = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { employeeId } = req.params;
        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const version = await canonicalPayroll.createSalaryVersion(
            req.tenantDB,
            tenantId,
            employeeId,
            req.body,
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: version,
            message: 'Salary version created successfully'
        });
    } catch (error) {
        console.error('[createEmployeeSalaryVersion] Error:', error);
        const status = /overlap|effectiveTo/i.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.validateEmployeePayrollData = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { employeeId } = req.params;
        const { startDate, endDate } = parsePeriod(req.query);

        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const validation = await canonicalPayroll.validateEmployeePayrollData(
            req.tenantDB,
            tenantId,
            employee,
            startDate,
            endDate,
            {
                requirePayrollProfile: String(process.env.PAYROLL_REQUIRE_PROFILE || '').toLowerCase() === 'true',
                allowLegacyFallback: false
            }
        );

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('[validateEmployeePayrollData] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.migrateCanonicalPayrollData = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const result = await canonicalPayroll.migrateCanonicalPayrollData(
            req.tenantDB,
            tenantId,
            {
                dryRun: req.body?.dryRun === true || req.query?.dryRun === 'true',
                force: req.body?.force === true || req.query?.force === 'true',
                userId: getUserId(req)
            }
        );

        res.json({
            success: true,
            data: result,
            message: result.dryRun
                ? 'Canonical payroll migration dry run completed'
                : 'Canonical payroll migration completed'
        });
    } catch (error) {
        console.error('[migrateCanonicalPayrollData] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
